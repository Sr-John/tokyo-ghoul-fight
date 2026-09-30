/**
 * Os golpes do Kaneki, transcritos do personagem de MUGEN (Kaneki.cns e
 * common1.cns, de Rivelio). Cada entrada é um "estado" do original, com o
 * mesmo número: o que anima, como se mexe, o que faz ao acertar, que sons
 * toca e para que golpes pode encadear.
 *
 * As medidas são as do MUGEN (pixels da arte por tick, vida em 1000); quem
 * as passa para o ecrã é o MoveFighter.
 *
 * Campos de um golpe:
 *   action     número da animação
 *   physics    'S' no chão, com atrito · 'A' no ar, com gravidade · 'N' nenhuma
 *   power      energia que dá (ou tira) ao começar
 *   stop       pára o lutador ao começar
 *   loop       a animação repete em vez de acabar o golpe
 *   velocity   impulsos: [{ time | elem, x, y, from }]. `time` é o tick do
 *              golpe; `elem` o frame da animação (o 1.º é o 1), com `offset`
 *              em ticks; `from` diz de que golpes tem de vir
 *   physicsAt  trocas de física a meio: [{ time | elem, physics }]
 *   onHit      impulso no instante em que acerta
 *   onHitHold  velocidade mantida enquanto durar o golpe, depois de acertar
 *   heal       vida que o golpe devolve a quem o dá, ao acertar
 *   drag       travagem no ar ([x, a cair, a subir])
 *   sounds     [{ time | elem, sound: [grupo, número], volume, chance }]
 *   trail      golpe de kagune ou especial: deixa rasto e faíscas vermelhas
 *   dash       'ground' ou 'air': uma corrida, com o pó e o vento dela
 *   hit        o que faz ao acertar: damage, stun (ticks sem controlo), push
 *              ([x, y] dado ao adversário; x negativo afasta, y negativo
 *              levanta), fall (derruba: sem ele, quem é levantado cai de
 *              pé), pause ([ticks parado o Kaneki, ticks o adversário]), max
 *              (quantas vezes acerta), ratio (fracção da vida máxima do
 *              adversário que tira, além do dano), sounds
 *   hits       vários `hit`, cada um armado num `elem`
 *   next       o golpe que se segue a este quando acaba, sem tecla
 *   chains     encadeamentos, por ordem: [{ input, down, to, on, minTime,
 *              minElem, power }]. `on` é 'hit' ou 'contact' (tem de ter
 *              acertado); o primeiro que servir ganha
 *   projectiles  partes do golpe que vivem fora do corpo e acertam sozinhas
 *              (ver spawnProjectile, no MoveFighter)
 *   effects    o que o golpe larga só para se ver: [{ time | elem, action,
 *              atlas, at, scale, ... }] (ver spawnEffect, no MoveFighter)
 *   tick       o que não cabe nos campos acima
 */

const between = (low, high) => (previous) => previous >= low && previous <= high;
const isAttack = between(200, 499);
const fromAny = (...tests) => (previous) => tests.some((test) => test(previous));

/** Saltar ou correr a meio de um golpe que acertou. */
const cancels = (on, minElem) => [
  { input: 'jump', to: 'jump', on, minElem },
  { input: 'dash', to: 60, on, minElem, power: 750 },
];

/** Travagem no ar comum aos golpes aéreos. */
const AIR_DRAG = [0.2, 0.2, 0.15];

/** Arranque de um golpe aéreo que vem de uma investida no ar. */
const FROM_AIR_DASH = [
  { time: 0, x: 6, y: -2, from: (previous) => previous === 110 },
  { time: 0, x: -4, y: -2, from: (previous) => previous === 115 },
];

/**
 * Os especiais param o tempo ao adversário enquanto o Kaneki se prepara
 * (a "superpause" do MUGEN).
 */
export function freezeOpponent(fighter) {
  if (fighter.moveTime === 1) fighter.superPause(30);
}

const SLASH_HIT_SOUNDS = [
  { sound: [10, 136] },
  { sound: [10, 78] },
  { sound: [10, 79], volume: 0.45 },
];

export const KANEKI_CONSTANTS = {
  walk: 3.75,
  /**
   * Salto: velocidade vertical, e horizontal quando se salta com uma
   * direcção em baixo (sem direcção, sobe a direito). A horizontal está
   * abaixo da do original, que era 3.5 no chão e 3 no salto duplo e levava
   * o Kaneki longe de mais para este ringue. A vertical está um pouco acima
   * da do original (-7), para o salto ir mais alto.
   */
  jump: { x: 1.5, y: -8 },
  airJump: { x: 1.5, count: 1 },
  airDashes: 1,
  gravity: 0.45,
  friction: 0.8,
  maxPower: 3000,
  /** A vida do MUGEN vai até 1000; a do jogo até 100. */
  damageScale: 0.1,
};

