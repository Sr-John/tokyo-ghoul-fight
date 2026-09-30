/**
 * Os golpes do Tanjiro, transcritos do personagem de MUGEN "ChaosTanjiro",
 * de DrAnimation (WaterBreathing.cns e common.cns). O formato é o mesmo do
 * kanekiMoves.js, cujo cabeçalho explica os campos.
 *
 * Estão aqui os golpes normais (os três combos de espada, os aéreos, o
 * corte a correr e as corridas), o carregar da respiração, dez especiais,
 * dois ultimates e a Dança do Deus do Fogo — o modo que põe fogo na espada
 * e torna os especiais mais fortes. Do original ficaram por transcrever o
 * corte em queda e o reforço (cujos efeitos não estão no ficheiro de golpes
 * de forma que se deixe ler) e os especiais que só existem dentro da Dança.
 *
 * Um campo a mais do que no Kaneki:
 *   slash   o arco que a espada deixa no ar: { elem | time, at: [x, y],
 *           angle, action }. `at` é onde fica, a partir dos pés; `angle` a
 *           rotação em graus. No original cada golpe tem o seu.
 *
 * E nos `hit`, `spark: 'cut'` escolhe a faísca de corte de espada.
 *
 * Os especiais usam mais alguns, que a classe Tanjiro trata:
 *   breath   a respirar: larga o bafo da boca
 *   dust     levanta pó do chão num tick: { elem | time }
 *   splash   ao acertar, rebenta em água sobre o adversário
 *   closeIn  antes de bater, põe-se a essa distância do adversário
 *   turn     vira-se para o adversário ao começar (o MoveFighter trata)
 *   landsInto  o golpe acaba ao tocar no chão, e passa a este (o MoveFighter trata)
 */

/** Todos os arcos saem deslocados do mesmo tanto em relação ao ponto do golpe. */
const SLASH_OFFSET = [-23, -30];

/** O tamanho a que os arcos se desenham, em fracção do sprite. */
const SLASH_SCALE = 0.3;

/** Arco de espada: o ponto é o do original, já com o desvio comum somado. */
const slash = (elem, [x, y], angle, action = 1058) => ({
  elem,
  at: [x + SLASH_OFFSET[0], y + SLASH_OFFSET[1]],
  angle,
  action,
  scale: SLASH_SCALE,
});

const SWING = [1, 34];

/** Os especiais gastam um nível da barra; o ultimate, os três. */
const SPECIAL_POWER = 1000;
const ULTIMATE_POWER = 3000;
const SUPER_POWER = 2000;
const GRAB_POWER = 500;

/** A que distância (nas medidas do MUGEN) o corte da roda de água vira redemoinho. */
const WHEEL_RANGE = 160;

/** Os ticks em que o dragão larga ondas, e uma onda: anda sozinha e acerta de 5 em 5 ticks. */
const DRAGON_WAVE_TIMES = [1, 46, 91, 136];
const wave = (time, action, speed) => ({
  time,
  action,
  velocity: [speed, 0],
  lifetime: 60,
  every: 5,
  armAfter: 10,
  sounds: [{ sound: [5, 25], volume: 0.6 }],
  hit: { damage: 5, stun: 15, push: [-2, 0], pause: [0, 0], spark: 'cut' },
});

/** Ticks em que o ultimate pára o tempo ao adversário, com o Tanjiro em pose. */
const ULTIMATE_FREEZE = 65;

/** Segue para outro golpe se este acertou e já passou o tempo marcado. */
const followUp = (time, to) => (fighter) => {
  if (fighter.moveHit && fighter.moveTime >= time) fighter.startMove(to);
};

/** Um corte normal: quase todos só diferem no avanço, na voz e no arco. */
function cut({ action, advance, voice, swing = SWING, arc, damage = 10, pause = [8, 10], chains }) {
  return {
    action,
    physics: 'S',
    stop: true,
    power: 30,
    velocity: [{ time: 0, x: advance }],
    sounds: [
      { time: 0, sound: voice },
      { time: 0, sound: swing },
    ],
    slash: arc,
    hit: { damage, stun: 15, push: [-2, 0], pause, spark: 'cut' },
    chains,
  };
}

