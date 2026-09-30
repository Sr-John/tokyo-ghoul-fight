/**
 * O Tanjiro sem espada: os golpes que o original (os estados 11xxx do
 * WaterBreathing.cns) lhe dá depois de a atirar com a Dança do Deus do Fogo
 * (o 41180, em tanjiroExtraMoves.js). No original é a Var(11) diferente de
 * 0; aqui é `isSwordless`, na classe Tanjiro, que trata também da espada
 * atirada (a voar, espetada no chão) e de a ir buscar.
 *
 * Sem espada, os golpes todos com ela deixam de sair (o Tanjiro.js tranca-os)
 * e estes tomam o lugar deles, com as mesmas teclas:
 *
 *   1 / 6            socos (11200…) e pontapés (11300…), que encadeiam uns
 *                    nos outros se acertarem
 *   ↓ + 1            o gancho que levanta (11240)
 *   ↓ + 6            a defesa: se lhe baterem logo a seguir, empurra-o (113350)
 *   1 / 6 no ar      os socos (11600…) e o pontapé (11610) do ar
 *   5                a corrida que o agarra e o derruba (111100)      1 nível
 *   ↑ + 5            a cabeçada, mais forte se segurar o 5 (114400)   1 nível
 *   ← ou → + 5       dez golpes seguidos, se o primeiro acertar (112200)
 *   ↑ + 6            um segundo em guarda: se lhe baterem, tira-lhe um
 *                    décimo da vida (113300)                          1 nível
 *   4                apanha a espada, se estiver ao pé dela; depois de um
 *                    golpe que acertou, volta-lhe à mão esteja onde estiver
 *                    (115500)
 *
 * Os especiais são os do original com os comandos (↓↘→ + a, ↓↙← + a,
 * ↓↘→ + b, ↓↙← + b) passados às mesmas teclas que os de água com esses
 * comandos têm no jogo. Correr, carregar a respiração e saltar também têm
 * as animações sem espada.
 *
 * Do original ficou de fora: a tontura que a cabeçada segurada deixa (um
 * helper que o prende até 10 s; aqui fica só mais tempo atordoado) e a
 * câmara lenta ao agarrar com a corrida.
 */

/** Comum a todos: não são golpes de espada, por isso a Dança não os aquece. */
const BARE = { swordless: true, ownFire: true };

const isSwordless = (fighter) => Boolean(fighter.isSwordless);

/** Um soco ou pontapé: [voz, som do golpe] ao começar, e o toque. */
function blow({ action, advance = 2, voice, swing, hit, chains, physics = 'S', ...rest }) {
  return {
    ...BARE,
    action,
    physics,
    ...(physics === 'S' ? { stop: true } : {}),
    power: 30,
    velocity: advance === null ? [] : [{ time: 0, x: advance }],
    sounds: [
      ...(voice ? [{ time: 0, sound: voice }] : []),
      ...(swing ? [{ time: 0, sound: swing }] : []),
    ],
    hit: { stun: 15, push: [-2, 0], pause: [8, 10], ...hit },
    chains,
    ...rest,
  };
}

/**
 * Os encadeamentos do chão, como no original: 1 continua os socos, 6 os
 * pontapés, ↓ + 1 o gancho e 4 traz a espada de volta. Só se acertou.
 */
const chain = ({ a, b, lowA = 11240, c = 115500, contact = true } = {}) => [
  ...(lowA ? [{ input: 'a', down: true, to: lowA, ...(contact ? { on: 'contact' } : {}) }] : []),
  ...(a ? [{ input: 'a', to: a, ...(contact ? { on: 'contact' } : {}) }] : []),
  ...(b ? [{ input: 'b', to: b, ...(contact ? { on: 'contact' } : {}) }] : []),
  ...(c ? [{ input: 'c', to: c, on: 'contact' }] : []),
];

/** Na série automática (112200…), cada golpe passa ao seguinte assim que toca. */
const onContact = (to) => (fighter) => {
  if (fighter.moveHit) fighter.startMove(to);
};

