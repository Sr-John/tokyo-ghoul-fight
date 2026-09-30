/**
 * Os efeitos de impacto e de movimento do Kaneki: poeira, faíscas, o chão a
 * rachar, o rasto dos golpes de kagune.
 *
 * Os sprites são os do personagem de MUGEN (a pasta assets/kaneki/fx-common)
 * e os números são as acções dele. Onde o original os larga — a poeira do
 * salto, o pó e o vento da corrida, o anel da aterragem — as posições e os
 * tamanhos são os do original; as faíscas dos golpes e o chão a rachar são
 * escolhidos aqui.
 *
 * As medidas são as do MUGEN, em relação aos pés do lutador: x para a frente
 * dele, y negativo para cima.
 */

/** Os efeitos do MUGEN vêm quase todos a 78% de opacidade, somados ao fundo. */
const SOFT = { alpha: 0.78, additive: true };

/** Ticks que o rasto de um golpe leva a desaparecer. */
const GHOST_TICKS = 12;
/** Quanto dura cada cópia do borrão da corrida. */
const SPEED_GHOST_TICKS = 8;

/** O que aparece onde um golpe acerta, por tipo de golpe. */
const SPARKS = {
  // Murros e pontapés: a estrela amarela.
  punch: [{ action: 7001, scale: 0.12 }],
  // Golpes pesados: o clarão laranja e o anel de choque.
  heavy: [
    { action: 7002, scale: 0.18 },
    { action: 7024, scale: 0.15, fadeOut: 6 },
  ],
  // Espada: só o brilho do corte.
  cut: [{ action: 7015, scale: 0.16 }],
  // Kagune e especiais: faíscas vermelhas e o brilho do corte.
  slash: [
    { action: 1011, scale: 0.22 },
    { action: 7015, scale: 0.14 },
  ],
};

export class KanekiFx {
  /**
   * `effects` é a camada onde se desenham, `atlas` o CharacterAtlas com os
   * sprites e `unit` os pixels de ecrã por pixel da arte.
   */
  constructor({ effects, atlas, unit, shake = null }) {
    this.effects = effects;
    this.atlas = atlas;
    this.unit = unit;

    /** Faz o ecrã tremer: (amplitude nas medidas do MUGEN, ticks). */
    this.shake = shake;
  }

  tremble(amplitude, ticks) {
    this.shake?.(amplitude * this.unit, ticks);
  }

  /** Larga um efeito num ponto do ringue. `scale` e `velocity` nas medidas do MUGEN. */
  spawn(action, {
    x, y, scale = 1, velocity = [0, 0], facing = 1, layer = 'front', blend = null, ...options
  }) {
    const animation = this.atlas?.animation(action, { loop: false });
    if (!animation) return null;

    const [scaleX, scaleY] = Array.isArray(scale) ? scale : [scale, scale];
    return this.effects.spawn({
      animation,
      x,
      y,
      scale: [scaleX * this.unit, scaleY * this.unit],
      velocity: [velocity[0] * facing * this.unit, velocity[1] * this.unit],
      facing,
      layer,
      blend,
      ...options,
    });
  }

  /** O mesmo, mas a partir dos pés de um lutador. */
  spawnAt(fighter, action, { dx = 0, dy = 0, ...options } = {}) {
    return this.spawn(action, {
      x: fighter.position.x + fighter.width / 2 + dx * fighter.facing * this.unit,
      y: fighter.position.y + fighter.height + dy * this.unit,
      facing: fighter.facing,
      ...options,
    });
  }

  // ---------------------------------------------------------------- movimento

  /** Poeira ao sair do chão; mais inclinada se o salto for para o lado. */
  jump(fighter, moving) {
    this.spawnAt(fighter, moving ? 7026 : 7025, {
      dy: -2, scale: moving ? 0.65 : 0.5, blend: SOFT, layer: 'back',
    });
  }

  /** O anel e a poeira de quem aterra. */
  land(fighter) {
    this.spawnAt(fighter, 7021, { dx: -1, dy: 1, scale: 0.4, layer: 'back' });
    this.spawnAt(fighter, 7025, { dy: -2, scale: 0.4, blend: SOFT, layer: 'back' });
  }

  /** O arranque da corrida: a nuvem de pó atrás e o vento cortado à frente. */
  dashStart(fighter) {
    this.speedGhost(fighter);
  }

  /** A investida no ar: o mesmo borrão da corrida. */
  airDash(fighter) {
    this.speedGhost(fighter);
  }

  // ----------------------------------------------------------------- energia