/** Encadeamentos de um corte: cada botão leva ao golpe seguinte do seu combo. */
const follow = (a, b, c) => [
  ...(a ? [{ input: 'a', to: a, on: 'contact' }] : []),
  ...(b ? [{ input: 'b', to: b, on: 'contact' }] : []),
  ...(c ? [{ input: 'c', to: c, on: 'contact' }] : []),
];

export const TANJIRO_CONSTANTS = {
  walk: 2.5,
  jump: { x: 3.5, y: -6 },
  airJump: { x: 0, count: 1 },
  airDashes: 1,
  gravity: 0.44,
  friction: 0.85,
  maxPower: 3000,
  // A vida do MUGEN passa para a do jogo dividida por 10; o Tanjiro bate
  // 20% mais forte do que o normal (attack = 120).
  damageScale: 0.12,
};

/** A vida dele no jogo: 1200 no original. */
export const TANJIRO_MAX_HEALTH = 120;

export const TANJIRO_MOVES = {
  // ------------------------------------------------------------ deslocação

  // Corrida: sai logo à velocidade máxima.
  60: {
    action: 100,
    dash: 'ground',
    physics: 'N',
    stop: true,
    loop: true,
    velocity: [{ time: 0, x: 10 }],
    sounds: [
      { time: 0, sound: [40, 1] },
      { elem: 3, sound: [20, 0] },
      { elem: 6, sound: [20, 0] },
    ],
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

  // Travagem.
  61: {
    action: 101,
    physics: 'S',
    velocity: [{ time: 0, x: 2 }],
    interruptAt: 5,
  },

  // Investida no ar.
  65: {
    action: 102,
    dash: 'air',
    physics: 'N',
    stop: true,
    velocity: [
      { elem: 1, x: 10 },
      { elem: 2, x: 4 },
    ],
    physicsAt: [{ elem: 2, physics: 'A' }],
    sounds: [{ time: 0, sound: [40, 2] }],
    chains: [
      { input: 'a', to: 600, minTime: 3 },
      { input: 'b', to: 610, minTime: 3 },
      { input: 'c', to: 620, minTime: 3 },
    ],
  },

  // ------------------------------------------------------------- combo A

  200: {
    ...cut({
      action: 200, advance: 2, voice: [0, 26], arc: slash(2, [22, 10], 140),
      chains: follow(210, 300, 400),
    }),
    power: 80,
  },
  210: cut({
    action: 210, advance: 2, voice: [0, 27], arc: slash(3, [18, -1], 275), damage: 15,
    chains: follow(220, 310, 410),
  }),
  220: cut({
    action: 220, advance: 2, voice: [0, 24], swing: [1, 35], pause: [12, 10],
    arc: slash(2, [75, -4], 77, 7210),
    chains: follow(230, 320, 420),
  }),

  // A rodar com a espada: dois toques fracos, e o fecho (235).
  230: {
    action: 230,
    physics: 'S',
    stop: true,
    loop: true,
    power: 30,
    velocity: [
      { elem: 4, x: 2 },
      { elem: 8, x: 2 },
    ],
    sounds: [
      { time: 0, sound: [1, 38] },
      { elem: 4, sound: [5, 34] },
      { elem: 8, sound: [5, 34] },
    ],
    hits: [
      { elem: 4, damage: 4, stun: 15, push: [-1, 0], pause: [0, 3], spark: 'cut' },
      { elem: 8, damage: 4, stun: 15, push: [-1, 0], pause: [0, 3], spark: 'cut' },
    ],
    tick(fighter) {
      // Se acertou roda mais tempo antes de fechar.
      if (fighter.moveTime > (fighter.moveHit ? 40 : 20)) fighter.startMove(235);
    },
  },

  // O fecho do combo A: atira o adversário para longe.
  235: {
    action: 235,
    physics: 'S',
    stop: true,
    power: 30,
    velocity: [{ time: 0, x: 2.5 }],
    sounds: [{ time: 0, sound: [0, 21] }],
    slash: slash(2, [22, 10], 140),
    hit: { damage: 10, stun: 15, push: [-6, -3], fall: true, pause: [10, 30], spark: 'cut' },
    chains: follow(null, 300, 400),
  },

  // Baixo + A: corte de baixo para cima, que levanta.
  240: {
    action: 240,
    physics: 'S',
    stop: true,
    power: 100,
    velocity: [{ time: 0, x: 2 }],
    sounds: [{ time: 0, sound: SWING }],
    slash: slash(2, [18, 1], 135),
    hit: { damage: 20, stun: 15, push: [-2, -7], fall: true, pause: [11, 10], spark: 'cut' },
  },

  // A correr: investida de espada à frente.
  250: {
    action: 250,
    physics: 'S',
    loop: true,
    duration: 45,
    power: 30,
    velocity: [{ time: 0, x: 20 }],
    sounds: [
      { time: 0, sound: [0, 24] },
      { time: 0, sound: [1, 35] },
    ],
    slash: {
      time: 0,
      at: [75 + SLASH_OFFSET[0], -4 + SLASH_OFFSET[1]],
      angle: 77,
      action: 7210,
      scale: SLASH_SCALE,
    },
    hit: { damage: 10, stun: 15, push: [-2, 0], pause: [12, 10], spark: 'cut' },
    chains: follow(200, 300, 400),
  },

  // ------------------------------------------------------------- combo B

  300: cut({
    action: 300, advance: 3, voice: [0, 23], swing: [1, 37], arc: slash(3, [14, 1], -4),
    chains: follow(210, 310, 410),
  }),
  310: cut({
    action: 310, advance: 3, voice: [0, 26], pause: [10, 10], arc: slash(3, [21, 15], 116),
    chains: follow(220, 320, 420),
  }),
  320: cut({
    action: 320, advance: 3, voice: [0, 25], arc: slash(3, [10, -2], 285),
    chains: follow(230, null, 400),
  }),

  // ------------------------------------------------------------- combo C

  400: {
    ...cut({
      action: 400, advance: 2, voice: [0, 25], pause: [10, 10], arc: slash(3, [34, 15], 262),
      chains: follow(null, null, 410),
    }),
    power: 80,
  },
  410: {
    ...cut({
      action: 410, advance: 4, voice: [0, 27], pause: [10, 10], arc: slash(3, [35, -1], 226),
      chains: follow(null, null, 420),
    }),
    power: 80,
  },
  420: {
    ...cut({
      action: 420, advance: 4, voice: [0, 21], pause: [11, 10], arc: slash(2, [17, -4], 243),
      chains: follow(240),
    }),
    power: 80,
  },

  // ---------------------------------------------------------------- no ar

  600: {
    action: 600,
    physics: 'A',
    power: 80,
    velocity: [{ time: 0, x: 2 }],
    onHit: { y: -3 },
    sounds: [
      { time: 0, sound: [0, 26] },
      { time: 0, sound: SWING },
    ],
    slash: slash(3, [32, 6], 140),
    hit: { damage: 20, stun: 25, push: [-3, -2], pause: [8, 9], spark: 'cut' },
    chains: follow(null, 610),
  },
  610: {
    action: 610,
    physics: 'A',
    power: 80,
    velocity: [{ time: 0, x: 2 }],
    onHit: { y: -3 },
    sounds: [
      { time: 0, sound: [0, 23] },
      { time: 0, sound: [1, 37] },
    ],
    slash: slash(3, [22, 4], 286),
    hit: { damage: 20, stun: 25, push: [-3, -2], pause: [8, 9], spark: 'cut' },
    chains: follow(null, null, 620),
  },
  620: {
    action: 620,
    physics: 'A',
    power: 80,
    velocity: [{ time: 0, x: 2 }],
    onHit: { y: -3 },
    sounds: [
      { time: 0, sound: [0, 25] },
      { time: 0, sound: SWING },
    ],
    slash: slash(3, [20, 0], 226),
    hit: { damage: 20, stun: 25, push: [-3, -2], pause: [10, 9], spark: 'cut' },
  },
};

// Os golpes abaixo juntam-se à tabela aqui, para o ficheiro se ler por ordem.
Object.assign(TANJIRO_MOVES, {
  // ------------------------------------------------------------ respiração

  // Concentração total: enche a barra enquanto a tecla estiver em baixo.
  500: {
    action: 500,
    physics: 'S',
    stop: true,
    loop: true,
    breath: true,
    sounds: [
      { time: 0, sound: [0, 101] },
      { time: 90, every: 90, sound: [500, 1], hold: true },
    ],
    chains: [{ input: 'dash', to: 60, minTime: 12 }],
    tick(fighter) {
      if (fighter.moveTime >= 7) fighter.addPower(20);
      const done = !fighter.input.s || fighter.power >= fighter.maxPower;
      if (fighter.moveTime >= 12 && done) fighter.startMove(501);
    },
  },
  501: { action: 501, physics: 'S', stop: true },

  // ----------------------------------------------- especial 1: quatro cortes

  // Investida com um corte; se acertar, seguem-se mais três sozinhos, e o
  // último é o que tira mais.
  1000: {
    action: 300,
    trail: true,
    physics: 'S',
    stop: true,
    power: -SPECIAL_POWER,
    velocity: [{ elem: 2, x: 17 }],
    sounds: [
      { time: 0, sound: [0, 19] },
      { time: 0, sound: [1, 37] },
    ],
    dust: { elem: 2 },
    slash: slash(3, [16, 5], -4),
    hit: { damage: 30, stun: 30, push: [-4, 0], pause: [6, 12], spark: 'cut' },
    tick: followUp(10, 1001),
  },
  1001: {
    action: 210,
    turn: true,
    trail: true,
    physics: 'S',
    stop: true,
    velocity: [{ time: 0, x: 2 }],
    sounds: [
      { time: 0, sound: [1, 36] },
      { time: 11, sound: [0, 29] },
    ],
    slash: slash(3, [18, -2], 275),
    hit: { damage: 20, stun: 30, push: [-2, -2], pause: [10, 10], spark: 'cut' },
    tick: followUp(11, 1002),
  },
  1002: {
    action: 300,
    turn: true,
    trail: true,
    physics: 'S',
    stop: true,
    velocity: [{ time: 0, x: 4 }],
    slash: slash(3, [16, 5], -4),
    hit: { damage: 25, stun: 60, push: [-2, -2], pause: [10, 50], spark: 'cut' },
    tick: followUp(8, 1003),
  },
  1003: {
    action: 1003,
    turn: true,
    trail: true,
    physics: 'S',
    stop: true,
    velocity: [
      { time: 30, x: 15 },
      { time: 40, x: 2 },
    ],
    splash: true,
    hit: { damage: 100, stun: 15, push: [-0.1, -6], fall: true, pause: [6, 12], spark: 'cut' },
  },

  // --------------------------------------------- especial 2: corte a subir

  // Um corte de baixo para cima que leva o adversário para o ar, e um
  // segundo, lá em cima, que o atira para longe.
  1200: { action: 1200, physics: 'S', stop: true, power: -SPECIAL_POWER, next: 1201,
    sounds: [{ time: 0, sound: [0, 30] }], dust: { time: 0 } },
  1201: {
    action: 1201,
    trail: true,
    physics: 'S',
    stop: true,
    loop: true,
    velocity: [{ elem: 3, x: 8.3, y: -5 }],
    physicsAt: [{ elem: 3, physics: 'A' }],
    slash: slash(4, [35, 35], 267, 7031),
    hit: { damage: 46, stun: 45, push: [-2, -20], pause: [6, 5], spark: 'cut' },
    tick: followUp(0, 1202),
  },
  1202: {
    action: 1202,
    trail: true,
    physics: 'A',
    velocity: [
      { time: 5, x: 20 },
      { time: 9, x: 7 },
    ],
    splash: true,
    hit: { damage: 30, stun: 25, push: [-3, 0], fall: true, pause: [4, 50], spark: 'cut' },
  },

  // -------------------------------------- especial 3: investida em quatro tempos

  // Como o primeiro, mas a acabar numa passagem que atravessa o adversário
  // e o levanta.
  1300: {
    action: 200,
    trail: true,
    physics: 'S',
    stop: true,
    power: -SPECIAL_POWER,
    velocity: [{ elem: 2, x: 17 }],
    sounds: [
      { time: 0, sound: [0, 41] },
      { time: 0, sound: [1, 37] },
    ],
    dust: { elem: 2 },
    slash: slash(2, [22, 10], 138),
    hit: { damage: 30, stun: 30, push: [-4, 0], pause: [6, 12], spark: 'cut' },
    tick: followUp(13, 1301),
  },
  1301: {
    action: 310,
    turn: true,
    trail: true,
    physics: 'S',
    stop: true,
    velocity: [{ time: 0, x: 5 }],
    sounds: [
      { time: 0, sound: [1, 36] },
      { time: 14, sound: [0, 29] },
    ],
    slash: slash(3, [21, 15], 116),
    hit: { damage: 10, stun: 30, push: [-2, -2], pause: [10, 10], spark: 'cut' },
    tick: followUp(12, 1302),
  },
  1302: {
    action: 330,
    turn: true,
    trail: true,
    physics: 'N',
    stop: true,
    velocity: [{ time: 0, x: 7 }],
    sounds: [{ time: 0, sound: SWING }],
    slash: slash(3, [23, 7], 0),
    hit: { damage: 10, stun: 50, push: [-9, 0], pause: [10, 35], spark: 'cut' },
    tick: followUp(10, 1304),
  },
  1304: {
    action: 1304,
    turn: true,
    trail: true,
    physics: 'N',
    stop: true,
    velocity: [
      { elem: 3, x: 1 },
      { elem: 5, x: 30 },
      { elem: 6, x: 30 },
    ],
    sounds: [
      { time: 0, sound: [0, 31] },
      { elem: 5, sound: [1, 36] },
      { elem: 6, sound: [1, 36] },
    ],
    splash: true,
    hit: { damage: 20, stun: 15, push: [0, -7], fall: true, pause: [5, 30], spark: 'cut' },
  },

  // ------------------------------------------ especial 4: três cortes pesados

  1400: {
    action: 1400,
    trail: true,
    physics: 'S',
    stop: true,
    power: -SPECIAL_POWER,
    velocity: [{ elem: 2, x: 17 }],
    sounds: [{ time: 0, sound: [0, 42] }],
    dust: { elem: 2 },
    slash: slash(3, [18, -2], 273),
    hit: { damage: 30, stun: 30, push: [0, 0], pause: [6, 12], spark: 'cut' },
    tick: followUp(16, 1401),
  },
  1401: {
    action: 410,
    turn: true,
    trail: true,
    physics: 'S',
    stop: true,
    velocity: [{ time: 0, x: 6 }],
    sounds: [{ time: 6, sound: [0, 33] }],
    slash: slash(3, [34, -3], 226),
    hit: { damage: 100, stun: 60, push: [-7, 0], pause: [10, 30], spark: 'cut' },
    tick: followUp(7, 1402),
  },
  // Espera, e passa pelo adversário de uma vez.
  1402: {
    action: 1402,
    turn: true,
    trail: true,
    physics: 'S',
    stop: true,
    duration: 45,
    velocity: [{ time: 30, x: 25 }],
    sounds: [
      { time: 38, sound: [0, 35] },
    ],
    splash: true,
    hit: { damage: 50, stun: 15, push: [-4, -5], fall: true, pause: [0, 30], spark: 'cut' },
  },

  // ----------------------------------------- super: os cortes pesados a dobrar

  // Gasta nível e meio e precisa de dois: cada tempo acerta duas vezes.
  1410: {
    action: 1410,
    trail: true,
    physics: 'S',
    stop: true,
    power: -1500,
    velocity: [{ elem: 2, x: 17 }],
    sounds: [{ time: 0, sound: [0, 67] }],
    dust: { elem: 2 },
    hits: [
      { time: 10, damage: 50, stun: 40, push: [0, 0], pause: [6, 12], spark: 'cut' },
      { time: 27, damage: 50, stun: 40, push: [0, 0], pause: [6, 12], spark: 'cut' },
    ],
    tick: followUp(38, 1411),
  },
  1411: {
    action: 1411,
    turn: true,
    trail: true,
    physics: 'S',
    stop: true,
    velocity: [{ time: 0, x: 6 }],
    hits: [
      { time: 5, damage: 50, stun: 60, push: [-7, 0], pause: [10, 30], spark: 'cut' },
      { time: 24, damage: 50, stun: 60, push: [-7, 0], pause: [10, 30], spark: 'cut' },
    ],
    tick: followUp(35, 1412),
  },
  1412: {
    action: 1402,
    turn: true,
    trail: true,
    physics: 'S',
    stop: true,
    duration: 45,
    velocity: [{ time: 30, x: 25 }],
    sounds: [
      { time: 38, sound: [0, 35] },
    ],
    splash: true,
    hit: { damage: 100, stun: 15, push: [-4, -5], fall: true, pause: [0, 30], spark: 'cut' },
  },

  // ------------------------------------------------------------- agarrão

  // Estocada que prende o adversário: não tem dano próprio, tira-lhe um
  // décimo da vida seja ela qual for.
  1602: {
    action: 1602,
    trail: true,
    physics: 'S',
    stop: true,
    loop: true,
    duration: 60,
    power: -GRAB_POWER,
    velocity: [{ time: 0, x: 6 }],
    hit: {
      damage: 0,
      ratio: 0.1,
      stun: 45,
      push: [-10, -10],
      fall: true,
      pause: [6, 50],
      spark: 'cut',
      sounds: [{ sound: [0, 39] }, { sound: [5, 30] }],
    },
    tick(fighter) {
      // Se não apanhou ninguém, não fica à espera.
      if (fighter.moveTime >= 30 && !fighter.moveHit) fighter.finishMove();
    },
  },

  // ---------------------------------------------------------------- no ar

  // O especial do ar: um só corte, o mais forte dele fora do ultimate.
  6280: {
    action: 6280,
    trail: true,
    physics: 'A',
    loop: true,
    power: -SPECIAL_POWER,
    onHit: { y: -5 },
    sounds: [
      { time: 0, sound: [0, 4] },
      { time: 0, sound: [1, 35] },
      { elem: 2, sound: [5, 55] },
    ],
    splash: true,
    hit: { damage: 120, stun: 15, push: [-4, -2], fall: true, pause: [6, 12], spark: 'cut' },
  },

  // Baixo + espada no ar: a rodar com a espada, até cinco toques.
  630: {
    action: 630,
    physics: 'A',
    power: 30,
    velocity: [{ time: 0, x: 2, y: -2 }],
    onHit: { x: 1.5, y: -1.5 },
    sounds: [{ time: 0, sound: [0, 20] }],
    hit: { damage: 7, max: 5, stun: 20, push: [-2, -7], fall: true, pause: [2, 2], spark: 'cut' },
  },

  // ------------------------------------------------------ a roda de água

  // Um corte que, com o adversário perto, vira redemoinho: uma coluna de
  // água à volta do Tanjiro que bate sem parar e acaba a atirá-lo ao ar.
  1500: {
    action: 340,
    trail: true,
    physics: 'S',
    stop: true,
    power: -SPECIAL_POWER,
    sounds: [
      { time: 0, sound: [0, 36] },
      { time: 0, sound: [1, 37] },
    ],
    slash: slash(3, [10, -2], 285),
    tick(fighter) {
      if (fighter.moveTime === 1 && fighter.distanceToOpponent <= WHEEL_RANGE) fighter.startMove(1503);
    },
  },
  1503: {
    action: 1500,
    trail: true,
    physics: 'S',
    stop: true,
    loop: true,
    duration: 95,
    sounds: [{ time: 20, sound: [0, 37] }],
    projectiles: [
      {
        time: 32,
        action: 1550,
        at: [-5, 0],
        bound: true,
        scale: 0.8,
        lifetime: 50,
        every: 5,
        hit: { damage: 10, stun: 15, push: [0.5, -2], fall: true, pause: [0, 0], spark: 'cut' },
        finalHit: {
          damage: 40,
          stun: 15,
          push: [-1, -10],
          fall: true,
          pause: [0, 0],
          spark: 'cut',
          sounds: [{ sound: [1, 47] }],
        },
        finalTicks: 10,
      },
      // A espuma à volta da coluna: só se vê, não acerta.
      { time: 32, action: 1557, at: [1, 10], bound: true, scale: 0.6, lifetime: 60 },
    ],
    tick(fighter) {
      if (fighter.moveTime === 1 && fighter.opponent) fighter.opponent.hitPause = 30;
    },
  },

  // ------------------------------------------------ investida pelo ar (B)

  // Atravessa o ar com a espada à frente e, se apanhar o adversário, fecha
  // com um segundo corte que o derruba.
  1240: {
    action: 1203,
    trail: true,
    physics: 'N',
    stop: true,
    power: -SPECIAL_POWER,
    velocity: [{ elem: 2, x: 10.3 }],
    sounds: [{ time: 0, sound: [0, 40] }],
    hit: { damage: 50, stun: 45, push: [-2, -10], pause: [6, 5], spark: 'cut' },
    tick: followUp(0, 1212),
  },
  1212: {
    action: 1208,
    turn: true,
    trail: true,
    physics: 'N',
    stop: true,
    duration: 40,
    velocity: [
      { elem: 1, x: 0.4 },
      { elem: 2, x: 8 },
    ],
    physicsAt: [{ elem: 2, physics: 'S' }],
    sounds: [{ time: 0, sound: [0, 84] }],
    splash: true,
    hit: { damage: 50, stun: 25, push: [-3, 0], fall: true, pause: [4, 30], spark: 'cut' },
  },

  // ------------------------------------------------- o dragão de água

  // O segundo ultimate: salta, e ao cair levanta um dragão de água que
  // prende o adversário enquanto as ondas que saem para os dois lados lhe
  // vão tirando a vida.
  1800: {
    action: 1800,
    physics: 'S',
    stop: true,
    loop: true,
    power: -ULTIMATE_POWER,
    velocity: [{ time: 20, x: 0, y: -12 }],
    physicsAt: [{ time: 20, physics: 'A' }],
    sounds: [
      { time: 0, sound: [0, 43] },
      { time: 40, sound: [0, 62] },
    ],
    // Acaba ao aterrar, que é quando o dragão nasce.
    landsInto: 1801,
  },
  1801: {
    action: 1801,
    physics: 'S',
    stop: true,
    loop: true,
    duration: 210,
    sounds: [
      { time: 0, sound: [0, 64] },
      { time: 10, sound: [5, 24] },
    ],
    projectiles: [
      {
        time: 1,
        action: 1810,
        endAction: 1811,
        lifetime: 176,
        every: 2,
        // Não tira vida: segura-o dentro do dragão.
        hit: { damage: 0, stun: 15, push: [-2, 0], pause: [0, 0] },
      },
      ...DRAGON_WAVE_TIMES.flatMap((time) => [
        wave(time, 1820, -10),
        wave(time, 1821, 10),
      ]),
    ],
  },

  // ------------------------------------------- a Dança do Deus do Fogo

  // Liga e desliga o modo: a espada passa a arder, os arcos ficam de fogo e
  // os especiais tiram metade a mais. Ligar custa um nível; desligar, nada.
  9000: {
    action: 9000,
    physics: 'S',
    stop: true,
    power: (previous, fighter) => (fighter.isHinokami ? 0 : -SPECIAL_POWER),
    sounds: [{ time: 0, sound: [0, 101] }],
    tick(fighter) {
      if (fighter.moveTime === 1 && !fighter.isHinokami) {
        if (fighter.opponent) fighter.opponent.hitPause = 45;
        fighter.showHinokamiSpotlight?.();
      }
      if (fighter.moveTime === 10) fighter.toggleHinokami();
    },
  },

  // --------------------------------------------------------------- ultimate

  // O tempo pára, o Tanjiro concentra-se e depois dá quatro cortes seguidos
  // em cima do adversário.
  3000: {
    action: 3000,
    physics: 'S',
    stop: true,
    loop: true,
    duration: ULTIMATE_FREEZE,
    power: -ULTIMATE_POWER,
    next: 3001,
    sounds: [
      { time: 0, sound: [0, 46] },
      { time: 0, sound: [1, 37] },
    ],
    tick(fighter) {
      if (fighter.moveTime === 1 && fighter.opponent) fighter.opponent.hitPause = ULTIMATE_FREEZE;
    },
  },
  3001: {
    action: 210,
    trail: true,
    physics: 'S',
    stop: true,
    // Aparece ao pé do adversário: no original o golpe vai ter com ele.
    closeIn: 30,
    velocity: [{ time: 0, x: 2 }],
    sounds: [{ time: 0, sound: [1, 36] }],
    slash: slash(3, [18, -1], 275),
    hit: { damage: 75, stun: 60, push: [-2, 0], pause: [0, 20], spark: 'cut' },
    next: 3002,
  },
  3002: {
    action: 300,
    turn: true,
    trail: true,
    physics: 'S',
    stop: true,
    velocity: [{ time: 0, x: 3 }],
    sounds: [{ time: 0, sound: [1, 37] }],
    slash: slash(3, [16, 5], -4),
    hit: { damage: 50, stun: 60, push: [-2, 0], pause: [16, 20], spark: 'cut' },
    next: 3003,
  },
  // No original este corte usa uma animação sem caixas de ataque próprias;
  // aqui é o corte de baixo para cima, que tem as dele.
  3003: {
    action: 240,
    turn: true,
    trail: true,
    physics: 'S',
    stop: true,
    sounds: [{ time: 0, sound: [0, 30] }],
    slash: slash(2, [18, 1], 135),
    hit: { damage: 25, stun: 40, push: [-2, -8], pause: [8, 12], spark: 'cut' },
    next: 3004,
  },
  3004: {
    action: 3006,
    turn: true,
    trail: true,
    physics: 'S',
    stop: true,
    velocity: [{ time: 0, x: 5 }],
    sounds: [{ time: 0, sound: [1, 36] }],
    splash: true,
    hit: { damage: 40, stun: 15, push: [-6, -4], fall: true, pause: [20, 30], spark: 'cut' },
  },
});

export const TANJIRO_COMMANDS = {
  ground: [
    { input: 's', to: 500, unlessFullPower: true },

    // Especiais, como no Kaneki: baixo é o ultimate, cima o segundo
    // especial, sozinho o primeiro. Sem energia não fazem nada.
    { input: 'i', down: true, to: 3000, power: ULTIMATE_POWER },
    { input: 'i', up: true, to: 1200, power: SPECIAL_POWER },
    { input: 'i', forward: true, to: 1300, power: SPECIAL_POWER, when: (fighter) => !fighter.input.down },
    { input: 'i', to: 1000, power: SPECIAL_POWER, when: (fighter) => !fighter.input.down },

    // Os outros botões, com uma direcção, são os especiais restantes.
    { input: 'b', up: true, to: 1400, power: SPECIAL_POWER },
    { input: 'b', down: true, to: 1800, power: ULTIMATE_POWER },
    { input: 'b', forward: true, to: 1240, power: SPECIAL_POWER, when: (fighter) => !fighter.input.down },
    { input: 'c', up: true, to: 1410, power: SUPER_POWER },
    { input: 'c', down: true, to: 1602, power: GRAB_POWER },
    { input: 'c', forward: true, to: 1500, power: SPECIAL_POWER, when: (fighter) => !fighter.input.down },

    // Baixo + soco liga e desliga a Dança do Deus do Fogo, como no original
    // (o corte que levanta continua a sair no fim do combo C).
    {
      input: 'a',
      down: true,
      to: 9000,
      when: (fighter) => fighter.isHinokami || fighter.power >= SPECIAL_POWER,
    },

    { input: 'dash', to: 60 },
    { input: 'a', down: true, to: 240 },
    { input: 'a', to: 200 },
    { input: 'b', to: 300 },
    { input: 'c', to: 400 },
  ],
  air: [
    { input: 'i', to: 6280, power: SPECIAL_POWER },
    { input: 'c', down: true, to: 630 },
    { input: 'dash', to: 65, airDash: true },
    { input: 'a', to: 600 },
    { input: 'b', to: 610 },
    { input: 'c', to: 620 },
  ],
};
