/**
 * Quem joga pelo adversário.
 *
 * Não mexe no lutador: devolve, a cada tick, as "teclas" que um jogador
 * estaria a premir, e o lutador trata-as como trataria as de um teclado. Por
 * isso tudo o que vale para o jogador vale para ele — os combos só encadeiam
 * se o golpe acertar, só ataca quando pode, e assim por diante.
 *
 * O comportamento é simples: aproxima-se, ataca quando chega ao alcance,
 * tenta continuar o combo se acertou, e de vez em quando recua ou salta.
 */

/** Distância (px) a que os golpes dele chegam; mais longe do que isto, aproxima-se. */
const REACH = 150;

/** A partir daqui está longe: em vez de andar, pode correr. */
const FAR = 380;

/** Ticks entre decisões: [mínimo, máximo]. Mais baixo = mais agressivo. */
const THINK_TICKS = [14, 34];

/** Probabilidades de cada decisão, quando se aplicam. */
const CHANCE = {
  dashWhenFar: 0.45,
  jumpIn: 0.1,
  retreat: 0.12,
  continueCombo: 0.7,
  idle: 0.15,
  // Com energia para isso: carregar ao longe, e os especiais ao alcance.
  charge: 0.35,
  special: 0.3,
  ultimate: 0.6,
  hinokami: 0.25,
};

/** Energia de um especial, e ticks que fica a carregar de cada vez. */
const SPECIAL_POWER = 1000;
const SUPER_POWER = 2000;
const CHARGE_TICKS = 50;

/** Com que frequência escolhe cada botão. */
const BUTTONS = ['a', 'a', 'a', 'b', 'b', 'c'];

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const between = ([low, high]) => low + Math.floor(Math.random() * (high - low + 1));

export class EnemyAi {
  constructor({ fighter, target }) {
    this.fighter = fighter;
    this.target = target;

    /** Desligada, o adversário fica parado: dá jeito para treinar combos. */
    this.enabled = true;

    // As teclas já decididas para os próximos ticks, e o que fazer quando
    // acabarem: andar para um lado até à próxima decisão.
    this.queue = [];
    this.walk = 0;
    this.wait = 0;
    this.lastButton = 'a';
  }

  /** As teclas deste tick. */
  next() {
    if (!this.enabled || this.target.isDefeated || this.fighter.isDefeated) return {};

    if (this.queue.length > 0) return this.queue.shift();

    const { fighter, target } = this;
    const gap = (target.position.x + target.width / 2) - (fighter.position.x + fighter.width / 2);
    const toward = Math.sign(gap) || 1;
    const distance = Math.abs(gap);

    // A meio de um golpe que acertou: carrega outra vez para o combo seguir.
    if (fighter.move) {
      if (fighter.moveHit && this.wait <= 0 && Math.random() < CHANCE.continueCombo) {
        this.press(this.lastButton);
        this.wait = 6;
      }
      this.wait -= 1;
      return {};
    }

    this.wait -= 1;
    if (this.wait > 0) return this.hold(this.walk);

    // Hora de decidir.
    this.wait = between(THINK_TICKS);
    this.walk = 0;

    // Com o jogador no chão ou a levantar-se, espera: não há em quem bater.
    if (target.downTicks > 0 || target.isFalling) return {};
    if (Math.random() < CHANCE.idle) return {};

    if (distance > REACH) {
      // Longe e sem a barra cheia: aproveita para respirar.
      if (distance > FAR && fighter.power < fighter.maxPower && Math.random() < CHANCE.charge) {
        for (let i = 0; i < CHARGE_TICKS; i++) this.queue.push({ s: true });
        return {};
      }
      if (distance > FAR && Math.random() < CHANCE.dashWhenFar) {
        // Corre: a tecla fica em baixo até chegar perto.
        const ticks = Math.min(40, Math.ceil((distance - REACH) / 30));
        for (let i = 0; i < ticks; i++) this.queue.push({ ...this.direction(toward), dash: true });
        return {};
      }
      if (Math.random() < CHANCE.jumpIn) {
        this.queue.push({ ...this.direction(toward), jump: true }, this.direction(toward));
        return {};
      }
      this.walk = toward;
      return this.hold(toward);
    }

    if (Math.random() < CHANCE.retreat) {
      this.walk = -toward;
      this.wait = 18;
      return this.hold(-toward);
    }

    // Ao alcance, com energia: o ultimate se a barra estiver cheia, senão
    // um dos especiais.
    const canUltimate = fighter.power >= fighter.maxPower && Math.random() < CHANCE.ultimate;
    const canSpecial = fighter.power >= SPECIAL_POWER && Math.random() < CHANCE.special;
    if (canUltimate) {
      // Um dos dois ultimates: os cortes, ou o dragão de água.
      this.queue.push(this.direction(toward));
      this.press(Math.random() < 0.5 ? 'i' : 'b', { down: true });
      return {};
    }
    // A Dança do Deus do Fogo, se ainda não a ligou e tem energia para isso.
    if (!fighter.isHinokami && fighter.power >= SPECIAL_POWER && Math.random() < CHANCE.hinokami) {
      this.press('a', { down: true });
      return {};
    }
    if (canSpecial) {
      // Um dos especiais que a energia der, à sorte: [botão, o que segura].
      const options = [
        ['i', {}],
        ['i', { up: true }],
        ['i', this.direction(toward)],
        ['b', { up: true }],
        ['b', this.direction(toward)],
        ['c', { down: true }],
        ['c', this.direction(toward)],
      ];
      if (fighter.power >= SUPER_POWER) options.push(['c', { up: true }]);

      const [button, modifier] = pick(options);
      this.queue.push(this.direction(toward));
      this.press(button, modifier);
      return {};
    }

    // Ao alcance: vira-se para o jogador e ataca.
    this.lastButton = pick(BUTTONS);
    this.queue.push(this.direction(toward));
    this.press(this.lastButton);
    return {};
  }

  direction(side) {
    return side > 0 ? { right: true } : side < 0 ? { left: true } : {};
  }

  /** Anda para um lado, mas pára ao chegar ao alcance. */
  hold(side) {
    if (side === 0) return {};

    const { fighter, target } = this;
    const gap = (target.position.x + target.width / 2) - (fighter.position.x + fighter.width / 2);
    const approaching = Math.sign(gap) === side;
    if (approaching && Math.abs(gap) <= REACH) return {};
    return this.direction(side);
  }

  /** Prime um botão: dois ticks em baixo e um solto, como um toque. */
  press(button, extra = {}) {
    this.queue.push({ ...extra, [button]: true }, { ...extra, [button]: true }, {});
  }
}
