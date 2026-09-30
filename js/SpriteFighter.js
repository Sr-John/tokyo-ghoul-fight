import { Fighter } from './Fighter.js';
import { Animator } from './SpriteAnimation.js';

/**
 * Lutador desenhado a partir de sprites.
 *
 * Escolhe a animação a partir do estado físico que o Fighter já calcula
 * (parado, a andar, no ar) e do ataque em curso. Enquanto as imagens não
 * carregarem — ou se faltarem — cai no desenho de reserva, o que permite
 * jogar antes de a arte estar pronta.
 */

const SHADOW_COLOR = 'rgba(0, 0, 0, 0.32)';
/** Ticks que o borrão da corrida leva a desaparecer depois de ela acabar. */
const SPEED_BLUR_TICKS = 8;
/** Cópias do corpo no borrão, e a distância entre elas (px de ecrã). */
const SPEED_BLUR_COPIES = 4;
const SPEED_BLUR_STEP = 9;
/**
 * Com `clipHitsToArt`, quanto uma caixa de ataque pode passar da arte do
 * frame, nas medidas da arte.
 */
const HIT_ART_MARGIN = 4;
/** Força do clarão de quem apanha, de 0 a 1. */
const HIT_FLASH_STRENGTH = 0.5;

export class SpriteFighter extends Fighter {
  constructor({
    animations = {},
    /** Falso para a entrada não tocar logo: quem a dispara é o jogo. */
    autoIntro = true,
    moves = {},
    sounds = {},
    playSound = null,
    spriteScale = null,
    /**
     * Corta as caixas de ataque ao que está desenhado: um golpe só acerta
     * onde se vê o braço, a perna ou a kagune.
     */
    clipHitsToArt = false,
    ...fighterOptions
  }) {
    super(fighterOptions);

    this.animator = new Animator(animations);
    this.clipHitsToArt = clipHitsToArt;

    /**
     * Ampliação da arte. Por omissão, o sprite é esticado até à altura do
     * lutador; em pixel art convém antes um valor inteiro (2, 3, 4…) para os
     * pixels não saírem tortos.
     */
    this.spriteScale = spriteScale;

    /**
     * O que cada ataque faz ao acertar, pelo nome da animação:
     * { damage, knockback, stun }. Um ataque sem entrada aqui é só animação.
     */
    this.moves = moves;

    /** Verdadeiro depois de o golpe em curso acertar: cada golpe bate uma vez. */
    this.hasHit = false;

    /**
     * Sons com hora marcada, pelo nome da animação. Cada entrada é
     * { at, sound, volume, chance, every, hold }: `at` é o tick da animação
     * em que toca, `chance` a probabilidade de tocar (0 a 1), `every` repete
     * de tantos em tantos ticks e `hold` cala-o quando a animação muda.
     */
    this.sounds = sounds;

    /** Quem toca os sons de facto: (sound, { volume }) => áudio. */
    this.playSound = playSound;

    // Animação a que os sons em curso pertencem, e os que têm de ser
    // calados quando ela acabar.
    this.soundAnimation = null;
    this.heldSounds = [];
    // Todos os que a animação actual já tocou, para os poder calar se ela
    // for interrompida à mão.
    this.cueSounds = [];

    this.isAttacking = false;

    /**
     * Animação de uma só passagem que está a tocar (um ataque, a entrada),
     * ou null. Enquanto durar, manda em tudo o resto.
     */
    this.oneShot = null;

    /** Verdadeiro enquanto a tecla de carregar estiver premida. */
    this.isCharging = false;

    /** Verdadeiro depois de ganhar o combate; `victoryTicks` conta a pose. */
    this.isVictorious = false;
    this.victoryTicks = 0;

    /** Liga o desenho das caixas de colisão, para afinar os golpes. */
    this.showBoxes = false;

    /** Ticks que ainda restam ao borrão da corrida (0 = sem borrão). */
    this.speedBlur = 0;

    // Quem tem animação de entrada abre o combate com ela.
    if (!autoIntro || !this.playOnce('intro')) this.animator.play('idle');
  }

