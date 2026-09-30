export const GRAVITY = 0.7;

/** Quanto do empurrão de um golpe sobra de um tick para o seguinte. */
const KNOCKBACK_FRICTION = 0.8;

/** Ticks em que o retângulo fica branco ao apanhar. */
const HIT_FLASH_TICKS = 6;

/** Ticks que um lutador derrubado fica no chão antes de se levantar. */
const DOWN_TICKS = 30;

/** Com que força o golpe que mata atira o lutador: para cima e para trás, em px por tick. */
const KO_LAUNCH = -9;
const KO_KNOCKBACK = 8;

/** O salto de quem é derrubado por um golpe que não o levanta, em px por tick. */
const TRIP_LAUNCH = -6;

/** Quanto do empurrão sobra quando quem foi atirado bate no chão. */
const LANDING_KNOCKBACK = 0.3;

/** Ticks que um lutador derrotado leva a desaparecer. */
const DEFEAT_FADE_TICKS = 45;

/**
 * Representa um lutador no ringue.
 *
 * Ainda é um retângulo colorido, mas já com física: cai por acção da
 * gravidade, assenta no chão e não sai pelas laterais do ringue. Sprites,
 * hitboxes e estados de animação entram nos passos seguintes.
 */
export class Fighter {
  constructor({
    x,
    y,
    width = 50,
    height = 150,
    color = '#ffffff',
    maxHealth = 100,
    facing = 1,
    bounds,
  }) {
    this.position = { x, y };
    this.velocity = { x: 0, y: 0 };
    this.width = width;
    this.height = height;
    this.color = color;

    // Lado para onde o lutador olha: 1 = direita, -1 = esquerda. O desenho
    // dos bonecos espelha-se com este valor.
    this.facing = facing;

    // Contador de frames, base das animações (ciclo de passada, etc.).
    this.animationTime = 0;

    this.maxHealth = maxHealth;
    this.health = maxHealth;

    // Depois de apanhar: ticks sem controlo, empurrão que ainda falta
    // percorrer (px por tick, com sinal) e o clarão do impacto.
    this.hitStun = 0;
    this.knockback = 0;
    this.hitFlash = 0;

    /** Ticks parado no instante de um impacto, a dar ou a levar. */
    this.hitPause = 0;

    /** Verdadeiro nos ticks em que a pausa do impacto o segurou. */
    this.isFrozen = false;

    // Derrubado: `isFalling` enquanto vai no ar depois de um golpe que o
    // levantou, `downTicks` enquanto está estendido no chão.
    this.isFalling = false;
    this.downTicks = 0;

    /** Aceleração da queda, em px por tick ao quadrado. */
    this.gravity = GRAVITY;

    /** O golpe em curso ({ damage, knockback, launch, stun, pause }), ou null. */
    this.currentMove = null;

    /** Ticks desde que ficou sem vida. */
    this.defeatTicks = 0;

    /** Fora de cena: não se desenha. Usado pelas cenas que o tiram do ecrã. */
    this.hidden = false;

    // Limites do ringue: o lutador precisa de saber onde está o chão e as
    // paredes para a colisão, em vez de ir buscar o canvas por fora.
    this.bounds = bounds;
  }

  /** O chão, em coordenadas de canvas (topo do lutador quando assentado). */
  get groundY() {
    // A linha do chão vem da arena. Sem arena, o fundo do canvas serve.
    return (this.bounds.groundY ?? this.bounds.height) - this.height;
  }

  get isOnGround() {
    return this.position.y >= this.groundY;
  }

  /** Vida entre 0 e 1 — é nesta forma que a barra de vida a consome. */
  get healthRatio() {
    return this.health / this.maxHealth;
  }

  get isDefeated() {
    return this.health <= 0;
  }

  /** Verdadeiro enquanto o lutador não pode ser controlado. */
  get isBusy() {
    return this.hitStun > 0 || this.isFalling || this.downTicks > 0;
  }

  /** Onde o lutador pode ser atingido, em coordenadas do ringue. */
  getHurtBoxes() {
    // Quem já caiu não leva mais golpes, nem quem está estendido no chão.
    if (this.isDefeated || this.downTicks > 0) return [];

    return [{
      x: this.position.x,
      y: this.position.y,
      width: this.width,
      height: this.height,
    }];
  }

  /** Onde o golpe em curso acerta neste tick. Vazio = não está a bater. */
  getHitBoxes() {
    return [];
  }

  /**
   * Chamado quando o golpe em curso acerta em alguém. `impact` diz onde
   * ({ point }) e em quem ({ defender }).
   */
  registerHit() {}