const moves = {
  // --------------------------------------------------------- deslocação

  // Correr, a investida do ar e o carregar, com a arte sem espada.
  11060: {
    ...BARE,
    action: 11100,
    dash: 'ground',
    physics: 'N',
    stop: true,
    loop: true,
    velocity: [{ time: 0, x: 10 }],
    sounds: [{ time: 0, sound: [40, 1] }],
    chains: [{ input: 'jump', to: 'jump', minTime: 3 }],
    tick(fighter) {
      if (fighter.moveTime > 10 && !fighter.isHoldingForward) fighter.finishMove();
    },
  },
  11065: {
    ...BARE,
    action: 11102,
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
      { input: 'a', to: 11600, minTime: 3 },
      { input: 'b', to: 11610, minTime: 3 },
    ],
  },
  11500: {
    ...BARE,
    action: 11500,
    physics: 'S',
    stop: true,
    loop: true,
    breath: true,
    sounds: [
      { time: 0, sound: [0, 101] },
      { time: 90, every: 90, sound: [500, 1], hold: true },
    ],
    chains: [{ input: 'dash', to: 11060, minTime: 12 }],
    tick(fighter) {
      if (fighter.moveTime >= 7) fighter.addPower(20);
      const done = !fighter.input.s || fighter.power >= fighter.maxPower;
      if (fighter.moveTime >= 12 && done) fighter.startMove(11501);
    },
  },
  11501: { ...BARE, action: 11501, physics: 'S', stop: true },

  // ------------------------------------------------------------- socos (1)

  11200: {
    ...blow({
      action: 11200, voice: [0, 26], swing: [280, 1],
      hit: { damage: 10, sounds: [{ sound: [200, 2] }] },
      chains: chain({ a: 11210, b: 11300 }),
    }),
    power: 80,
  },
  11210: blow({
    action: 11210, voice: [0, 27], swing: [200, 4],
    hit: { damage: 15, sounds: [{ sound: [201, 4] }] },
    chains: chain({ a: 11220, b: 11300 }),
  }),
  11220: {
    ...blow({
      action: 11220, voice: [0, 24], swing: [280, 1],
      hit: { damage: 10, pause: [12, 10], sounds: [{ sound: [200, 2] }] },
      chains: chain({ a: 11230, b: 11300 }),
    }),
    sounds: [
      { time: 0, sound: [0, 24] },
      { time: 0, sound: [280, 1] },
      { time: 0, sound: [5, 41] },
    ],
  },
  // Uma roda de socos: um toque a cada 8 ticks, e o soco que o atira.
  11230: {
    ...BARE,
    action: 11230,
    turn: true,
    physics: 'S',
    stop: true,
    power: 30,
    velocity: [0, 8, 16, 24].map((time) => ({ time, x: 2 })),
    sounds: [0, 8, 16, 24].map((time) => ({ time, sound: [201, 9] })),
    hits: [0, 8, 16, 24].map((time) => ({
      time, damage: 4, stun: 15, push: [-1, 0], pause: [0, 3], sounds: [{ sound: [201, 1] }],
    })),
    next: 11235,
    tick(fighter) {
      // Se o adversário se afastar, deixa de rodar.
      if (fighter.distanceToOpponent > 77) fighter.finishMove();
    },
  },
  11235: blow({
    action: 11237, advance: 2.5, voice: [0, 21], swing: [280, 1],
    hit: { damage: 10, push: [-6, -3], fall: true, pause: [10, 30], sounds: [{ sound: [201, 7] }] },
    chains: chain({ b: 11300 }),
  }),

  // O gancho (↓ + 1): levanta-o; com 2 a seguir, salta atrás dele.
  11240: {
    ...blow({
      action: 11310, advance: 3, voice: [0, 26], swing: [200, 4],
      hit: { damage: 20, push: [-2, -8], fall: true, sounds: [{ sound: [201, 1] }] },
      chains: [{ input: 'jump', to: 'jump', on: 'contact' }],
    }),
    power: 100,
  },

  // --------------------------------------------------------- pontapés (6)

  11300: {
    ...blow({
      action: 11300, advance: 3, voice: [0, 23], swing: [200, 3],
      hit: { damage: 10, sounds: [{ sound: [201, 0] }] },
      chains: chain({ a: 11210, b: 11310 }),
    }),
    sounds: [
      { time: 0, sound: [0, 23] },
      { time: 0, sound: [200, 3] },
      { time: 0, sound: [5, 41] },
    ],
  },
  11310: blow({
    action: 11310, advance: 3, voice: [0, 26], swing: [200, 4],
    hit: { damage: 10, push: [-2, -5], pause: [10, 10], sounds: [{ sound: [201, 1] }] },
    chains: chain({ a: 11200, b: 11320 }),
  }),
  // O pontapé a saltar: acerta de cima e cai de pé (11325).
  11320: {
    ...BARE,
    action: 11320,
    physics: 'S',
    stop: true,
    loop: true,
    power: 30,
    velocity: [{ time: 2, x: 3, y: -6 }],
    physicsAt: [{ time: 2, physics: 'A' }],
    sounds: [
      { time: 0, sound: [0, 25] },
      { elem: 2, sound: [201, 9] },
    ],
    hit: {
      damage: 10, stun: 15, push: [-2, 0], fall: true, pause: [8, 10], sounds: [{ sound: [201, 4] }],
    },
    landsInto: 11325,
  },
  11325: {
    ...BARE,
    action: 11325,
    turn: true,
    physics: 'S',
    stop: true,
    power: 30,
    // Ao cair de pé, os botões seguem mesmo que o pontapé não tenha acertado.
    chains: [
      { input: 'a', down: true, to: 11240 },
      { input: 'a', to: 11220 },
      { input: 'b', to: 11330 },
    ],
  },
  // O último pontapé: não tira vida, mas atira-o para longe.
  11330: {
    ...blow({
      action: 11330, advance: 3,
      hit: {
        damage: 0, push: [-7, -4], fall: true, pause: [20, 20], sounds: [{ sound: [201, 8] }],
      },
    }),
    sounds: [{ elem: 2, sound: [200, 1] }],
  },

  // ---------------------------------------------------------------- no ar

  11600: {
    ...blow({
      action: 11600, physics: 'A', voice: [0, 26], swing: [280, 1], onHit: { y: -3 },
      hit: { damage: 10, sounds: [{ sound: [200, 2] }] },
      chains: [
        { input: 'a', to: 11601, on: 'contact' },
        { input: 'b', to: 11610, on: 'contact' },
        { input: 'c', to: 115500, on: 'contact' },
      ],
    }),
    power: 80,
  },
  11601: blow({
    action: 11601, physics: 'A', voice: [0, 27], swing: [200, 4], onHit: { y: -3 },
    hit: { damage: 15, sounds: [{ sound: [201, 4] }] },
    chains: [
      { input: 'a', to: 11602, on: 'contact' },
      { input: 'b', to: 11610, on: 'contact' },
      { input: 'c', to: 115500, on: 'contact' },
    ],
  }),
  // Atira-o para o chão.
  11602: blow({
    action: 11602, physics: 'A', voice: [0, 24], swing: [280, 1],
    hit: { damage: 10, push: [-3, 0], fall: true, pause: [12, 10], sounds: [{ sound: [200, 2] }] },
  }),
  11610: blow({
    action: 11610, physics: 'A', advance: null, voice: [0, 25], onHit: { y: -3 },
    hit: { damage: 20, fall: true, sounds: [{ sound: [201, 4] }] },
  }),

  // ------------------------------------------------------------ a defesa

  // ↓ + 6: dez ticks à espera; se lhe baterem, empurra-o para trás.
  113350: {
    ...BARE,
    action: 72928,
    physics: 'S',
    stop: true,
    counter: 10,
    onCounter: 113351,
  },
  113351: {
    ...BARE,
    action: 72929,
    invulnerable: true,
    physics: 'S',
    stop: true,
    power: 50,
    pulls: [{ time: 0, at: [15, 0] }],
    sounds: [
      { time: 15, sound: [200, 4] },
      { time: 15, sound: [200, 5] },
    ],
    // No original não lhe tira vida: só o empurra e lhe gasta energia.
    strikes: [{ time: 15, damage: 0, stun: 30, push: [-4, 0], pause: [0, 0] }],
    tick(fighter) {
      if (fighter.moveTime === 15) fighter.opponent?.addPower?.(-100);
    },
  },

  // ------------------------------------------------------------ especiais

  // 5: pára o tempo, corre para ele e, se o apanha, agarra-o e derruba-o.
  111100: {
    ...BARE,
    action: 28287,
    physics: 'N',
    stop: true,
    power: -1000,
    sounds: [
      { time: 0, sound: [0, 71] },
      { time: 0, sound: [0, 88] },
      { time: 20, sound: [40, 1] },
    ],
    velocity: [{ time: 20, x: 13 }],
    hit: {
      damage: 30, ratio: 1 / 20, stun: 60, push: [0, 0], pause: [0, 25],
      sounds: [{ sound: [201, 7] }, { sound: [201, 4] }],
    },
    tick(fighter) {
      if (fighter.moveTime === 1) fighter.superPause(20, { darken: false });
      if (fighter.moveTime > 20 && fighter.moveTime % 9 === 0) fighter.playSound?.([20, 0]);
      if (fighter.moveHit) fighter.startMove(111101);
    },
  },
  111101: {
    ...BARE,
    action: 11301,
    physics: 'S',
    stop: true,
    pin: [10, 0],
    sounds: [
      { elem: 3, sound: [201, 8] },
      { elem: 3, sound: [201, 9] },
    ],
    strikes: [{ elem: 3, damage: 0, stun: 20, push: [-4, -6], fall: true, pause: [0, 10] }],
  },

  // ← ou → + 5: um soco que, se acertar, passa sozinho por mais nove golpes,
  // os últimos no ar. Pede um nível mas, como no original, não o gasta.
  112200: {
    ...blow({
      action: 15678, advance: 6, swing: [280, 1],
      hit: { damage: 10, sounds: [{ sound: [200, 2] }] },
    }),
    power: 80,
    sounds: [
      { time: 0, sound: [0, 71] },
      { time: 0, sound: [0, 88] },
      { time: 1, sound: [280, 1] },
    ],
    tick(fighter) {
      if (fighter.moveTime === 1) fighter.superPause(10, { darken: false });
      onContact(112210)(fighter);
    },
  },
  112210: {
    ...blow({
      action: 11210, voice: [0, 27], swing: [200, 4],
      hit: { damage: 15, sounds: [{ sound: [201, 4] }] },
    }),
    invulnerable: true,
    tick: onContact(112220),
  },
  112220: {
    ...blow({
      action: 11220, voice: [0, 24], swing: [280, 1],
      hit: { damage: 10, pause: [12, 10], sounds: [{ sound: [200, 2] }] },
    }),
    invulnerable: true,
    tick: onContact(112230),
  },
  112230: {
    ...blow({
      action: 11200, voice: [0, 26], swing: [280, 1],
      hit: { damage: 10, sounds: [{ sound: [200, 2] }] },
    }),
    power: 80,
    invulnerable: true,
    tick: onContact(112231),
  },
  112231: {
    ...blow({
      action: 11310, advance: 3, voice: [0, 26], swing: [200, 4],
      hit: { damage: 10, push: [-2, -6], pause: [10, 10], sounds: [{ sound: [201, 1] }] },
    }),
    tick: onContact(112232),
  },
  // Salta atrás dele.
  112232: {
    ...blow({
      action: 11600, physics: 'A', advance: null, voice: [0, 26], swing: [280, 1],
      hit: { damage: 10, push: [-2, -10], sounds: [{ sound: [200, 2] }] },
    }),
    power: 80,
    stop: true,
    velocity: [{ time: 0, x: 3, y: -8 }],
    tick: onContact(112233),
  },
  112233: {
    ...blow({
      action: 11601, physics: 'A', voice: [0, 27], swing: [200, 4], onHit: { y: -3 },
      hit: { damage: 15, sounds: [{ sound: [201, 4] }] },
    }),
    tick: onContact(1122334),
  },
  1122334: {
    ...blow({
      action: 11600, physics: 'A', voice: [0, 26], swing: [280, 1], onHit: { y: -3 },
      hit: { damage: 10, sounds: [{ sound: [200, 2] }] },
    }),
    power: 80,
    tick: onContact(1122335),
  },
  1122335: {
    ...blow({
      action: 11601, physics: 'A', voice: [0, 27], swing: [200, 4], onHit: { y: -3 },
      hit: { damage: 15, sounds: [{ sound: [201, 4] }] },
    }),
    tick: onContact(1122336),
  },
  // O último: atira-o contra o chão.
  1122336: blow({
    action: 11602, physics: 'A', voice: [0, 24], swing: [280, 1],
    hit: { damage: 10, push: [-3, 0], fall: true, pause: [0, 0], sounds: [{ sound: [200, 2] }] },
  }),

  // ↑ + 6: um segundo em guarda; se lhe baterem, prende-o e tira-lhe um
  // décimo da vida.
  113300: {
    ...BARE,
    action: 113330,
    physics: 'S',
    stop: true,
    power: -1000,
    counter: 60,
    onCounter: 113301,
    sounds: [
      { time: 0, sound: [0, 28] },
      { time: 0, sound: [1, 37] },
    ],
    tick(fighter) {
      if (fighter.moveTime === 1) fighter.superPause(10, { darken: false });
    },
  },
  113301: {
    ...BARE,
    action: 14156,
    invulnerable: true,
    physics: 'S',
    stop: true,
    power: 30,
    pulls: [{ time: 0, at: [15, 0] }],
    sounds: [{ time: 2, sound: [201, 6] }],
    strikes: [{
      time: 2, damage: 0, ratio: 1 / 10, stun: 70, push: [-2, -4], fall: true, pause: [0, 20],
    }],
  },

  // ↑ + 5: baixa a cabeça; largando o 5 dá a cabeçada, segurando-o quase
  // um segundo dá a que o deixa atordoado. Não tira vida: prende-o.
  114400: {
    ...BARE,
    action: 267821,
    physics: 'N',
    stop: true,
    loop: true,
    power: -1000,
    sounds: [
      { time: 0, sound: [0, 71] },
      { time: 20, sound: [5, 23] },
      { time: 30, sound: [5, 23] },
    ],
    tick(fighter) {
      if (fighter.moveTime === 1) fighter.superPause(10, { darken: false });
      if (fighter.moveTime < 10) return;
      if (!fighter.input.i) fighter.startMove(114401);
      else if (fighter.moveTime >= 40) fighter.startMove(114402);
    },
  },
  114401: headbutt({ voice: [0, 21], stun: 120 }),
  114402: headbutt({ voice: [0, 28], stun: 240 }),

  // --------------------------------------------------------- a espada

  // Apanha a espada (ou, a meio de um combo, fá-la voltar à mão).
  115500: {
    ...BARE,
    action: 15500,
    // No ar dá um pequeno salto e acaba ao aterrar; no chão fica parado.
    physics: 'A',
    stop: true,
    tick(fighter) {
      if (fighter.moveTime !== 1) return;
      if (!fighter.isOnGround) fighter.setVelocity({ x: 2, y: -3 });
      fighter.recoverSword?.({ grab: true });
    },
  },
};