export const KANEKI_MOVES = {
  // ------------------------------------------------------------ deslocação

  // Corrida: arranca e vai acelerando enquanto se segura a direcção. No
  // original fica 4 ticks parado e só depois parte, devagar; aqui sai logo
  // no primeiro tick e já lançado, para um toque na tecla ser um dash.
  60: {
    action: 100,
    dash: 'ground',
    physics: 'N',
    stop: true,
    loop: true,
    // Correr a meio de um combo gasta energia.
    power: (previous) => (isAttack(previous) ? -750 : 0),
    velocity: [{ time: 0, x: 6 }],
    sounds: [
      { time: 3, sound: [10, 20], volume: 0.75 },
      { time: 3, sound: [10, 19] },
      { time: 4, sound: [0, 18], chance: 0.5 },
    ],
    chains: [
      { input: 'a', down: true, to: 230, minTime: 5 },
      { input: 'b', down: true, to: 330, minTime: 5 },
      { input: 'c', down: true, to: 430, minTime: 5 },
      { input: 'a', to: 235, minTime: 5 },
      { input: 'b', to: 335, minTime: 5 },
      { input: 'c', to: 435, minTime: 5 },
      { input: 'jump', to: 'jump', minTime: 5 },
    ],
    tick(fighter) {
      if (fighter.forwardSpeed <= 10) fighter.forwardSpeed += 0.5;
      // Largar a direcção trava.
      if (fighter.moveTime >= 12 && !fighter.isHoldingForward) fighter.startMove(61);
    },
  },

  // Travagem da corrida.
  61: {
    action: 101,
    physics: 'S',
    velocity: [{ time: 0, x: 3 }],
    // A partir daqui já responde às teclas.
    interruptAt: 9,
    chains: [
      { input: 'a', down: true, to: 230 },
      { input: 'b', down: true, to: 330 },
      { input: 'c', down: true, to: 430 },
      { input: 'a', to: 200 },
      { input: 'b', to: 300 },
      { input: 'c', to: 400 },
    ],
  },

  // Investida no ar.
  110: {
    action: 110,
    dash: 'air',
    physics: 'N',
    velocity: [
      { elem: 2, x: 4, y: 0 },
      { elem: 6, x: 2.5 },
    ],
    physicsAt: [{ elem: 6, physics: 'A' }],
    sounds: [
      { elem: 2, sound: [10, 20], volume: 0.25 },
      { elem: 2, sound: [5, 43] },
    ],
    chains: [
      { input: 'a', to: 245, minTime: 5 },
      { input: 'b', to: 345, minTime: 5 },
    ],
    tick(fighter) {
      const time = fighter.moveTime;
      const accelerating = time > fighter.elemStart(2) && time < fighter.elemStart(4);
      const braking = time > fighter.elemStart(4) && time < fighter.elemStart(6);
      if (accelerating && fighter.forwardSpeed <= 10) fighter.forwardSpeed += 2;
      if (braking && fighter.forwardSpeed >= 1) fighter.forwardSpeed -= 1.5;
    },
  },

  // ------------------------------------------------------- combo leve (A)

  200: {
    action: 200,
    physics: 'S',
    power: 50,
    velocity: [
      { elem: 1, x: 7.5, from: (previous) => previous === 230 },
      { elem: 2, x: 2.5, from: (previous) => previous === 230 },
    ],
    sounds: [
      { time: 4, sound: [0, 0], chance: 0.5 },
      { time: 4, sound: [10, 103], volume: 0.75 },
    ],
    hit: {
      damage: 15,
      stun: 15,
      push: [-2, 0],
      pause: [6, 8],
      sounds: [{ sound: [10, 132] }, { sound: [1, 4], volume: 0.75 }],
    },
    chains: [
      { input: 'a', to: 205, on: 'contact' },
      { input: 'c', to: 400, on: 'contact' },
      ...cancels('hit'),
    ],
  },

  205: {
    action: 205,
    physics: 'S',
    power: 50,
    velocity: [
      { elem: 1, x: -2 },
      { elem: 2, x: 3.5 },
      { elem: 3, x: 1.5 },
    ],
    onHit: { x: 1.5 },
    sounds: [{ time: 4, sound: [10, 105] }],
    hit: {
      damage: 20,
      stun: 15,
      push: [-2, 0],
      pause: [8, 10],
      sounds: [{ sound: [1, 6] }, { sound: [10, 134], volume: 0.25 }],
    },
    chains: [
      { input: 'a', to: 230, on: 'contact' },
      { input: 'c', to: 400, on: 'contact' },
      ...cancels('hit'),
    ],
  },

  // Fecho do combo leve: levanta o adversário.
  210: {
    action: 210,
    physics: 'S',
    power: 50,
    velocity: [
      { elem: 2, x: -2 },
      { elem: 3, offset: 3, x: 12.5, from: (previous) => previous === 230 },
      { elem: 4, x: 7.5 },
      { elem: 4, offset: 2, x: 1.5, unlessHit: true },
    ],
    onHitHold: { x: 2.5 },
    sounds: [
      { time: 6, sound: [0, 2], chance: 0.5 },
      { time: 8, sound: [10, 107] },
      { time: 8, sound: [10, 108], volume: 0.25 },
    ],
    hit: {
      damage: 25,
      stun: 15,
      push: [-3.5, -7],
      fall: true,
      pause: [10, 8],
      sounds: [{ sound: [1, 33], volume: 0.75 }, { sound: [10, 37], volume: 0.35 }],
    },
    chains: [
      { input: 'a', to: 300, on: 'contact' },
      { input: 'c', to: 430, on: 'contact' },
      { input: 'b', to: 400, on: 'contact' },
      { input: 'jump', to: 'jump', on: 'contact', minElem: 5 },
      { input: 'dash', to: 60, on: 'hit', power: 750 },
    ],
  },

  // Baixo + A: avanço rápido com o kakugan.
  230: {
    action: 230,
    physics: 'S',
    power: 50,
    velocity: [
      { elem: 2, x: 7.5 },
      { elem: 4, x: 3.5 },
      { elem: 5, x: 1.5 },
    ],
    physicsAt: [
      { elem: 2, physics: 'N' },
      { elem: 4, physics: 'S' },
    ],
    onHit: { x: 1.5 },
    sounds: [
      { elem: 2, sound: [5, 43] },
      { time: 6, sound: [5, 4], volume: 0.75 },
      { time: 6, sound: [10, 107] },
    ],
    hit: {
      damage: 35,
      stun: 25,
      push: [-6.5, 0],
      pause: [10, 20],
      sounds: [
        { sound: [2, 3] },
        { sound: [1, 6], volume: 0.75 },
        { sound: [1, 32], volume: 0.25 },
      ],
    },
    chains: [
      { input: 'a', to: 200, on: 'contact' },
      { input: 'c', to: 400, on: 'contact' },
    ],
  },

  // A a correr: salta para cima do adversário.
  235: {
    action: 235,
    physics: 'S',
    power: 50,
    velocity: [
      { elem: 2, x: 3.5, y: -4.5 },
      { elem: 4, x: 2, y: -1 },
    ],
    physicsAt: [{ elem: 2, physics: 'A' }],
    sounds: [
      { time: 8, sound: [10, 108] },
      { time: 8, sound: [10, 123], volume: 0.75 },
    ],
    hit: {
      damage: 25,
      stun: 25,
      push: [-6.5, 10],
      fall: true,
      pause: [10, 10],
      sounds: [{ sound: [10, 37], volume: 0.75 }, { sound: [1, 34], volume: 0.75 }],
    },
  },

  // ------------------------------------------------------ combo leve no ar

  245: {
    action: 245,
    physics: 'A',
    power: 50,
    drag: AIR_DRAG,
    velocity: FROM_AIR_DASH,
    onHit: { x: 0.5, y: -2 },
    sounds: [
      { time: 4, sound: [0, 0], chance: 0.5 },
      { time: 4, sound: [10, 103], volume: 0.75 },
    ],
    hit: {
      damage: 20,
      stun: 15,
      push: [-2.5, -5],
      pause: [6, 8],
      sounds: [{ sound: [10, 132] }, { sound: [1, 4], volume: 0.75 }],
    },
    chains: [{ input: 'a', to: 250, on: 'contact' }],
  },

  250: {
    action: 250,
    physics: 'A',
    power: 50,
    velocity: [
      { time: 0, x: 2, y: -3 },
      { time: 0, x: 4, y: -3.5, from: between(345, 355) },
    ],
    onHit: { x: 1.5, y: -1.5 },
    sounds: [{ time: 4, sound: [10, 105] }],
    hit: {
      damage: 20,
      stun: 15,
      push: [-2.5, -5],
      pause: [8, 10],
      sounds: [{ sound: [1, 6] }, { sound: [10, 134], volume: 0.25 }],
    },
    chains: [{ input: 'a', to: 255, on: 'contact' }],
  },

  255: {
    action: 255,
    physics: 'A',
    power: 50,
    velocity: [
      { time: 0, x: 2, y: -3 },
      { time: 0, x: 5.5, y: -3.5, from: between(345, 355) },
    ],
    onHit: { x: 1.5, y: -1.5 },
    sounds: [
      { time: 4, sound: [0, 2], chance: 0.5 },
      { time: 8, sound: [10, 107] },
      { time: 8, sound: [10, 108], volume: 0.25 },
    ],
    hit: {
      damage: 20,
      stun: 15,
      push: [-3.5, -5.5],
      fall: true,
      pause: [10, 10],
      sounds: [{ sound: [1, 33], volume: 0.75 }, { sound: [10, 37], volume: 0.35 }],
    },
    chains: [{ input: 'a', to: 345, on: 'contact' }],
  },

  // Baixo + A no ar: atira o adversário ao chão.
  260: {
    action: 260,
    physics: 'A',
    power: 50,
    drag: AIR_DRAG,
    dragUnless: isAttack,
    velocity: [
      ...FROM_AIR_DASH,
      { time: 0, x: 4.5, y: -3.5, from: (previous) => isAttack(previous) && previous !== 255 },
      { time: 0, x: 4.5, y: -5, from: (previous) => previous === 255 },
    ],
    onHit: { x: 1.5, y: -1.5 },
    sounds: [
      { time: 8, sound: [10, 108] },
      { time: 8, sound: [10, 123], volume: 0.75 },
    ],
    hit: {
      damage: 25,
      stun: 25,
      push: [-6.5, 10],
      fall: true,
      pause: [10, 10],
      sounds: [{ sound: [10, 37], volume: 0.75 }, { sound: [1, 34], volume: 0.75 }],
    },
  },

  // ----------------------------------------------------- combo pesado (B)

  300: {
    action: 300,
    physics: 'S',
    power: 50,
    velocity: [
      { elem: 1, x: 5, from: fromAny(between(200, 299), between(400, 499)) },
      { elem: 2, x: 1.5 },
    ],
    sounds: [{ time: 2, sound: [10, 110] }],
    hit: {
      damage: 25,
      stun: 15,
      push: [-2, 0],
      pause: [6, 10],
      sounds: [{ sound: [10, 136] }, { sound: [10, 79], volume: 0.35 }],
    },
    chains: [
      { input: 'a', to: 305, on: 'contact' },
      ...cancels('contact', 2),
    ],
  },

  305: {
    action: 305,
    physics: 'S',
    power: 50,
    sounds: [{ time: 6, sound: [10, 111] }],
    hit: {
      damage: 25,
      stun: 15,
      push: [-7.5, 0],
      pause: [8, 8],
      sounds: [{ sound: [10, 137] }, { sound: [10, 79], volume: 0.35 }],
    },
    chains: [
      { input: 'a', to: 310, on: 'contact' },
      ...cancels('contact', 3),
    ],
  },

  310: {
    action: 310,
    physics: 'S',
    power: 50,
    sounds: [
      { time: 8, sound: [10, 110] },
      { time: 8, sound: [10, 67], volume: 0.5 },
      { time: 8, sound: [10, 108] },
    ],
    hit: {
      damage: 25,
      stun: 15,
      push: [-7.5, -4],
      fall: true,
      pause: [12, 15],
      sounds: SLASH_HIT_SOUNDS,
    },
    chains: [
      { input: 'a', to: 330, on: 'contact' },
      ...cancels('hit', 3),
    ],
  },

  // Baixo + B: a kagune rebenta do chão debaixo do adversário.
  330: {
    action: 330,
    physics: 'S',
    duration: 30,
    loop: true,
    spike: {
      elem: 3,
      // Sai debaixo do adversário se ele estiver perto; senão, à frente.
      reach: (previous) => (isAttack(previous) ? 125 : 75),
      lead: 25,
      fallback: 45,
      action: 332,
      endAction: 333,
      // Recolhe quando o golpe acaba.
      lifetime: 22,
      sounds: [
        { sound: [5, 75], volume: 0.3 },
        { sound: [10, 66], volume: 0.5 },
        { sound: [10, 107] },
        { sound: [10, 111] },
      ],
      hit: {
        damage: 33,
        stun: 20,
        push: [-1.5, -8],
        fall: true,
        pause: [0, 5],
        slash: true,
        sounds: SLASH_HIT_SOUNDS,
      },
    },
    chains: [
      { input: 'jump', to: 'jump', on: 'hit', minTime: 15 },
      { input: 'dash', to: 60, on: 'hit', minTime: 15, power: 750 },
    ],
  },

  // B a correr.
  335: {
    action: 335,
    physics: 'S',
    velocity: [
      { elem: 1, x: 7.5 },
      { elem: 5, x: 2.5 },
    ],
    onHit: { x: 2.5 },
    sounds: [
      { time: 2, sound: [10, 110] },
      { time: 2, sound: [10, 67], volume: 0.5 },
      { time: 2, sound: [10, 108] },
    ],
    hit: {
      damage: 25,
      stun: 25,
      push: [-6.5, -3.5],
      fall: true,
      pause: [10, 10],
      sounds: SLASH_HIT_SOUNDS,
    },
    // Retoma o combo de onde ele ia antes da corrida.
    chains: [
      { input: 'a', on: 'contact', to: (previous) => (previous === 200 ? 205 : previous === 205 ? 210 : 200) },
      { input: 'b', on: 'contact', to: (previous) => (previous === 300 ? 305 : previous === 305 ? 310 : 300) },
      { input: 'c', on: 'contact', to: (previous) => (previous === 400 ? 405 : 400) },
    ],
  },

  // ---------------------------------------------------- combo pesado no ar

  345: {
    action: 345,
    physics: 'A',
    power: 50,
    drag: AIR_DRAG,
    velocity: [
      ...FROM_AIR_DASH,
      { time: 0, x: 2, y: -4.5, from: fromAny(between(245, 260), between(445, 460)) },
    ],
    onHit: { x: 0.5, y: -2 },
    sounds: [{ time: 2, sound: [10, 110] }],
    hit: {
      damage: 25,
      stun: 15,
      push: [-5, -5],
      pause: [8, 10],
      sounds: [{ sound: [10, 136] }, { sound: [10, 79], volume: 0.35 }],
    },
    chains: [{ input: 'a', to: 350, on: 'contact' }],
  },

  350: {
    action: 350,
    physics: 'A',
    power: 50,
    velocity: [
      { time: 0, x: 2, y: -3 },
      { time: 0, x: 4, y: -3.5, from: between(345, 355) },
    ],
    onHit: { x: 1.5, y: -1.5 },
    sounds: [{ time: 6, sound: [10, 111] }],
    hit: {
      damage: 27,
      stun: 15,
      push: [-2.5, -5],
      pause: [8, 10],
      sounds: [{ sound: [10, 137] }, { sound: [10, 79], volume: 0.35 }],
    },
    chains: [{ input: 'a', to: 355, on: 'contact' }],
  },

  355: {
    action: 355,
    physics: 'A',
    power: 50,
    velocity: [
      { time: 0, x: 2, y: -3 },
      { time: 0, x: 5.5, y: -3.5, from: between(345, 355) },
    ],
    onHit: { x: 1.5, y: -1.5 },
    sounds: [
      { time: 3, sound: [10, 110] },
      { time: 3, sound: [10, 67], volume: 0.5 },
      { time: 3, sound: [10, 108] },
    ],
    hit: {
      damage: 30,
      stun: 15,
      push: [-6.5, -3.5],
      fall: true,
      pause: [10, 10],
      sounds: SLASH_HIT_SOUNDS,
    },
    chains: [{ input: 'a', to: 445, on: 'contact' }],
  },

  // ------------------------------------------------- combo de kagune (C)

  400: {
    action: 400,
    trail: true,
    physics: 'S',
    power: 50,
    velocity: [
      { time: 0, x: 3.5 },
      { time: 2, x: 1 },
    ],
    sounds: [
      { time: 5, sound: [10, 66], volume: 0.5 },
      { time: 5, sound: [10, 111] },
    ],
    hit: {
      damage: 15,
      max: 2,
      stun: 25,
      push: [-2, 0],
      pause: [7, 6],
      sounds: SLASH_HIT_SOUNDS,
    },
    chains: cancels('contact', 3),
  },

  405: {
    action: 405,
    trail: true,
    physics: 'S',
    power: 50,
    sounds: [
      { time: 8, sound: [10, 65] },
      { time: 8, sound: [10, 108] },
    ],
    hit: {
      damage: 20,
      max: 3,
      stun: 15,
      push: [-3, -6],
      fall: true,
      pause: [6, 12],
      sounds: [{ sound: [10, 78] }, { sound: [10, 137] }, { sound: [10, 79], volume: 0.4 }],
    },
    chains: cancels('hit', 4),
  },

  // Baixo + C: chicote longo que acerta duas vezes e puxa o adversário.
  430: {
    action: 430,
    trail: true,
    physics: 'S',
    power: 50,
    sounds: [
      { time: 7, sound: [10, 65], volume: 0.5 },
      { time: 7, sound: [10, 111] },
      { time: 7, sound: [10, 108] },
    ],
    hits: [
      {
        elem: 4,
        damage: 33,
        stun: 20,
        push: [-7.5, 0],
        pause: [4, 2],
        sounds: [{ sound: [10, 78] }, { sound: [10, 139] }, { sound: [10, 79], volume: 0.4 }],
      },
      { elem: 5, damage: 33, stun: 20, push: [0, 0], pause: [0, 10] },
      // O último não tira vida: traz o adversário de volta.
      { elem: 7, damage: 0, stun: 20, push: [12.5, 0], pause: [0, 2] },
    ],
    chains: [
      { input: 'a', to: 200, on: 'contact', minTime: 24 },
      { input: 'b', to: 300, on: 'contact', minTime: 24 },
    ],
  },

  // C a correr: salto com a kagune que atira o adversário ao ar.
  435: {
    action: 435,
    trail: true,
    physics: 'S',
    power: 50,
    velocity: [
      { time: 1, x: 2.5, y: -8 },
      { elem: 7, y: -4 },
    ],
    physicsAt: [{ time: 1, physics: 'A' }],
    sounds: [
      { time: 6, sound: [10, 65], volume: 0.5 },
      { time: 6, sound: [10, 67], volume: 0.4 },
      { time: 6, sound: [10, 111] },
      { time: 6, sound: [10, 108] },
    ],
    hit: {
      damage: 40,
      stun: 15,
      push: [-3.5, -10],
      fall: true,
      pause: [8, 8],
      sounds: [
        { sound: [10, 37], volume: 0.35 },
        { sound: [10, 68] },
        { sound: [10, 139] },
        { sound: [10, 79], volume: 0.5 },
      ],
    },
    chains: [{ input: 'jump', to: 'jump', on: 'contact', minElem: 5 }],
  },

  445: {
    action: 445,
    trail: true,
    physics: 'A',
    power: 50,
    drag: AIR_DRAG,
    velocity: [
      ...FROM_AIR_DASH,
      { time: 0, x: 4, y: -4, from: fromAny(between(245, 260), between(345, 360)) },
    ],
    onHit: { x: 0.5, y: -2 },
    sounds: [
      { time: 6, sound: [10, 65], volume: 0.5 },
      { time: 6, sound: [10, 67], volume: 0.4 },
      { time: 6, sound: [10, 111] },
      { time: 6, sound: [10, 108] },
    ],
    hit: {
      damage: 40,
      stun: 15,
      push: [-10, 10],
      fall: true,
      pause: [8, 12],
      sounds: [
        { sound: [10, 37], volume: 0.35 },
        { sound: [10, 78] },
        { sound: [10, 139] },
        { sound: [10, 79], volume: 0.5 },
      ],
    },
  },

  // Baixo + C no ar: a kagune a rodar, até três golpes.
  460: {
    action: 460,
    trail: true,
    physics: 'A',
    power: 50,
    drag: [0.2, 0.25, 0],
    onHit: { y: -0.5 },
    sounds: [
      { time: 6, sound: [10, 65], volume: 0.3 },
      { time: 6, sound: [10, 66], volume: 0.6 },
      { time: 6, sound: [10, 111] },
      { time: 6, sound: [10, 108], volume: 0.5 },
    ],
    hit: {
      damage: 25,
      max: 3,
      stun: 25,
      push: [-6.5, 10],
      fall: true,
      pause: [5, 10],
      sounds: SLASH_HIT_SOUNDS,
    },
  },

  // ------------------------------------------------------------- especiais

  // Binge Strike: investida que, se acertar, passa à mordida (1005).
  1000: {
    action: 1000,
    trail: true,
    physics: 'S',
    stop: true,
    power: -500,
    velocity: [
      { elem: 6, x: 5 },
      { elem: 7, x: 2.5 },
    ],
    onHit: { x: 2.5 },
    sounds: [
      { time: 0, sound: [950, 1] },
      { elem: 1, sound: [0, 5] },
      { elem: 3, sound: [0, 201] },
      { time: 32, sound: [10, 108] },
      { time: 32, sound: [10, 123] },
    ],
    hit: {
      damage: 20,
      stun: 70,
      push: [-8, 0],
      pause: [12, 8],
      sounds: [{ sound: [10, 37] }, { sound: [1, 34] }],
    },
    tick(fighter) {
      freezeOpponent(fighter);
      if (fighter.moveHit) fighter.startMove(1005);
    },
  },

  // A mordida: salta para cima do adversário, tira-lhe um bom bocado de
  // vida e devolve um quarto da barra ao Kaneki.
  1005: {
    action: 1005,
    trail: true,
    physics: 'S',
    stop: true,
    power: -500,
    velocity: [{ elem: 4, x: 2.5 }],
    heal: 250,
    sounds: [
      { elem: 2, offset: 3, sound: [5, 43] },
      { elem: 2, offset: 3, sound: [40, 3] },
      { elem: 4, sound: [0, 22] },
    ],
    hit: {
      damage: 130,
      stun: 15,
      push: [1, -2.5],
      fall: true,
      pause: [10, 20],
      sounds: [{ sound: [10, 77] }, { sound: [10, 78] }, { sound: [10, 80] }],
    },
    tick(fighter) {
      const foe = fighter.opponent;
      const time = fighter.moveTime;

      if (foe && time === fighter.elemStart(3)) fighter.jumpTo(foe, 0, -25);
      if (foe && time === fighter.elemStart(4)) fighter.jumpTo(foe, 15);
      if (time === fighter.elemStart(9)) fighter.facing *= -1;
    },
  },

  // Rinkaku Assault: salta e mergulha na diagonal com a kagune a bater sem
  // parar; ao tocar no chão, fecha com o 1205.
  1200: {
    action: 1200,
    trail: true,
    physics: 'S',
    stop: true,
    loop: true,
    power: -1000,
    velocity: [
      { elem: 3, x: 2.5, y: -9.5 },
      { elem: 6, x: 2.5, y: 2.5 },
      { elem: 7, x: 15, y: 15 },
    ],
    physicsAt: [
      { elem: 3, physics: 'A' },
      { elem: 6, physics: 'N' },
    ],
    sounds: [
      { time: 0, sound: [0, 35] },
      { time: 0, sound: [950, 1] },
      { elem: 3, sound: [40, 1] },
      { elem: 3, sound: [5, 43] },
      { elem: 3, sound: [5, 9] },
      { time: 42, sound: [10, 65] },
      { time: 42, sound: [10, 66] },
    ],
    hit: {
      damage: 10,
      max: 30,
      stun: 15,
      push: [-3, 0],
      pause: [4, 3],
      sounds: [{ sound: [10, 136] }],
    },
    tick(fighter) {
      freezeOpponent(fighter);
      if (fighter.moveTime >= fighter.elemStart(7) && fighter.isOnGround) fighter.startMove(1205);
    },
  },

  // O mesmo, começado no ar: fica um instante suspenso e mergulha.
  1201: {
    action: 1201,
    trail: true,
    physics: 'N',
    loop: true,
    power: -1000,
    velocity: [
      { time: 0, x: 0, y: 0.15 },
      { elem: 3, x: 2.5, y: 2.5 },
      { elem: 4, x: 15, y: 15 },
    ],
    sounds: [
      { time: 0, sound: [0, 35] },
      { time: 0, sound: [950, 1] },
      { time: 27, sound: [10, 65] },
      { time: 27, sound: [10, 66] },
    ],
    hit: {
      damage: 10,
      max: 30,
      stun: 15,
      push: [-3, 0],
      pause: [4, 3],
      sounds: [{ sound: [10, 136] }],
    },
    tick(fighter) {
      freezeOpponent(fighter);
      if (fighter.moveTime >= fighter.elemStart(4) && fighter.isOnGround) fighter.startMove(1205);
    },
  },

  // O fecho do Rinkaku Assault, já no chão: atira o adversário ao ar.
  1205: {
    action: 1205,
    trail: true,
    physics: 'S',
    stop: true,
    velocity: [{ time: 0, x: 2.5 }],
    hit: {
      damage: 25,
      stun: 15,
      push: [-3.5, -7.5],
      fall: true,
      pause: [10, 12],
      sounds: [{ sound: [10, 63] }, { sound: [10, 74] }, { sound: [10, 78] }, { sound: [10, 79] }],
    },
  },

  // -------------------------------------------------------------- ultimate

  // Rinkaku Kakuja - Full Kill: um golpe de kagune que, se acertar, abre a
  // cena do ultimate (ver kanekiUltimate.js). Se falhar, a energia vai-se na
  // mesma. Em treino não gasta nada.
  3000: {
    action: 3000,
    trail: true,
    physics: 'S',
    stop: true,
    power: (previous, fighter) => (fighter.training ? 0 : -1000),
    sounds: [
      { time: 0, sound: [0, 64] },
      { time: 0, sound: [950, 2] },
      { time: 33, sound: [10, 110] },
      { time: 33, sound: [10, 67] },
      { time: 33, sound: [10, 108] },
    ],
    hit: {
      damage: 0,
      stun: 25,
      push: [0, 0],
      pause: [10, 10],
      sounds: SLASH_HIT_SOUNDS,
    },
    tick(fighter) {
      freezeOpponent(fighter);

      const landed = fighter.moveHit && fighter.moveTime >= fighter.elemStart(4) + 10;
      if (landed && fighter.requestCutscene) {
        if (!fighter.training) fighter.addPower(-1000);
        fighter.finishMove();
        fighter.requestCutscene('ultimate');
      }
    },
  },

  // --------------------------------------------------------------- energia

  // Carregar: solta a kagune e enche a barra enquanto a tecla estiver em
  // baixo.
  500: {
    action: 500,
    physics: 'N',
    stop: true,
    loop: true,
    sounds: [
      { time: 10, sound: [500, 7], volume: 0.5, hold: true },
      { time: 35, sound: [500, 4], volume: 0.8, hold: true },
      { time: 180, every: 180, sound: [500, 4], volume: 0.8, hold: true },
    ],
    chains: [{ input: 'dash', to: 60, minTime: 15 }],
    tick(fighter) {
      if (fighter.moveTime >= 10) fighter.addPower(7);
      if (fighter.moveTime < 15) return;

      if (!fighter.input.s) fighter.startMove(505);
      // Barra cheia com a tecla ainda em baixo: descarga.
      else if (fighter.power >= fighter.maxPower) fighter.startMove(506);
    },
  },

  // Largou a tecla: a kagune recolhe.
  505: { action: 505, physics: 'N', stop: true },

  // Barra cheia: a kagune rebenta para fora.
  506: {
    action: 506,
    physics: 'N',
    stop: true,
    sounds: [
      { elem: 4, sound: [500, 6] },
      { elem: 4, sound: [10, 34] },
    ],
  },
};