  /**
   * Desfoca o corpo, como se ele se mexesse depressa demais para se ver:
   * chama-se a cada tick enquanto dura; depois apaga-se sozinho.
   */
  startSpeedBlur() {
    this.speedBlur = SPEED_BLUR_TICKS;
  }

  /** Verdadeiro enquanto o lutador não pode ser controlado. */
  get isBusy() {
    return super.isBusy || this.oneShot !== null || this.isCharging || this.isVictorious;
  }

  /** Verdadeiro enquanto a animação de entrada estiver a tocar. */
  get isInIntro() {
    return this.oneShot === 'intro';
  }

  /** Levanta-se do chão: toca a animação 'getUp', se a tiver. */
  onGetUp() {
    this.playOnce('getUp');
  }

  /** Corta a entrada a meio, com as falas dela, e devolve o controlo. */
  skipIntro() {
    if (!this.isInIntro) return;

    for (const audio of this.cueSounds) audio.pause();
    this.oneShot = null;
    this.animator.play('idle');
  }

  /**
   * Ganhou o combate: acaba o golpe que estiver a dar e fica na pose de
   * vitória ('win'), sem responder às teclas.
   */
  celebrate() {
    this.isVictorious = true;
    this.isCharging = false;
  }

  /**
   * Pose mantida enquanto a tecla estiver premida: toca 'charge' em ciclo e,
   * ao largar, 'chargeEnd' uma vez. Chama-se a cada tick com o estado da
   * tecla. Só arranca no chão e fora de outro golpe.
   */
  setCharging(active) {
    if (active === this.isCharging) return;

    if (!active) {
      this.isCharging = false;
      this.playOnce('chargeEnd');
      return;
    }

    if (this.oneShot || this.hitStun > 0 || this.isVictorious || !this.isOnGround) return;
    if (!this.animator.has('charge')) return;
    this.isCharging = true;
  }

  /**
   * Toca uma animação do princípio ao fim e devolve o controlo. Devolve
   * false se ela não existir ou se já houver outra a decorrer.
   */
  playOnce(name) {
    if (this.oneShot) return false;
    if (!this.animator.has(name)) return false;

    this.oneShot = name;
    this.animator.play(name, { restart: true });
    return true;
  }

  /**
   * Dispara um ataque: `name` é a animação a usar, o que permite vários
   * golpes por lutador. Ignorado se já houver um a decorrer.
   */
  attack(name = 'attack') {
    if (this.isCharging || this.hitStun > 0 || this.isVictorious) return;
    if (!this.playOnce(name)) return;

    this.isAttacking = true;
    this.currentMove = this.moves[name] ?? null;
    this.hasHit = false;
  }

  registerHit() {
    this.hasHit = true;

    for (const cue of this.currentMove?.sounds ?? []) {
      this.playSound?.(cue.sound, cue);
    }
  }

  /** Toca os sons que a animação actual tem marcados para este tick. */
  updateSounds() {
    const name = this.animator.currentName;

    if (name !== this.soundAnimation) {
      for (const audio of this.heldSounds) audio.pause();
      this.heldSounds = [];
      this.cueSounds = [];
      this.soundAnimation = name;
    }

    const tick = this.animator.tick;
    for (const cue of this.sounds[name] ?? []) {
      // O primeiro tick de uma animação é o 1.
      const at = Math.max(1, cue.at ?? 1);
      const due = tick === at
        || (cue.every && tick > at && (tick - at) % cue.every === 0);
      if (!due) continue;
      if (cue.chance !== undefined && Math.random() >= cue.chance) continue;

      const audio = this.playSound?.(cue.sound, cue);
      if (audio) this.cueSounds.push(audio);
      if (cue.hold && audio) this.heldSounds.push(audio);
    }
  }

  /** Apanhar interrompe o que o lutador estivesse a fazer. */
  receiveHit(hit) {
    super.receiveHit(hit);

    this.oneShot = null;
    this.isAttacking = false;
    this.isCharging = false;
    this.currentMove = null;
  }