  /**
   * A carregar: o chão a levantar pó aos pés, anéis a abrir, pontos de
   * energia a subir à volta do corpo e o ecrã a tremer de leve. `time` é o
   * tick do golpe; os ritmos são os do original.
   */
  charge(fighter, time) {
    if (time < 10) return;

    if (time % 15 === 10) {
      for (const dx of [10, -10]) {
        this.spawnAt(fighter, 520, { dx, dy: 2, scale: 0.35, blend: SOFT });
      }
    }
    if (time % 12 === 10) this.spawnAt(fighter, 522, { dy: 2, scale: 0.3, blend: SOFT });
    if (time % 10 === 0) this.tremble(2, 10);

    this.mote(fighter);
  }

  /** Um ponto de energia a subir devagar, algures à volta do corpo. */
  mote(fighter) {
    const drift = (Math.random() - 0.5) * 1.5;
    this.spawnAt(fighter, 519, {
      dx: -15 + Math.random() * 30,
      dy: -20 + (Math.random() * 40 - 20),
      scale: 0.0175 + Math.random() * 0.02,
      velocity: [drift, -0.5],
      layer: Math.random() < 0.5 ? 'back' : 'front',
    });
  }

  /**
   * A barra encheu: a descarga. Pó e um anel a rebentar do chão, uma onda de
   * choque à altura do peito, uma chuva de pontos de energia e o ecrã a
   * tremer a sério.
   */
  chargeBurst(fighter) {
    for (const dx of [10, -10]) {
      this.spawnAt(fighter, 521, { dx, dy: 2, scale: 0.7, blend: SOFT });
    }
    this.spawnAt(fighter, 522, { dy: 2, scale: 0.5, blend: SOFT });
    this.spawnAt(fighter, 7024, { dy: -30, scale: 0.6, fadeOut: 8 });
    for (let i = 0; i < 12; i++) this.mote(fighter);
    this.tremble(10, 15);
  }

  /** A névoa vermelha que a kagune larga ao abrir, de cada lado do corpo. */
  chargeMist(fighter) {
    for (const dx of [21, -22]) {
      this.spawnAt(fighter, 290, {
        dx, dy: -29, scale: [0.1575, 0.175], velocity: [0, -0.5], blend: { alpha: 0.8 },
      });
    }
  }

  /** A mesma névoa, mais pequena, quando a kagune recolhe. */
  chargeRelease(fighter) {
    this.spawnAt(fighter, 290, {
      dx: -3, dy: -24, scale: [0.135, 0.15], velocity: [0, -0.5],
    });
  }

  // ------------------------------------------------------------------ golpes

  /** Faíscas no ponto onde um golpe acertou. `kind` é uma entrada de SPARKS. */
  hit(point, kind, facing) {
    for (const { action, scale, fadeOut } of SPARKS[kind] ?? SPARKS.punch) {
      this.spawn(action, { x: point.x, y: point.y, scale, facing, fadeOut });
    }
  }

  /**
   * O chão a rachar: a racha fica uns instantes e some devagar, com pedras
   * a saltar e um anel de choque.
   */
  groundBreak(x, groundY, facing = 1) {
    this.spawn(7035, { x, y: groundY, scale: 0.25, facing, layer: 'back' });
    this.spawn(7033, { x, y: groundY, scale: 0.22, facing, layer: 'front', fadeOut: 8 });
    this.spawn(7024, { x, y: groundY, scale: [0.45, 0.15], facing, layer: 'back', fadeOut: 6 });
  }

  /**
   * O rasto de um golpe: uma cópia do lutador tal como está neste tick,
   * somada ao fundo, que fica para trás e se apaga.
   */
  /**
   * O borrão de quem corre: uma cópia esbatida e desfocada do lutador que
   * fica no sítio de onde ele acabou de sair e se apaga depressa.
   */
  speedGhost(fighter) {
    const animation = fighter.animator.current;
    if (!animation?.frames) return;

    this.effects.spawn({
      animation,
      frame: fighter.animator.frameIndex,
      x: fighter.position.x + fighter.width / 2,
      y: fighter.position.y + fighter.height,
      scale: [this.unit, this.unit],
      facing: fighter.facing,
      layer: 'back',
      blend: { alpha: 0.4 },
      filter: 'blur(2px)',
      duration: SPEED_GHOST_TICKS,
      fadeOut: SPEED_GHOST_TICKS,
    });
  }

  ghost(fighter) {
    const animation = fighter.animator.current;
    if (!animation?.frames) return;

    this.effects.spawn({
      animation,
      frame: fighter.animator.frameIndex,
      x: fighter.position.x + fighter.width / 2,
      y: fighter.position.y + fighter.height,
      scale: [this.unit, this.unit],
      facing: fighter.facing,
      layer: 'back',
      blend: { alpha: 0.45, additive: true },
      duration: GHOST_TICKS,
      fadeOut: GHOST_TICKS,
    });
  }
}
