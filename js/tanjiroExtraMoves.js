/**
 * Os golpes do Tanjiro que não estão em tanjiroMoves.js, transcritos do
 * WaterBreathing.cns com os mesmos campos dessa tabela:
 *
 *   - o corte em queda (1700–1703) e o reforço (1900, com a esquiva 900 e a
 *     corrida-relâmpago 232360), que só saem com a respiração da água;
 *   - os especiais que só existem com a Dança do Deus do Fogo ligada (no
 *     original, os estados 41000–41900 e os dois ultimates 4000 e 4100,
 *     que o .cmd guarda para Var(29) = 1).
 *
 * Os da Dança saem com as mesmas teclas dos de água que substituem no .cmd
 * original; a tabela está no fim do ficheiro.
 *
 * O arremesso da espada (41180) também está aqui: a espada voa como um
 * projéctil (a classe Tanjiro trata dela) e ele fica sem ela, com os golpes
 * de tanjiroSwordless.js, até a apanhar. E as esquivas e contra-ataques
 * automáticos da Dança (no original, HitOverrides do statedef -3): cada
 * golpe que o apanhe tem 15% de virar a esquiva por trás (41504) e outros
 * 15% de virar a guarda do contra-ataque (41500) — ver Tanjiro.receiveHit.
 *
 * Do original ficaram de fora: as versões aéreas de 41000 (41005) e o
 * 41203 (a queda entre o 41202 e o 41201, aqui seguidos); os golpes normais
 * da Dança (40200…), que no original só saem com outra variável ligada
 * (Var 22); e os ultimates do Sol (42000, 43000, 45000…), que só existem
 * depois de o Tanjiro renascer ao perder a vida (Var 39), coisa que o jogo
 * não tem.
 *
 * Campos a mais, que a classe Tanjiro trata:
 *   flames    efeitos do golpe (as chamas da Dança, sobretudo), do atlas
 *             `extra`: [{ time | elem, action, at, scale, angle, flip,
 *             bound, onOpponent, layer, blend: 'add', atlas: 'body' }].
 *             `flip` espelha-o (as
 *             explods com facing = -1 no original); `bound: false` deixa-o
 *             onde nasceu, senão segue o Tanjiro.
 *   strikes   golpes que acertam sem caixas, num tick marcado (no original
 *             são estados do adversário que lhe tiram vida a certa altura):
 *             [{ time | elem, ...hit }]
 *   pin       [x, y]: depois de acertar, o adversário fica preso a esta
 *             distância (o TargetBind)
 *   burst     ao acertar, rebenta em chamas sobre o adversário
 *   ownFire   o dano já é o da Dança: não leva a metade a mais
 *   invulnerable  não pode ser atingido
 *   counter   ticks em que um golpe recebido vira contra-ataque (`onCounter`)
 */
import { followUp, SPECIAL_POWER, ULTIMATE_POWER } from './tanjiroMoves.js';

/** O som das chamas, que quase todos os golpes da Dança tocam ao arrancar. */
const FIRE_WHOOSH = [5, 0];

/** O corte em queda gasta metade ao começar e a outra metade ao apanhar. */
const HALF_SPECIAL = SPECIAL_POWER / 2;

/** O ultimate dos cortes de fogo: o que gasta ao começar, e a pose parada. */
const FIRE_ULTIMATE_POWER = 2500;
const FIRE_ULTIMATE_FREEZE = 85;

/** O reforço: quanto dura e quanto tempo até se poder repetir (desde o início). */
export const REINFORCE_TICKS = 1200;
export const REINFORCE_COOLDOWN = 2400;
/** A pose do reforço, com o adversário parado. */
const REINFORCE_POSE = 170;

/** Atirar a espada gasta meio nível. */
const SWORD_THROW_POWER = 500;

/** A que distância (MUGEN) do centro do adversário aparece a esquiva 41504. */
const DODGE_BEHIND = 105;

/** Uma chama da Dança: a explod do original, na mesma posição, escala e rotação. */
const flame = (when, action, at, scale, angle = 0, flip = false) => ({
  ...when, action, at, scale, angle, flip,
});

/** Os quatro arcos de fogo de um corte a direito, que muitos golpes repetem. */
const straightCut = (when, size = 1) => [
  flame(when, 951, [-5, -35], [0.36 * size, 0.24 * size]),
  flame(when, 973, [-15, -15], [0.36 * size, 0.216 * size], 80),
  flame(when, 987, [15, -32], [0.36 * size, 0.3 * size]),
  flame(when, 988, [15, -32], [0.36 * size, 0.3 * size]),
];

/** Os de um corte de baixo para cima (espelhados, no original). */
const risingCut = (when) => [
  flame(when, 951, [-15, -35], [0.3, 0.2], -180, true),
  flame(when, 973, [-25, -25], [0.3, 0.18], -100, true),
  flame(when, 987, [20, -35], [0.3, 0.25], -180, true),
  flame(when, 988, [20, -35], [0.3, 0.25], -180, true),
];

/** Os de um corte de cima para baixo, largo. */
const fallingCut = (when) => [
  flame(when, 951, [35, -65], [0.6, 0.4], 90, true),
  flame(when, 973, [30, -90], [0.4, 0.36], 170, true),
  flame(when, 987, [20, -25], [0.6, 0.5], 90, true),
  flame(when, 988, [20, -25], [0.6, 0.5], 90, true),
];