  /** Ampliação com que a animação actual é desenhada. */
  get artScale() {
    return this.spriteScale
      ?? this.height / (this.animator.current?.frameHeight ?? this.height);
  }

  /**
   * Passa caixas de colisão da arte ([x1, y1, x2, y2] a partir dos pés,
   * viradas para a direita) para coordenadas do ringue.
   */
  toWorldBoxes(boxes, origin = {}) {
    const scale = this.artScale * (origin.scale ?? 1);
    // Por omissão, as caixas são do próprio lutador; `origin` serve para as
    // de algo que ele largou noutro sítio.
    const centerX = origin.x ?? this.position.x + this.width / 2;
    const feetY = origin.y ?? this.position.y + this.height;
    const facing = origin.facing ?? this.facing;

    return boxes.map(([x1, y1, x2, y2]) => {
      const left = Math.min(x1, x2);
      const right = Math.max(x1, x2);
      const top = Math.min(y1, y2);
      return {
        // Virado para a esquerda, a caixa espelha-se em torno do lutador.
        x: facing === 1 ? centerX + left * scale : centerX - right * scale,
        y: feetY + top * scale,
        width: (right - left) * scale,
        height: Math.abs(y2 - y1) * scale,
      };
    });
  }

  /** O frame que está no ecrã, com as suas caixas — ou null sem atlas. */
  get currentFrame() {
    return this.animator.current?.frames?.[this.animator.frameIndex] ?? null;
  }

  getHitBoxes() {
    if (!this.isAttacking || this.hasHit || !this.currentMove) return [];
    // Parado pelo impacto do toque anterior, o golpe não volta a acertar:
    // só bate de novo depois de se ter mexido.
    if (this.isFrozen) return [];
    return this.toWorldBoxes(this.clipToArt(this.currentFrame?.hit ?? []));
  }

  /** As caixas de ataque do frame, cortadas à arte dele (com `clipHitsToArt`). */
  clipToArt(boxes) {
    const art = this.clipHitsToArt
      ? this.animator.current?.artBounds?.(this.animator.frameIndex)
      : null;
    if (!art) return boxes;

    const [left, top, right, bottom] = [
      art[0] - HIT_ART_MARGIN, art[1] - HIT_ART_MARGIN,
      art[2] + HIT_ART_MARGIN, art[3] + HIT_ART_MARGIN,
    ];
    return boxes
      .map(([x1, y1, x2, y2]) => [
        Math.max(Math.min(x1, x2), left),
        Math.max(Math.min(y1, y2), top),
        Math.min(Math.max(x1, x2), right),
        Math.min(Math.max(y1, y2), bottom),
      ])
      .filter(([x1, y1, x2, y2]) => x2 > x1 && y2 > y1);
  }

  getHurtBoxes() {
    // A levantar-se ainda não pode ser atingido.
    if (this.isDefeated || this.downTicks > 0 || this.oneShot === 'getUp') return [];

    const boxes = this.currentFrame?.body ?? [];
    // Sem caixas na arte, vale o retângulo do lutador.
    return boxes.length ? this.toWorldBoxes(boxes) : super.getHurtBoxes();
  }

  /** Nome da animação que corresponde ao estado actual. */
  resolveAnimationName() {
    const has = (name) => this.animator.has(name);

    // Atirado pelo ar, estendido no chão, ou derrotado de vez.
    if (this.isFalling && has('hurtAir')) return 'hurtAir';
    if (this.isDefeated && this.isOnGround && has('dead')) return 'dead';
    if (this.downTicks > 0 && has('down')) return 'down';

    if (this.hitStun > 0 && this.animator.has('hurt')) return 'hurt';
    if (this.oneShot) return this.oneShot;
    if (this.isVictorious && this.animator.has('win')) return 'win';
    if (this.isCharging) return 'charge';
    if (!this.isOnGround && this.animator.animations.has('jump')) return 'jump';
    if (this.velocity.x !== 0) return 'walk';
    return 'idle';
  }