/**
 * O ultimate só sai com a barra de energia cheia. No original exige também
 * o adversário abaixo de um terço da vida, porque é um golpe para acabar o
 * combate; aqui sai com qualquer vida, e tira o mesmo terço.
 *
 * Em modo de treino (`fighter.training`) sai sempre, sem gastar energia.
 */
function canUseUltimate(fighter) {
  return (fighter.training || fighter.power >= fighter.maxPower)
    && fighter.opponent !== null
    && !fighter.opponent.isDefeated;
}

/** Os especiais gastam um nível da barra de energia. */
export const SPECIAL_POWER = 1000;

/**
 * O que cada tecla faz quando o Kaneki está livre. A ordem conta: ganha a
 * primeira entrada que servir, por isso as combinações com direcção vêm
 * antes do botão sozinho.
 *
 *   a  soco      b  pesado      c  kagune      i  especial      s  carregar
 *   up / down    a direcção que tem de estar em baixo
 */
export const KANEKI_COMMANDS = {
  // Comandos em sequência. O do ultimate no original é frente, baixo, trás
  // e um botão; aqui o botão é o do especial.
  motions: [
    { name: 'ultimate', sequence: ['F', 'D', 'B'], button: 'i', window: 30 },
  ],
  ground: [
    { input: 's', to: 500, unlessFullPower: true },

    // Especiais: baixo é o ultimate, cima o Rinkaku Assault, sozinho o
    // Binge Strike. Baixo sem a barra cheia não faz nada.
    { input: 'ultimate', to: 3000, when: canUseUltimate },
    { input: 'i', down: true, to: 3000, when: canUseUltimate },
    { input: 'i', up: true, to: 1200, power: SPECIAL_POWER },
    { input: 'i', to: 1000, power: SPECIAL_POWER, when: (fighter) => !fighter.input.down },

    { input: 'dash', to: 60 },

    // Soco: baixo é o avanço com o kakugan, cima o gancho que levanta.
    { input: 'a', down: true, to: 230 },
    { input: 'a', up: true, to: 210 },
    { input: 'a', to: 200 },

    // Kagune: baixo é o chicote longo, cima o leque que levanta.
    { input: 'c', down: true, to: 430 },
    { input: 'c', up: true, to: 405 },
    { input: 'c', to: 400 },

    // Pesado: baixo é a kagune que rebenta do chão.
    { input: 'b', down: true, to: 330 },
    { input: 'b', to: 300 },
  ],
  air: [
    { input: 'i', to: 1201, power: SPECIAL_POWER },
    { input: 'dash', to: 110, airDash: true },
    { input: 'a', down: true, to: 260 },
    { input: 'a', to: 245 },
    { input: 'c', down: true, to: 460 },
    { input: 'c', to: 445 },
    { input: 'b', to: 345 },
  ],
};