/** Os de um corte em diagonal, dos golpes pesados. */
const heavyCut = (when) => [
  flame(when, 951, [25, -65], [0.45, 0.3], -120),
  flame(when, 973, [-15, -45], [0.45, 0.27], 0),
  flame(when, 987, [15, -32], [0.45, 0.375], -80),
  flame(when, 988, [15, -32], [0.45, 0.375], -80),
];

/** O pó do chão ao arrancar, do atlas do corpo. */
const dustAt = (when) => ({ ...when, action: 6120, atlas: 'body', scale: 0.3, layer: 'back' });

const isFire = (fighter) => fighter.isHinokami;
const isWater = (fighter) => !fighter.isHinokami;

/** Um corte da sequência 41000: todos param o adversário e seguem se acertarem. */
function fireCombo({ action, advance, sound, arcs, hit, next, after }) {
  return {
    action,
    ownFire: true,
    turn: true,
    trail: true,
    physics: 'S',
    stop: true,
    velocity: [{ time: 0, x: advance }],
    sounds: [
      { time: 0, sound: sound },
      { time: 0, sound: FIRE_WHOOSH, volume: 0.6 },
    ],
    flames: arcs,
    hit: { stun: 30, push: [-2, -2], spark: 'cut', ...hit },
    tick: next ? followUp(after, next) : undefined,
  };
}