  update(ctx) {
    // Parado por um impacto: a animação também não avança.
    if (this.hitPause > 0) {
      super.update(ctx);
      return;
    }

    if (this.speedBlur > 0) this.speedBlur -= 1;

    // O ataque (ou a entrada) manda em tudo o resto até o último frame passar.
    if (this.oneShot && this.animator.isFinished) {
      this.oneShot = null;
      this.isAttacking = false;
      this.currentMove = null;
    }

    this.animator.play(this.resolveAnimationName());
    this.animator.update();
    this.updateSounds();
    if (this.animator.currentName === 'win') this.victoryTicks += 1;

    super.update(ctx);
  }

  draw(ctx) {
    if (this.hidden) return;

    this.drawGroundShadow(ctx);

    const animation = this.animator.current;

    if (!animation || !animation.ready) {
      this.drawFallback(ctx);
      return;
    }

    const scale = this.artScale;

    ctx.save();
    // Pixel art: sem interpolação, senão os pixels saem esborratados.
    ctx.imageSmoothingEnabled = false;
    // Âncora nos pés: a origem fica no chão, ao centro da hitbox, e a
    // animação desenha-se a partir daí. A hitbox não muda de tamanho com a
    // arte.
    ctx.translate(this.position.x + this.width / 2, this.position.y + this.height);
    ctx.scale(this.facing, 1);
    if (this.speedBlur > 0) this.drawSpeedBlur(ctx, animation, scale);
    else animation.draw(ctx, this.animator.frameIndex, scale);
    // O clarão de quem apanha: o mesmo frame outra vez, somado por cima.
    // A meia força, para clarear sem apagar o desenho.
    if (this.hitFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha *= HIT_FLASH_STRENGTH;
      animation.draw(ctx, this.animator.frameIndex, scale);
      ctx.restore();
    }
    if (this.showBoxes) animation.drawBoxes?.(ctx, this.animator.frameIndex, scale);
    ctx.restore();
  }

  /**
   * O corpo a correr: meio transparente e desfocado, com cópias cada vez mais
   * ténues atrás dele. Com o canvas já virado para onde ele olha, "atrás" é
   * sempre o x negativo.
   */
  drawSpeedBlur(ctx, animation, scale) {
    const strength = this.speedBlur / SPEED_BLUR_TICKS;
    const frame = this.animator.frameIndex;

    for (let i = SPEED_BLUR_COPIES; i >= 1; i -= 1) {
      ctx.save();
      ctx.translate(-i * SPEED_BLUR_STEP * strength, 0);
      ctx.globalAlpha *= 0.35 * strength * (1 - i / (SPEED_BLUR_COPIES + 1));
      ctx.filter = 'blur(3px)';
      animation.draw(ctx, frame, scale);
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha *= 1 - 0.45 * strength;
    ctx.filter = `blur(${(1.5 * strength).toFixed(2)}px)`;
    animation.draw(ctx, frame, scale);
    ctx.restore();
  }

  /**
   * Desenho usado enquanto não há sprites. Por omissão, o retângulo colorido
   * do Fighter; as subclasses substituem-no por algo melhor.
   */
  drawFallback(ctx) {
    super.draw(ctx);
  }

  /**
   * Sombra no chão, não aos pés: fica onde o lutador aterraria e encolhe com
   * a altura do salto, o que dá a leitura de quão alto ele está.
   */
  drawGroundShadow(ctx) {
    const groundY = this.bounds.groundY ?? this.bounds.height;
    const centerX = this.position.x + this.width / 2;
    const airGap = Math.max(0, groundY - (this.position.y + this.height));
    const closeness = Math.max(0, 1 - airGap / 220);

    ctx.save();
    ctx.fillStyle = SHADOW_COLOR;
    ctx.globalAlpha = 0.25 + closeness * 0.6;
    ctx.beginPath();
    ctx.ellipse(
      centerX,
      groundY - 4,
      26 * (0.5 + closeness * 0.5),
      6,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  }
}