/** A cabeçada: avança e, se acertar, prende-o (sem lhe tirar vida). */
function headbutt({ voice, stun }) {
  return {
    ...BARE,
    action: 78942,
    physics: 'S',
    stop: true,
    velocity: [{ time: 0, x: 6 }],
    sounds: [
      { time: 0, sound: voice },
      { elem: 2, sound: [200, 1] },
    ],
    pin: [45, 0],
    hit: {
      damage: 0, stun, push: [0, 0], pause: [0, 120],
      sounds: [{ sound: [201, 8] }, { sound: [201, 7] }, { sound: [201, 4] }],
    },
  };
}

const commands = {
  motions: [],
  ground: [
    { input: 'c', to: 115500, when: (fighter) => Boolean(fighter.canPickUpSword) },
    { input: 'i', up: true, to: 114400, power: 1000, when: isSwordless },
    { input: 'i', forward: true, to: 112200, power: 1000, when: isSwordless },
    { input: 'i', to: 111100, power: 1000, when: (f) => isSwordless(f) && !f.input.down },
    { input: 'b', up: true, to: 113300, power: 1000, when: isSwordless },
    { input: 'b', down: true, to: 113350, when: isSwordless },
    { input: 'a', down: true, to: 11240, when: isSwordless },
    { input: 's', to: 11500, unlessFullPower: true, when: isSwordless },
    { input: 'dash', to: 11060, when: isSwordless },
    { input: 'a', to: 11200, when: isSwordless },
    { input: 'b', to: 11300, when: isSwordless },
  ],
  air: [
    { input: 'c', to: 115500, when: (fighter) => Boolean(fighter.canPickUpSword) },
    { input: 'dash', to: 11065, airDash: true, when: isSwordless },
    { input: 'a', to: 11600, when: isSwordless },
    { input: 'b', to: 11610, when: isSwordless },
  ],
};

export const TANJIRO_SWORDLESS = { moves, commands };