const moves = {
  // ======================================================== respiração da água

  // ------------------------------------------------------ o corte em queda

  // No ar: uma aura invisível à volta dele apanha o adversário e segura-o;
  // se apanhar, o Tanjiro aparece por cima dele e desce a cortar.
  1700: {
    action: 1700,
    physics: 'A',
    trail: true,
    power: -HALF_SPECIAL,
    sounds: [{ time: 0, sound: [0, 57] }],
    projectiles: [{
      time: 0,
      action: 1750,
      atlas: 'extra',
      at: [1, -25],
      bound: true,
      armAfter: 5,
      lifetime: 30,
      // Não tira vida: prende-o no ar, parado, até ao corte.
      hit: { damage: 0, stun: 100, push: [0, 0], pause: [0, 100] },
    }],
    tick(fighter) {
      if (fighter.moveHit) fighter.startMove(1702);
    },
  },
  1702: {
    action: 1702,
    turn: true,
    trail: true,
    invulnerable: true,
    physics: 'N',
    stop: true,
    loop: true,
    duration: 120,
    power: -HALF_SPECIAL,
    sounds: [{ time: 30, sound: [0, 56] }],
    flames: [
      // O clarão por trás, quando ele se lança.
      { time: 30, action: 1708, at: [0, -60], scale: 0.3, onOpponent: true, layer: 'back' },
    ],
    velocity: [
      { time: 35, x: 30, y: 5 },
      { time: 36, x: 6, y: 5 },
    ],
    tick(fighter) {
      // Aparece à frente e acima do adversário, a 80 de cada lado.
      if (fighter.moveTime === 1 && fighter.opponent) {
        fighter.jumpTo(fighter.opponent, -80, -80);
      }
      if (fighter.moveTime > 36 && fighter.isOnGround) fighter.startMove(1703);
    },
  },
  // Aterra, e o corte chega ao adversário. No original matava-o de uma vez
  // (LifeSet 0), fosse qual fosse a vida; aqui tira um terço da vida dele.
  1703: {
    action: 17225,
    physics: 'S',
    stop: true,
    sounds: [{ time: 0, sound: [1, 37] }],
    splash: true,
    strikes: [{
      time: 20, damage: 0, ratio: 1 / 3, stun: 30, push: [-2, -6], fall: true, pause: [0, 20],
      spark: 'cut',
    }],
  },

  // ------------------------------------------------------------ o reforço

  // Uma pose longa, com o tempo parado ao adversário; depois, durante 20
  // segundos, cada golpe que o apanhe vira uma esquiva, e a corrida passa a
  // relâmpago. Só se repete 40 segundos depois de começar.
  1900: {
    action: 1900,
    physics: 'S',
    stop: true,
    breath: true,
    invulnerable: true,
    power: -SPECIAL_POWER,
    sounds: [
      { time: 0, sound: [0, 101] },
      { time: 0, sound: [500, 1] },
    ],
    tick(fighter) {
      if (fighter.moveTime === 1) {
        fighter.startReinforceCooldown?.();
        fighter.superPause(REINFORCE_POSE);
      }
      if (fighter.moveTime === 179) fighter.startReinforce?.();
    },
  },

  // A esquiva: em vez de levar o golpe, passa-lhe ao lado (gasta um pouco).
  900: {
    action: 900,
    turn: true,
    invulnerable: true,
    physics: 'S',
    stop: true,
    power: -100,
    velocity: [{ time: 4, x: 12 }],
    sounds: [
      { time: 4, sound: [40, 1] },
      { time: 4, sound: [160, 0] },
    ],
    flames: [dustAt({ time: 2 })],
  },

  // A corrida-relâmpago do reforço: sai a toda a velocidade.
  232360: {
    action: 232360,
    dash: 'ground',
    physics: 'N',
    stop: true,
    loop: true,
    velocity: [{ time: 0, x: 25 }],
    sounds: [{ time: 0, sound: [40, 1] }],
    chains: [
      { input: 'jump', to: 'jump', minTime: 3 },
      { input: 'a', to: 250, minTime: 3 },
      { input: 'b', to: 250, minTime: 3 },
      { input: 'c', to: 250, minTime: 3 },
    ],
    tick(fighter) {
      if (fighter.moveTime > 10 && !fighter.isHoldingForward) fighter.startMove(61);
    },
  },

  // ============================================== a Dança do Deus do Fogo

  // --------------------------------------- 41000: cinco cortes em chamas

  41000: {
    ...fireCombo({
      action: 400,
      advance: 0,
      sound: [0, 81],
      arcs: [
        flame({ elem: 2 }, 951, [-5, -55], [0.36, 0.19], -50),
        flame({ elem: 2 }, 973, [-15, -15], [0.36, 0.17], 70),
        dustAt({ elem: 2 }),
      ],
      hit: { damage: 50, push: [-4, 0], pause: [6, 12] },
      next: 41001,
      after: 10,
    }),
    power: -SPECIAL_POWER,
    velocity: [{ elem: 2, x: 17 }],
  },
  41001: fireCombo({
    action: 210,
    advance: 2,
    sound: [1, 36],
    arcs: [
      flame({ elem: 2 }, 951, [15, -65], [0.36, 0.24], -90),
      flame({ elem: 2 }, 973, [5, -45], [0.36, 0.216], -10),
    ],
    hit: { damage: 25, pause: [10, 10] },
    next: 41002,
    after: 11,
  }),
  41002: fireCombo({
    action: 300,
    advance: 4,
    sound: [1, 34],
    arcs: [
      flame({ elem: 2 }, 951, [-20, -55], [0.36, 0.24], -10),
      flame({ elem: 2 }, 973, [-35, -15], [0.36, 0.216], 70),
    ],
    hit: { damage: 25, pause: [10, 10] },
    next: 41003,
    after: 8,
  }),
  41003: fireCombo({
    action: 320,
    advance: 4,
    sound: [1, 34],
    arcs: [
      flame({ elem: 2 }, 951, [10, -60], [0.36, 0.33], -100),
      flame({ elem: 2 }, 973, [-5, -50], [0.36, 0.21], 0),
    ],
    hit: { damage: 25, pause: [10, 60] },
    next: 41004,
    after: 8,
  }),
  // O último: uma estocada que atravessa, e o derruba.
  41004: {
    ...fireCombo({
      action: 64310,
      advance: 0,
      sound: [1, 34],
      arcs: straightCut({ elem: 2 }),
      hit: { damage: 100, ratio: 1 / 20, push: [-2, -2], fall: true, pause: [10, 50] },
    }),
    velocity: [{ elem: 2, x: 25 }],
    burst: true,
  },

  // ------------------------------ 41100: a postura, e um de três cortes

  // Fica meio segundo em guarda: 1 dá a estocada, ↑ o corte a subir e ↓ (no
  // ar) o corte a descer. Sem tecla, sai a estocada.
  41100: {
    action: 500,
    ownFire: true,
    turn: true,
    physics: 'S',
    stop: true,
    loop: true,
    power: -SPECIAL_POWER,
    tick: fireStance(41101),
  },
  // No ar é igual, mas a estocada é o corte do ar.
  41110: {
    action: 500,
    ownFire: true,
    turn: true,
    physics: 'N',
    stop: true,
    loop: true,
    power: -SPECIAL_POWER,
    tick: fireStance(6290),
  },
  41101: {
    action: 41101,
    ownFire: true,
    turn: true,
    trail: true,
    physics: 'S',
    stop: true,
    velocity: [{ elem: 2, x: 30 }],
    sounds: [
      { time: 0, sound: [0, 68] },
      { time: 0, sound: FIRE_WHOOSH, volume: 0.6 },
      { time: 0, sound: [1, 34] },
    ],
    flames: straightCut({ elem: 2 }),
    burst: true,
    // Prende-o uns instantes e tira-lhe um nono da vida.
    hit: {
      damage: 0, ratio: 1 / 9, stun: 80, push: [-2, -2], fall: true, pause: [0, 50], spark: 'cut',
    },
  },
  41102: {
    action: 41002,
    ownFire: true,
    trail: true,
    physics: 'A',
    velocity: [{ time: 0, y: -2 }],
    onHit: { y: -5 },
    sounds: [
      { time: 0, sound: [0, 68] },
      { time: 0, sound: FIRE_WHOOSH, volume: 0.6 },
    ],
    flames: fallingCut({ elem: 2 }),
    hit: {
      damage: 0, ratio: 1 / 9, stun: 20, push: [-2, -2], fall: true, pause: [10, 50], spark: 'cut',
    },
  },
  41103: {
    action: 41003,
    ownFire: true,
    turn: true,
    trail: true,
    physics: 'S',
    stop: true,
    sounds: [
      { time: 0, sound: [0, 68] },
      { time: 0, sound: FIRE_WHOOSH, volume: 0.6 },
    ],
    flames: risingCut({ elem: 2 }),
    hit: {
      damage: 0, ratio: 1 / 9, stun: 30, push: [-2, -10], fall: true, pause: [10, 10], spark: 'cut',
    },
  },
  // O corte do ar da Dança: o do especial do ar, em chamas.
  6290: {
    action: 6280,
    ownFire: true,
    turn: true,
    trail: true,
    physics: 'A',
    loop: true,
    velocity: [{ time: 0, x: 3, y: -2 }],
    onHit: { y: -5 },
    sounds: [
      { time: 0, sound: [1, 35] },
      { elem: 2, sound: [5, 55] },
    ],
    flames: [
      flame({ elem: 2 }, 951, [15, -65], [0.36, 0.24], -90),
      flame({ elem: 2 }, 973, [5, -45], [0.36, 0.216], -10),
    ],
    hit: { damage: 150, stun: 15, push: [-4, -2], fall: true, pause: [6, 12], spark: 'cut' },
  },

  // ----------------------------------- 41150: a investida-relâmpago

  // Concentra-se meio segundo e atravessa o ecrã num relâmpago de fogo.
  41150: {
    action: 41150,
    ownFire: true,
    physics: 'S',
    stop: true,
    power: -SPECIAL_POWER,
    velocity: [
      { time: 30, x: 100 },
      { time: 40, x: 1 },
    ],
    sounds: [
      { time: 20, sound: [0, 76] },
      { time: 30, sound: [40, 2] },
    ],
    flames: [
      dustAt({ time: 30 }),
      ...[31, 33, 35, 37, 39].map((time) => (
        { time, action: 41710, at: [0, 0], scale: [0.25, 0.35], bound: false }
      )),
      ...[32, 34, 36, 38].map((time) => (
        { time, action: 14020, at: [0, 0], scale: 0.6, bound: false }
      )),
    ],
    burst: true,
    hit: { damage: 200, stun: 60, push: [-2, -2], fall: true, pause: [0, 60], spark: 'cut' },
  },

  // ---------------------------- 41200: o corte que levanta, e a queda

  // Um corte de baixo para cima; se acertar, três cortes a subir com ele e
  // um último, lá de cima, que tira um quarto da vida.
  41200: {
    action: 41503,
    ownFire: true,
    turn: true,
    trail: true,
    physics: 'S',
    stop: true,
    power: -1500,
    sounds: [
      { time: 0, sound: [0, 76] },
      { time: 0, sound: FIRE_WHOOSH, volume: 0.6 },
    ],
    flames: risingCut({ elem: 2 }),
    hit: { damage: 10, stun: 60, push: [-2, -9], pause: [0, 0], spark: 'cut' },
    tick(fighter) {
      if (fighter.moveHit) fighter.startMove(41202);
    },
  },
  41202: {
    action: 96178,
    ownFire: true,
    turn: true,
    trail: true,
    physics: 'A',
    stop: true,
    velocity: [
      // No original sobe mais (-6, -8, -8), mas a câmara do MUGEN acompanha
      // na vertical e a do jogo não: assim os dois ficam no ecrã.
      { time: 0, x: 4, y: -6 },
      { time: 4, x: 3, y: -6 },
      { time: 30, x: 3, y: -5 },
    ],
    sounds: [
      { time: 4, sound: [1, 34] },
      { time: 30, sound: [1, 34] },
      { time: 56, sound: [1, 34] },
    ],
    flames: [
      ...straightCut({ elem: 2 }),
      flame({ elem: 8 }, 951, [15, -65], [0.36, 0.24], -90),
      flame({ elem: 8 }, 973, [5, -45], [0.36, 0.216], -10),
      ...fallingCut({ elem: 14 }),
    ],
    // Em cada corte o adversário é trazido para a frente da espada (o
    // original muda-lhe a posição) e perde um octogésimo da vida.
    pulls: [{ elem: 3 }, { elem: 9 }, { elem: 14 }],
    strikes: [3, 9, 14].map((elem) => ({
      elem, damage: 0, ratio: 1 / 80, stun: 60, push: [0, 0], pause: [0, 40], spark: 'cut',
    })),
    landsInto: 41201,
    tick(fighter) {
      if (fighter.moveTime >= 66) fighter.startMove(41201);
    },
  },
  41201: {
    action: 4102,
    ownFire: true,
    invulnerable: true,
    physics: 'N',
    stop: true,
    loop: true,
    duration: 100,
    velocity: [{ time: 0, x: 0, y: 0.08 }],
    pulls: [{ time: 49 }],
    sounds: [{ time: 50, sound: [5, 28] }],
    flames: [
      { time: 50, action: 4150, at: [0, -20], scale: 0.15, blend: 'add' },
      { time: 50, action: 3903, at: [0, -3], scale: 0.6, bound: false },
      { time: 50, action: 4026, at: [-6, -15], scale: 0.4, onOpponent: true },
    ],
    strikes: [{
      time: 50, damage: 0, ratio: 1 / 4, stun: 60, push: [-2, -4], fall: true, pause: [0, 30],
      spark: 'cut',
    }],
  },

  // ------------------------------- 41300: dois cortes pesados a correr

  41300: {
    action: 41300,
    ownFire: true,
    turn: true,
    trail: true,
    physics: 'S',
    stop: true,
    power: -SPECIAL_POWER,
    velocity: [{ elem: 2, x: 17 }],
    sounds: [{ time: 0, sound: [0, 85] }],
    flames: [
      flame({ elem: 2 }, 951, [-5, -15], [0.45, 0.3], -20),
      flame({ elem: 2 }, 973, [2, -25], [0.35, 0.27], 30),
      flame({ elem: 2 }, 987, [15, -32], [0.45, 0.375], -20),
      flame({ elem: 2 }, 988, [15, -32], [0.45, 0.375], -20),
      dustAt({ elem: 2 }),
    ],
    hit: { damage: 200, stun: 60, push: [-4, 0], pause: [6, 60], spark: 'cut' },
    tick: followUp(20, 41301),
  },
  41301: {
    action: 41301,
    ownFire: true,
    turn: true,
    trail: true,
    physics: 'S',
    stop: true,
    velocity: [{ elem: 2, x: 17 }],
    sounds: [{ time: 0, sound: FIRE_WHOOSH, volume: 0.6 }],
    flames: [...heavyCut({ elem: 2 }), dustAt({ elem: 2 })],
    burst: true,
    // Atira-o a deslizar para longe.
    hit: { damage: 200, stun: 30, push: [-16, 0], fall: true, pause: [6, 12], spark: 'cut' },
  },

  // ------------------------------ 41400: a investida pelo ar que o leva

  // Voa até ao adversário, à altura dele; se o apanha, leva-o consigo e
  // fecha com o corte que derruba.
  41400: {
    action: 41280,
    ownFire: true,
    turn: true,
    trail: true,
    physics: 'N',
    stop: true,
    loop: true,
    power: -SPECIAL_POWER,
    velocity: [{ elem: 4, x: 15 }],
    sounds: [{ elem: 4, sound: [0, 80] }],
    flames: [{ elem: 4, action: 7031, atlas: 'body', at: [-5, -23], scale: 0.3, angle: 267 }],
    pin: [25, -12],
    // Não o atira: vai preso a ele (o TargetBind) até ao corte seguinte.
    hit: { damage: 13, stun: 45, push: [0, 0], pause: [6, 5], spark: 'cut' },
    tick(fighter) {
      const { opponent } = fighter;
      // Acerta a altura pela do adversário, como o original.
      if (fighter.moveTime > 8 && opponent) {
        fighter.velocity.y = -0.15 * (fighter.position.y - opponent.position.y);
      }
      if (fighter.moveHit || fighter.moveTime >= 20) fighter.startMove(41401);
    },
  },
  41401: {
    action: 1202,
    ownFire: true,
    turn: true,
    trail: true,
    physics: 'A',
    stop: true,
    velocity: [
      { time: 5, x: 20 },
      { time: 9, x: 7 },
    ],
    flames: [{ time: 0, action: 4150, at: [0, -20], scale: 0.15, blend: 'add' }],
    burst: true,
    hit: {
      damage: 150, ratio: 1 / 20, stun: 25, push: [-3, 0], fall: true, pause: [4, 50], spark: 'cut',
      sounds: [{ sound: [1, 39] }],
    },
  },

  // ------------------------------------ 41500: o contra-ataque

  // Um segundo em guarda. Se o apanharem, desaparece, surge por trás do
  // adversário e corta-o.
  41500: {
    action: 41500,
    ownFire: true,
    physics: 'S',
    stop: true,
    power: -SPECIAL_POWER,
    counter: 60,
    onCounter: 41501,
    sounds: [{ time: 0, sound: [0, 28] }],
    flames: [
      dustAt({ time: 0 }),
      { time: 0, action: 6120, atlas: 'body', at: [10, -2], scale: 0.2, flip: true, layer: 'back' },
    ],
  },
  41501: {
    action: 41501,
    ownFire: true,
    invulnerable: true,
    physics: 'S',
    stop: true,
    sounds: [
      { time: 0, sound: [0, 78] },
      { time: 0, sound: [0, 91] },
      { elem: 7, sound: [1, 37] },
    ],
    flames: [
      { time: 0, action: 6600, at: [0, -25], scale: 0.3, bound: false },
      dustAt({ elem: 6 }),
      ...heavyCut({ elem: 7 }),
    ],
    burst: true,
    strikes: [{
      elem: 7, damage: 0, ratio: 1 / 7, stun: 30, push: [-3, -4], fall: true, pause: [6, 20],
      spark: 'cut',
    }],
    tick(fighter) {
      const { opponent } = fighter;
      if (!opponent) return;
      // Aparece do outro lado dele, e vira-se.
      if (fighter.moveTime === fighter.elemStart(5)) fighter.jumpTo(opponent, 30);
      if (fighter.moveTime === fighter.elemStart(6)) fighter.facing = -fighter.facing;
    },
  },

  // ---------------------------------------- 41600: a estocada que prende

  41600: {
    action: 41600,
    ownFire: true,
    turn: true,
    trail: true,
    physics: 'S',
    stop: true,
    loop: true,
    duration: 60,
    power: -SPECIAL_POWER,
    velocity: [{ time: 0, x: 6 }],
    sounds: [{ time: 0, sound: [0, 104] }],
    flames: [
      { time: 3, action: 14020, at: [35, -23], scale: 1 },
      { time: 3, action: 14020, at: [50, -23], scale: 0.75 },
      { time: 3, action: 14020, at: [65, -23], scale: 0.5 },
    ],
    pin: [45, 0],
    hit: {
      damage: 0, ratio: 1 / 9, stun: 70, push: [0, 0], pause: [6, 60], spark: 'cut',
      sounds: [{ sound: [4, 0] }],
    },
    tick(fighter) {
      if (fighter.moveTime >= 30 && !fighter.moveHit) fighter.finishMove();
    },
  },

  // ------------------------------------ 41700: a carga e as colunas de fogo

  // Um segundo a carregar, virado para o adversário; depois atravessa-o e,
  // se o apanhou, o chão rebenta em colunas de fogo à volta dele.
  41700: {
    action: 41700,
    ownFire: true,
    trail: true,
    physics: 'N',
    stop: true,
    power: -SPECIAL_POWER,
    velocity: [
      { time: 60, x: 30 },
      { time: 70, x: 1 },
    ],
    sounds: [{ time: 0, sound: [0, 92] }],
    flames: [{ time: 0, action: 992, at: [0, 5], scale: 0.8, layer: 'back' }],
    pin: [45, 0],
    hit: { damage: 0, ratio: 1 / 20, stun: 40, push: [0, 0], pause: [6, 40], spark: 'cut' },
    tick(fighter) {
      const { opponent } = fighter;
      if (fighter.moveTime < 60 && opponent) {
        fighter.facing = Math.sign(opponent.position.x - fighter.position.x) || fighter.facing;
      }
      if (fighter.moveHit) fighter.startMove(41701);
    },
  },
  41701: {
    action: 41701,
    ownFire: true,
    physics: 'S',
    stop: true,
    sounds: [
      { time: 0, sound: [5, 5] },
      { time: 0, sound: [0, 73] },
      { time: 30, sound: [5, 6] },
    ],
    flames: [
      { time: 30, action: 10126, at: [0, -70], scale: 0.6, onOpponent: true },
      { time: 30, action: 41710, at: [0, 0], scale: [0.5, 0.7], onOpponent: true },
      { time: 30, action: 14020, at: [0, 0], scale: 1.5, onOpponent: true },
    ],
    strikes: [{
      time: 31, damage: 0, ratio: 1 / 10, stun: 30, push: [-1, -10], fall: true, pause: [0, 10],
      spark: 'cut',
    }],
  },

  // -------------------------------------------- 41800: a roda de fogo

  // Salta a rodar sobre si, num círculo de chamas.
  41800: {
    action: 41800,
    ownFire: true,
    turn: true,
    physics: 'S',
    stop: true,
    power: -SPECIAL_POWER,
    velocity: [{ elem: 2, x: 6, y: -6 }],
    physicsAt: [{ elem: 2, physics: 'A' }],
    sounds: [
      { time: 0, sound: FIRE_WHOOSH },
      { time: 23, sound: [1, 37] },
    ],
    flames: [
      { time: 0, action: 992, at: [0, 5], scale: 0.3, bound: false, layer: 'back' },
      { time: 23, action: 3683, at: [0, 0], scale: [0.8, 1] },
      { time: 23, action: 10072, at: [0, 40], scale: [0.8, 1] },
    ],
    burst: true,
    hit: {
      damage: 30, ratio: 1 / 7, stun: 20, push: [-4, -1], fall: true, pause: [20, 30], spark: 'cut',
    },
  },

  // -------------------------------------- 41900: dois cortes, que o seguram

  // O primeiro deixa-o parado a defender-se um segundo; o segundo tira-lhe
  // um nono da vida.
  41900: {
    action: 41900,
    ownFire: true,
    turn: true,
    trail: true,
    physics: 'S',
    stop: true,
    power: -SPECIAL_POWER,
    velocity: [{ elem: 2, x: 17 }],
    sounds: [
      { time: 0, sound: FIRE_WHOOSH, volume: 0.6 },
      { elem: 5, sound: [1, 37] },
    ],
    flames: [
      { elem: 2, action: 6599, at: [15, -15], scale: 0.5 },
      dustAt({ elem: 2 }),
      ...straightCut({ elem: 5 }),
    ],
    hits: [
      { elem: 2, damage: 50, stun: 60, push: [0, 0], pause: [6, 12], spark: 'cut' },
      {
        elem: 5, damage: 50, ratio: 1 / 9, stun: 30, push: [-5, 0], pause: [6, 12], spark: 'cut',
      },
    ],
    burst: true,
  },

  // ------------------------------------------ 41180: atira a espada

  // Um corte em chamas que larga a espada a voar na direcção do adversário
  // (a classe Tanjiro trata dela). A partir daí fica sem espada.
  41180: {
    action: 41180,
    ownFire: true,
    turn: true,
    physics: 'S',
    stop: true,
    power: -SWORD_THROW_POWER,
    flames: straightCut({ elem: 3 }, 5 / 6),
    tick(fighter) {
      // Um dos dois sons do original, à sorte.
      if (fighter.moveTime === 1) fighter.playSound?.([5, Math.random() < 0.5 ? 0 : 1]);
      if (fighter.moveTime === fighter.elemStart(3)) fighter.throwSword?.();
    },
  },

  // ------------------------------- 41504: a esquiva automática da Dança

  // Some e aparece por trás do adversário, invulnerável, e vira-se para ele.
  41504: {
    action: 41502,
    ownFire: true,
    invulnerable: true,
    physics: 'S',
    stop: true,
    sounds: [{ time: 0, sound: [0, 78] }],
    tick(fighter) {
      const { opponent } = fighter;
      if (!opponent) return;
      const faceOpponent = () => {
        fighter.facing = Math.sign(opponent.position.x - fighter.position.x) || fighter.facing;
      };
      // O original põe-no a 90 do corpo do adversário, do outro lado dele.
      if (fighter.moveTime === 1) {
        faceOpponent();
        fighter.jumpTo(opponent, DODGE_BEHIND);
      }
      if (fighter.moveTime === 11) faceOpponent();
    },
  },

  // ============================================ ultimates da Dança

  // ------------------------------------------ 4000: os cortes em chamas

  // A pose, com o tempo parado; a estocada e, se acertar, três cortes, uma
  // roda de golpes que dura cinco segundos, uma investida e o fecho.
  4000: {
    action: 4000,
    ownFire: true,
    turn: true,
    trail: true,
    physics: 'S',
    stop: true,
    power: -FIRE_ULTIMATE_POWER,
    velocity: [{ elem: 2, x: 15 }],
    sounds: [
      { time: 0, sound: [0, 77] },
      { time: 0, sound: [1, 53] },
      { time: 0, sound: [1, 54] },
    ],
    flames: straightCut({ elem: 2 }),
    hit: {
      damage: 20, ratio: 1 / 200, stun: 60, push: [0, 0], pause: [32, 150], spark: 'cut',
    },
    tick(fighter) {
      if (fighter.moveTime === 1) {
        // Sem escurecer (darken = 0 no original): a fotografia do ultimate tapa o fundo.
        fighter.superPause(FIRE_ULTIMATE_FREEZE, { darken: false });
        fighter.hitPause = FIRE_ULTIMATE_FREEZE - 1;
      }
      if (fighter.moveHit) fighter.startMove(4001);
    },
  },
  4001: {
    action: 4001,
    ownFire: true,
    turn: true,
    trail: true,
    physics: 'S',
    stop: true,
    velocity: [{ time: 0, x: 10 }],
    sounds: [{ time: 0, sound: FIRE_WHOOSH, volume: 0.6 }],
    hit: { damage: 30, stun: 60, push: [0, 0], pause: [16, 30], spark: 'cut' },
    tick: followUp(22, 4002),
  },
  4002: {
    action: 4002,
    ownFire: true,
    turn: true,
    trail: true,
    physics: 'S',
    stop: true,
    flames: [{ elem: 2, action: 8043, at: [20, 10], scale: 0.5, angle: 20 }],
    hit: { damage: 30, stun: 60, push: [0, 0], pause: [20, 10], spark: 'cut' },
    tick: followUp(13, 4003),
  },
  4003: {
    action: 4003,
    ownFire: true,
    turn: true,
    trail: true,
    physics: 'S',
    stop: true,
    flames: [{ time: 0, action: 8043, at: [35, -17], scale: 0.5, angle: -112, flip: true }],
    hit: { damage: 45, stun: 60, push: [0, 0], pause: [20, 135], spark: 'cut' },
    tick: followUp(25, 4004),
  },
  // A roda: dois toques por volta, cinco segundos, com chamas à volta.
  4004: {
    action: 4004,
    ownFire: true,
    turn: true,
    physics: 'S',
    stop: true,
    loop: true,
    duration: 300,
    power: 30,
    sounds: [{ time: 0, sound: [1, 38] }],
    tick(fighter) {
      const time = fighter.moveTime;
      // A volta repete do 2.º frame (tick 11), a cada 20 ticks; os toques
      // estão no 4.º e no 8.º frames.
      const inLoop = time >= 16 && ((time - 16) % 20 === 0 || (time - 24) % 20 === 0);
      if (inLoop) {
        fighter.arm({ damage: 10, stun: 70, push: [0, 0], pause: [0, 70], spark: 'cut' });
        fighter.playSound?.([5, 34]);
      }
      if (time >= 10 && time % 4 === 0) {
        fighter.spawnFlame?.({
          action: 8043, at: [12, -30], scale: 0.45, angle: Math.random() * 360,
        });
      }
    },
    next: 4012,
  },
  4012: {
    action: 4012,
    ownFire: true,
    turn: true,
    trail: true,
    physics: 'S',
    stop: true,
    velocity: [{ time: 0, x: 14 }],
    flames: [{ time: 63, action: 4026, at: [-6, -15], scale: 0.4, flip: true, onOpponent: true }],
    hit: { damage: 60, stun: 90, push: [0, 0], pause: [20, 90], spark: 'cut' },
    next: 4013,
  },
  4013: {
    action: 4013,
    ownFire: true,
    turn: true,
    physics: 'S',
    stop: true,
    sounds: [{ time: 30, sound: [0, 55] }],
    flames: [
      { elem: 2, action: 8043, at: [0, 0], scale: 1 },
      { elem: 2, action: 8043, at: [0, -40], scale: 1, angle: 180 },
    ],
    burst: true,
    hit: {
      damage: 100, ratio: 1 / 5, stun: 30, push: [-10, -5], fall: true, pause: [0, 40], spark: 'cut',
    },
  },

  // ------------------------------------------ 4100: o corte do céu

  // Um segundo e meio parado em guarda (e o adversário também); um corte
  // rápido que o prende; depois sobe, desaparece no céu e cai sobre ele
  // num corte que lhe tira metade da vida.
  4100: {
    action: 4100,
    ownFire: true,
    physics: 'S',
    stop: true,
    power: -SPECIAL_POWER,
    sounds: [
      { time: 0, sound: [0, 61] },
      { time: 100, sound: [5, 56] },
    ],
    hit: { damage: 0, stun: 300, push: [0, 0], pause: [0, 190] },
    tick(fighter) {
      // No original é uma Pause, não uma SuperPause: pára-o, mas não escurece.
      if (fighter.moveTime === 1) fighter.superPause(100, { darken: false });
      if (fighter.moveHit) fighter.startMove(4101);
    },
  },
  4101: {
    action: 4101,
    ownFire: true,
    invulnerable: true,
    physics: 'S',
    stop: true,
    loop: true,
    duration: 150,
    power: -2000,
    breath: true,
    sounds: [
      { time: 50, sound: [0, 101] },
      { time: 105, sound: [40, 0] },
      { time: 105, sound: [40, 2] },
      { time: 135, sound: [0, 58] },
    ],
    flames: [
      dustAt({ time: 105 }),
      { time: 105, action: 6120, atlas: 'body', at: [20, 5], scale: 0.3, flip: true, layer: 'back' },
    ],
    velocity: [{ time: 105, y: -10 }],
    physicsAt: [{ time: 105, physics: 'N' }],
    next: 4102,
    tick(fighter) {
      const { opponent } = fighter;
      if (!opponent) return;
      if (fighter.moveTime === 1) opponent.hitPause = 150;
      // Lá em cima, põe-se sobre ele.
      if (fighter.moveTime === 130) {
        fighter.jumpTo(opponent, 0, -120);
        fighter.setVelocity({ x: 0, y: 0 });
      }
    },
  },
  4102: {
    action: 4102,
    ownFire: true,
    invulnerable: true,
    physics: 'N',
    stop: true,
    loop: true,
    duration: 120,
    sounds: [{ time: 50, sound: [5, 28] }],
    flames: [
      { time: 50, action: 4150, at: [0, -20], scale: 0.15, blend: 'add' },
      { time: 50, action: 4270, at: [0, 0], scale: 0.45, onOpponent: true },
      { time: 50, action: 4026, at: [-6, -15], scale: 0.4, flip: true, onOpponent: true },
    ],
    strikes: [{
      time: 50, damage: 0, ratio: 1 / 2, stun: 60, push: [-2, -6], fall: true, pause: [0, 40],
      spark: 'cut',
    }],
    tick(fighter) {
      const { opponent } = fighter;
      if (fighter.moveTime === 1 && opponent) opponent.hitPause = 60;
      // Desce até ficar a pairar um pouco acima do chão, para o corte.
      const height = (fighter.groundY - fighter.position.y) / fighter.unit;
      fighter.setVelocity({ x: 0, y: height > 31 ? 4 : 0.015 });
    },
  },
};