  /**
   * Tudo o que pode acertar neste tick: cada entrada tem as caixas, o que o
   * golpe faz, para que lado empurra e o que chamar quando acerta.
   */
  getAttacks() {
    const boxes = this.getHitBoxes();
    if (boxes.length === 0) return [];

    return [{
      boxes,
      hit: this.currentMove,
      facing: this.facing,
      onHit: (impact) => this.registerHit(impact),
    }];
  }

  /**
   * Leva um golpe: perde vida, fica uns ticks sem controlo e é empurrado.
   * direction é para que lado vai: 1 = direita, -1 = esquerda. launch é a
   * velocidade vertical com que é atirado ao ar (negativa = para cima), pause
   * os ticks que o impacto o deixa parado, e fall se o golpe o derruba: sem
   * ele, quem é levantado volta a cair de pé.
   */
  receiveHit({
    damage = 0, knockback = 0, launch = 0, fall = false, stun = 0, pause = 0, direction = 1,
  }) {
    this.takeDamage(damage);
    this.hitStun = stun;
    this.knockback = knockback * direction;
    this.hitFlash = HIT_FLASH_TICKS;
    this.hitPause = pause;

    if (launch < 0) this.velocity.y = launch;
    if (fall) {
      // Um golpe que derruba sem levantar dá um pequeno salto antes da queda.
      if (launch >= 0 && this.isOnGround) this.velocity.y = TRIP_LAUNCH;
      this.isFalling = true;
    }

    // O golpe que mata derruba sempre, mesmo que não levantasse ninguém.
    if (this.isDefeated && !this.isFalling) {
      this.velocity.y = KO_LAUNCH;
      this.knockback = KO_KNOCKBACK * direction;
      this.isFalling = true;
    }
  }

  /** Chamado quando se levanta do chão depois de derrubado. */
  onGetUp() {}

  /** Devolve vida, sem passar do máximo. */
  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  /** Retira vida, sem nunca descer abaixo de zero. */
  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
  }

  jump(force) {
    // Só salta com os pés no chão — sem isto, manter a tecla premida daria
    // um salto infinito a meio do ar.
    if (this.isOnGround) {
      this.velocity.y = force;
    }
  }

  draw(ctx) {
    if (this.hidden) return;

    ctx.save();
    // Derrotado, desvanece até sumir.
    ctx.globalAlpha = Math.max(0, 1 - this.defeatTicks / DEFEAT_FADE_TICKS);
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : this.color;
    ctx.fillRect(this.position.x, this.position.y, this.width, this.height);
    ctx.restore();
  }

  update(ctx) {
    // O impacto congela o lutador: nem anda, nem cai, nem recupera.
    this.isFrozen = this.hitPause > 0;
    if (this.isFrozen) {
      this.hitPause -= 1;
      this.draw(ctx);
      return;
    }

    this.animationTime += 1;

    if (this.isDefeated) this.defeatTicks += 1;
    if (this.hitStun > 0) this.hitStun -= 1;
    if (this.hitFlash > 0) this.hitFlash -= 1;

    // Estendido no chão: passado o tempo, levanta-se. Derrotado, fica.
    if (this.downTicks > 0 && !this.isDefeated) {
      this.downTicks -= 1;
      if (this.downTicks === 0) this.onGetUp();
    }

    // O empurrão de um golpe corre à parte da velocidade, que o comando
    // repõe a zero todos os ticks.
    this.position.x += this.knockback;
    // No ar não há atrito: quem é atirado só abranda ao aterrar.
    if (this.isOnGround) this.knockback *= KNOCKBACK_FRICTION;
    if (Math.abs(this.knockback) < 0.1) this.knockback = 0;

    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;

    // Gravidade: aplicada enquanto o lutador ainda não chegou ao chão. Ao
    // aterrar, a posição é fixada para não haver afundamento nem tremor.
    if (this.position.y >= this.groundY) {
      this.position.y = this.groundY;
      this.velocity.y = 0;

      // Quem vinha atirado pelo ar fica estendido onde caiu.
      if (this.isFalling) {
        this.isFalling = false;
        this.downTicks = DOWN_TICKS;
        this.hitStun = 0;
        this.knockback *= LANDING_KNOCKBACK;
      }
    } else {
      this.velocity.y += this.gravity;
    }

    // Mantém o lutador dentro do ringue.
    this.position.x = Math.max(
      0,
      Math.min(this.position.x, this.bounds.width - this.width),
    );

    this.draw(ctx);
  }
}