/**
 * A postura da Dança (41100 no chão, 41110 no ar): meio segundo à espera de
 * uma tecla. 1 dá `strike`; ↑ o corte a subir; ↓, no ar, o corte a descer.
 */
function fireStance(strike) {
  return (fighter) => {
    if (fighter.moveTime < 1) return;
    if (fighter.input.up) fighter.startMove(41103);
    else if (fighter.input.down && !fighter.isOnGround) fighter.startMove(41102);
    else if (fighter.take('a') || fighter.moveTime >= 30) fighter.startMove(strike);
  };
}

/**
 * As teclas. Os da Dança usam as dos golpes de água que substituem no
 * .cmd original; os que não têm par na água ficam nas combinações livres.
 *
 *   água           Dança                       tecla
 *   1000           41100 (postura)             5
 *   1200           41000 (cinco cortes)        ↑ + 5
 *   1300           41700 (colunas de fogo)     ← ou → + 5
 *   3000           4000  (ultimate)            ↓ + 5
 *   1400           41300 (cortes pesados)      ↑ + 6
 *   1240           41900 (dois cortes)         ← ou → + 6
 *   1800           4100  (ultimate)            ↓ + 6
 *   1410           41800 (roda de fogo)        ↑ + 4
 *   1500           41600 (estocada)            ← ou → + 4
 *   1602           41200 (corte que levanta)   ↓ + 4
 *   6280 (ar)      41110 (postura no ar)       5 no ar
 *   —              41150 (relâmpago)           ↑ + 1
 *   —              41500 (contra-ataque)       ← ou → + 1
 *   —              41400 (investida pelo ar)   ↑ + 9, ou ↓ + 6 no ar
 *   1700 (ar)      —                           ← ou → + 5 no ar
 *   1900           —                           ↑ + 1
 *   —              41180 (atira a espada)      ↓ + 9
 *
 * O 41180 é ↓ + a + b no original; o jogo não tem botões ao mesmo tempo, e
 * o ↓ + 9 estava livre (o 9 sozinho continua a carregar).
 */
const onlyFire = (extra = () => true) => (fighter) => isFire(fighter) && extra(fighter);
const notDown = (fighter) => !fighter.input.down;

const commands = {
  motions: [],
  ground: [
    // A Dança.
    { input: 'i', down: true, to: 4000, power: ULTIMATE_POWER, when: onlyFire() },
    { input: 'i', up: true, to: 41000, power: SPECIAL_POWER, when: onlyFire() },
    { input: 'i', forward: true, to: 41700, power: SPECIAL_POWER, when: onlyFire(notDown) },
    { input: 'i', to: 41100, power: SPECIAL_POWER, when: onlyFire(notDown) },
    { input: 'b', up: true, to: 41300, power: SPECIAL_POWER, when: onlyFire() },
    { input: 'b', down: true, to: 4100, power: ULTIMATE_POWER, when: onlyFire() },
    { input: 'b', forward: true, to: 41900, power: SPECIAL_POWER, when: onlyFire(notDown) },
    { input: 'c', up: true, to: 41800, power: SPECIAL_POWER, when: onlyFire() },
    { input: 'c', down: true, to: 41200, power: 1500, when: onlyFire() },
    { input: 'c', forward: true, to: 41600, power: SPECIAL_POWER, when: onlyFire(notDown) },
    { input: 'a', up: true, to: 41150, power: SPECIAL_POWER, when: onlyFire() },
    {
      input: 'a', forward: true, to: 41500, power: SPECIAL_POWER,
      when: onlyFire((fighter) => !fighter.input.down && !fighter.input.up),
    },
    { input: 's', up: true, to: 41400, power: SPECIAL_POWER, when: onlyFire() },
    { input: 's', down: true, to: 41180, power: SWORD_THROW_POWER, when: onlyFire() },

    // A água: o reforço, e a corrida dele enquanto dura.
    {
      input: 'a', up: true, to: 1900, power: SPECIAL_POWER,
      when: (fighter) => isWater(fighter) && (fighter.canReinforce ?? true),
    },
    { input: 'dash', to: 232360, when: (fighter) => Boolean(fighter.isReinforced) },
  ],
  air: [
    { input: 'i', to: 41110, power: SPECIAL_POWER, when: onlyFire() },
    { input: 'b', down: true, to: 41400, power: SPECIAL_POWER, when: onlyFire() },
    { input: 'i', forward: true, to: 1700, power: SPECIAL_POWER, when: isWater },
  ],
};

export const TANJIRO_EXTRA = { moves, commands };
