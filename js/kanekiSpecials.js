import { CharacterAtlas } from './CharacterAtlas.js';
import { freezeOpponent, SPECIAL_POWER } from './kanekiMoves.js';

/**
 * Os especiais do Kaneki que não estão em kanekiMoves.js, transcritos do
 * Kaneki.cns (estados 1050, 1100, 1150 e 1250, e os que se lhes seguem) com
 * os mesmos campos dessa tabela. Os comandos são os do original: ↓→ ou ↓←
 * e um botão.
 *
 * Os efeitos grandes (os riscos de velocidade, a poeira e o chão rachado do
 * Rinkaku Crawling) vêm de assets/kaneki/fx-specials (`atlas: 'specials'`),
 * tal como as caixas de ataque invisíveis da kagune que sai do chão (1160 e
 * 1255): no original são helpers sem arte, e aqui projécteis.
 *
 * Os clarões da superpause (o helper 850) vêm de assets/kaneki/fx-superpause,
 * a meia resolução; as pedras que saltam (o helper 1622), de fx-supers. Os
 * dois servem também os supers (kanekiSupers.js).
 */

// ---------------------------------------------------------------- utilidades

const centerX = (fighter) => fighter.position.x + fighter.width / 2;
const groundY = (fighter) => fighter.bounds.groundY ?? fighter.bounds.height;

/** A que distância está o adversário, para a frente do Kaneki, nas medidas do MUGEN. */
function opponentGap(fighter) {
  const foe = fighter.opponent;
  return foe ? ((centerX(foe) - centerX(fighter)) * fighter.facing) / fighter.unit : 0;
}

/** Uma pausa mais curta do que a do freezeOpponent, sem escurecer o fundo. */
const freeze = (fighter, ticks) => fighter.superPause(ticks, { darken: false });

/**
 * Põe o adversário a `dx` à frente do Kaneki (o TargetBind do MUGEN): é o
 * que o arrasta durante as investidas.
 */
function bindOpponent(fighter, dx) {
  const foe = fighter.opponent;
  if (!foe || foe.isDefeated) return;
  const x = centerX(fighter) + dx * fighter.facing * fighter.unit - foe.width / 2;
  foe.position.x = Math.max(0, Math.min(x, foe.bounds.width - foe.width));
  foe.knockback = 0;
}

/**
 * Larga um efeito da tabela num ponto do ringue (x, y) em vez de nos pés do
 * Kaneki. `facing` relativo ao dele: -1 espelha.
 */
function spawnEffectAt(fighter, spec, x, y, facing = 1) {
  const effect = fighter.spawnEffect(spec);
  if (!effect) return null;
  effect.x = x;
  effect.y = y;
  effect.facing = fighter.facing * facing;
  return effect;
}

/**
 * O risco de velocidade do original (a acção 7020 deitada, com
 * Trans=Sub): marca os saltos de sítio do Quarter Kill.
 */
function streak(fighter, [dx, dy], scale) {
  for (const [sx, sy] of [scale, [scale[0] * 0.8, scale[1]]]) {
    fighter.spawnEffect({ action: 7020, atlas: 'specials', at: [dx, dy], scale: [sx, sy], angle: -90 });
  }
}

const random = (list) => list[Math.floor(Math.random() * list.length)];

// --------------------------------------------------------- superpause e pedras

/**
 * O PalFX dos clarões (`mul=512` e o `add` de cada cor): o atlas de
 * fx-superpause repintado uma vez, à primeira vez que é preciso. `blend`
 * troca a mistura dos frames (o Trans=Sub de alguns helpers).
 */
const PALFX = {
  // Os ID x2x do state 850: add=0,-116,-100. O vermelho da paleta 1.
  red: { add: [0, -116, -100] },
  // Os x9x: só mul=512, e a subtrair.
  dark: { add: [0, 0, 0], blend: 'S' },
};
const repainted = new WeakMap();

function paletteFx(atlas, name) {
  if (!repainted.has(atlas)) repainted.set(atlas, {});
  const cache = repainted.get(atlas);
  if (cache[name]) return cache[name];

  const { add: [addR, addG, addB], blend } = PALFX[name];
  const images = atlas.images.map((image) => {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth ?? image.width;
    canvas.height = image.naturalHeight ?? image.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = pixels;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      data[i] = data[i] * 2 + addR;
      data[i + 1] = data[i + 1] * 2 + addG;
      data[i + 2] = data[i + 2] * 2 + addB;
    }
    ctx.putImageData(pixels, 0, 0);
    return canvas;
  });

  let { actions } = atlas;
  if (blend) {
    actions = Object.fromEntries(Object.entries(actions).map(([number, action]) => [
      number,
      { ...action, frames: action.frames.map((frame) => ({ ...frame, blend })) },
    ]));
  }
  cache[name] = new CharacterAtlas({ sprites: atlas.sprites, actions }, images, atlas.basePath);
  return cache[name];
}

/**
 * Os clarões dos especiais (os três helpers 850 que o original larga no
 * !Time): o ID diz a acção (7100 a 7102), a cor e a SprPriority. As 7101 e
 * 7102 rodam devagar a partir de um ângulo à sorte (0,15° por tick); aqui
 * ficam só no ângulo à sorte. `facing: 0` é para um lado qualquer.
 */
export const SPECIAL_FLASHES = [
  { action: 7100, at: [0, -27], scale: 0.225, layer: 'front', facing: 0 },
  { action: 7101, at: [0, -27], scale: 0.175, layer: 'back', turn: true },
  { action: 7102, at: [0, -29], scale: 0.275, layer: 'front', turn: true },
];

/** Os dos supers (1505, 1550 e 1600): mais um 7102, a escurecer (o ID 392). */
export const SUPER_FLASHES = [
  { action: 7100, at: [0, -25], scale: 0.2, layer: 'back', facing: 0 },
  { action: 7101, at: [0, -25], scale: 0.1875, layer: 'front', facing: 0, turn: true },
  { action: 7102, at: [0, -25], scale: 0.3125, layer: 'back', turn: true },
  { action: 7102, at: [0, -25], scale: 0.3125, layer: 'front', facing: -1, turn: true, palette: 'dark' },
];

/** Larga os clarões da superpause à volta do Kaneki. */
export function superFlash(fighter, flashes) {
  const atlas = fighter.fxAtlases.superpause;
  if (!atlas) return;

  for (const { action, at, scale, layer, facing = 1, turn, palette = 'red' } of flashes) {
    const effect = fighter.spawnEffect({ action, atlas: 'superpause', at, scale, layer });
    if (!effect) continue;
    effect.animation = paletteFx(atlas, palette).animation(action, { loop: false });
    effect.facing = fighter.facing * (facing || random([1, -1]));
    if (turn) effect.angle = Math.random() * 360;
  }
}

/** A superpause dos especiais: o adversário parado, o fundo escuro e os clarões. */
function specialPause(fighter) {
  freezeOpponent(fighter);
  if (fighter.moveTime === 1) superFlash(fighter, SPECIAL_FLASHES);
}

/**
 * Uma pedra que salta do chão em `x` (o helper 1622, acção 1627 de
 * fx-supers): um dos quatro calhaus, à sorte, atirado em arco com a
 * gravidade do Kaneki e a rodar para trás, que assenta, escorrega um pouco
 * e se apaga passado `rest` ticks. `speed` é [x, y] para o lado `facing`
 * (relativo ao Kaneki), nas medidas do MUGEN.
 */
export function throwRock(fighter, x, { scale, speed: [vx, vy], facing, rest, fade }) {
  const effect = spawnEffectAt(fighter, {
    action: 1627,
    atlas: 'supers',
    scale,
    velocity: [vx * facing, vy],
    gravity: fighter.constants.gravity,
    // O AngleDraw soma -10 a -14 graus por tick.
    spin: -(10 + Math.random() * 5),
    floor: true,
    friction: fighter.constants.friction,
    // O tempo no ar anda por 2·vy/g; depois fica `rest` ticks no chão.
    duration: Math.round((-2 * vy) / fighter.constants.gravity) + rest + fade,
    fadeOut: fade,
  }, x, groundY(fighter), facing);
  if (effect) effect.frame = Math.floor(Math.random() * 4);
  return effect;
}

// ------------------------------------------------------------- Quarter Kill

/**
 * O contra-ataque apanhou um golpe: as caixas de ataque do adversário (do
 * corpo ou de um projéctil) tocam nas do Kaneki. É o ReversalDef do
 * original, que também se arma com o Clsn1 de quem contra-ataca.
 */
function caughtAttack(fighter) {
  const foe = fighter.opponent;
  if (!foe) return false;

  const mine = fighter.toWorldBoxes(fighter.currentFrame?.hit ?? []);
  const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;

  return foe.getAttacks().some(({ boxes }) => boxes.some((box) => mine.some((own) => overlaps(box, own))));
}

/** Anula o golpe apanhado: o adversário fica parado e o golpe já não acerta. */
function cancelAttack(fighter) {
  const foe = fighter.opponent;
  foe.hasHit = true;
  for (const helper of foe.helpers ?? []) {
    helper.hasHit = true;
    helper.lastHit = helper.tick;
  }
  // O `pausetime=0,10` do ReversalDef.
  freeze(fighter, 10);
}

/** O corte do Quarter Kill, e o som de cada toque. */
const QUARTER_CUT = {
  damage: 20,
  max: 3,
  stun: 50,
  pause: [3, 2],
  slash: true,
  sounds: [
    { sound: [10, 73], volume: 0.5 },
    { sound: [10, 77], volume: 0.75 },
    { sound: [10, 78], volume: 0.75 },
    { sound: [10, 79], volume: 0.5 },
  ],
};

// ------------------------------------------------------------- Rising Pierce

/**
 * A kagune que rebenta do chão debaixo do adversário (o helper 1160): uma
 * caixa invisível que acerta uma vez, com muita força.
 */
const PIERCE = {
  action: 1160,
  atlas: 'specials',
  lifetime: 25,
  armAfter: 3,
  sounds: [
    { sound: [10, 65], volume: 0.5 },
    { sound: [10, 66], volume: 0.75 },
  ],
  hit: {
    damage: 135,
    stun: 20,
    push: [0, -4],
    fall: true,
    pause: [0, 35],
    slash: true,
    sounds: [
      { sound: [10, 68], volume: 0.5 },
      { sound: [10, 70] },
      { sound: [10, 72], volume: 0.25 },
      { sound: [10, 139] },
    ],
  },
};

/**
 * As três pontas de kagune que se vêem a sair do chão (os helpers 1165): a
 * do meio, achatada, e duas maiores de cada lado, viradas uma para a outra.
 * `dx` é a distância ao ponto onde rebentam; `layer` faz de SprPriority.
 */
const PIERCE_SPIKES = [
  { action: 1165, dx: 0, scale: [1.25, 0.75], facing: 1, layer: 'back' },
  { action: 1166, dx: -35, scale: [1.5, 1.5], facing: 1, layer: 'front' },
  { action: 1166, dx: 35, scale: [1.5, 1.5], facing: -1, layer: 'front' },
];
/** Ticks das pontas: quanto demoram a encolher, e a vida máxima (se o golpe for interrompido). */
const SPIKE_SHRINK_TICKS = 10;
const SPIKE_MAX_TICKS = 60;

function spawnPierce(fighter) {
  const x = centerX(fighter.opponent ?? fighter)
    + 25 * fighter.facing * fighter.unit;
  const y = groundY(fighter);

  fighter.spawnProjectile(PIERCE, { x, y });
  fighter.pierceSpikes = PIERCE_SPIKES.map(({ action, dx, scale, facing, layer }) => {
    const effect = spawnEffectAt(
      fighter,
      { action, scale, layer, loop: true, duration: SPIKE_MAX_TICKS },
      x + dx * fighter.facing * fighter.unit,
      y,
      facing,
    );
    return effect && { effect, scale: [...effect.scale] };
  }).filter(Boolean);

  // O chão rachado onde a kagune sai.
  spawnEffectAt(
    fighter,
    { action: 1265, atlas: 'specials', scale: [0.2, 0.125], layer: 'back' },
    x,
    y + 2 * fighter.unit,
    random([1, -1]),
  );
  fighter.fx?.tremble(6, 10);
}

/**
 * As pontas ficam no segundo frame (o ChangeAnim para o elem 2 a cada
 * tick) até o Kaneki acabar a pose; aí encolhem até sumir (o estado 1166).
 */
function updatePierceSpikes(fighter, shrinkAt) {
  for (const spike of fighter.pierceSpikes ?? []) {
    const { effect, scale } = spike;
    if (effect.tick >= 3) effect.frame = 1;

    const shrinking = fighter.moveTime - shrinkAt;
    if (shrinking < 0) continue;
    const left = Math.max(0, 1 - (shrinking + 1) / SPIKE_SHRINK_TICKS);
    effect.scale = [scale[0] * left, scale[1] * left];
    if (left === 0) effect.duration = effect.tick;
  }
}

// ---------------------------------------------------------- Rinkaku Crawling

/** Quantos toques dá a kagune a rastejar antes do golpe final. */
const CRAWL_MAX_HITS = 9;
/** Até onde passa da borda do ringue antes de rebentar, nas medidas do MUGEN. */
const CRAWL_EDGE = 20;

/**
 * A kagune a rastejar pelo chão (o helper 1255): vai deixando pontas a
 * rebentar da terra, pó e fumo, faz tremer o ecrã, e fecha com o 1256
 * quando dá os toques todos, chega à borda ou o tempo acaba.
 */
function crawlTick(fighter, helper) {
  const { tick } = helper;
  const unit = fighter.unit;
  const ending = tick >= helper.lifetime;

  if (helper.lastHit === tick - 1) {
    helper.hits = (helper.hits ?? 0) + 1;
    fighter.fx?.tremble(10, 10);
  }

  // O 1256: acabados os toques, ou já fora do ringue, passa ao golpe final.
  const offEdge = helper.x < -CRAWL_EDGE * unit
    || helper.x > fighter.bounds.width + CRAWL_EDGE * unit;
  if (!ending && ((helper.hits ?? 0) >= CRAWL_MAX_HITS || offEdge)) {
    helper.lifetime = tick + 1;
  }

  const y = groundY(fighter);
  const touched = tick - helper.lastHit < 4;

  // As pontas de kagune, maiores quando está a acertar.
  if (tick % 4 === 0) {
    spawnEffectAt(
      fighter,
      { action: random([1260, 1261, 1262, 1263]), scale: touched ? 1 : 0.65, layer: 'front' },
      helper.x + Math.random() * 25 * helper.facing * unit,
      y,
    );
  }
  const ahead = helper.x + 10 * helper.facing * unit;
  if (tick % 10 === 0) {
    spawnEffectAt(fighter, { action: 1265, atlas: 'specials', scale: [0.2, 0.125], layer: 'back' },
      ahead, y + 2 * unit, random([1, -1]));
    spawnEffectAt(fighter, { action: 1267, atlas: 'specials', scale: 0.65, blend: { alpha: 0.68 } },
      ahead, y + 4 * unit, random([1, -1]));
    fighter.playSound?.([10, random([61, 66, 67])], { volume: 0.5 });
    // As pedras que salta da terra (o helper 1622 com o ID 1623): mais
    // baixas do que as do Overkill, e apagam-se mais cedo.
    throwRock(fighter, helper.x + 50 * helper.facing * unit, {
      scale: 0.35,
      speed: [2 + Math.floor(Math.random() * 2), -4 - Math.floor(Math.random() * 5)],
      facing: random([1, -1]),
      rest: 100,
      fade: 10,
    });
  }
  if (tick % 8 === 0) {
    spawnEffectAt(fighter, { action: 1266, atlas: 'specials', scale: [0.45, 0.25], blend: { alpha: 0.49 } },
      ahead, y + 2 * unit, random([1, -1]));
  }
  if (tick % 5 === 0 && !touched) fighter.fx?.tremble(5, 5);
}

const CRAWL = {
  elem: 4,
  action: 1255,
  atlas: 'specials',
  velocity: [4.5, 0],
  // O Time>=75 do original; os 25 do 1256 vêm a seguir.
  lifetime: 75,
  every: 7,
  sounds: [{ sound: [5, 72] }],
  // O original alterna toques de 15 e de 10 (Time%14 = 0 e 7); aqui é um
  // só, de 7 em 7 ticks, com a média dos dois.
  hit: {
    damage: 12.5,
    stun: 30,
    push: [-2, -1.5],
    pause: [0, 5],
    slash: true,
    sounds: [
      { sound: [10, 70] },
      { sound: [10, 71], volume: 0.75 },
      { sound: [10, 79], volume: 0.5 },
    ],
  },
  finalHit: {
    damage: 25,
    stun: 30,
    push: [-6, -6.5],
    fall: true,
    pause: [0, 10],
    slash: true,
    sounds: [
      { sound: [10, 76], volume: 0.5 },
      { sound: [10, 78], volume: 0.5 },
      { sound: [10, 79], volume: 0.5 },
    ],
  },
  finalTicks: 25,
  tick: crawlTick,
};

// -------------------------------------------------------------------- tabela

export const KANEKI_SPECIALS = {
  moves: {
    // Quarter Kill: uma pose de contra-ataque. Se um golpe lhe tocar,
    // desaparece e reaparece colado ao adversário (1055); se esse corte
    // acertar, segue-se a sequência de cortes invisíveis (1060) e o fecho
    // (1065). Se nada lhe tocar, gastou meia barra à toa.
    //
    // No original o Kaneki pode ser atingido pelos golpes que não toquem no
    // Clsn1 da pose; como esse Clsn1 lhe cobre o corpo todo, aqui fica
    // simplesmente intocável enquanto espera.
    1050: {
      action: 1050,
      physics: 'S',
      stop: true,
      invulnerable: true,
      power: -500,
      sounds: [
        { time: 0, sound: [950, 1], volume: 0.5 },
        { elem: 2, sound: [0, 29] },
        { elem: 3, sound: [0, 201] },
      ],
      tick(fighter) {
        specialPause(fighter);
        if (caughtAttack(fighter)) {
          cancelAttack(fighter);
          fighter.startMove(1055);
        }
      },
    },

    // O contra-ataque: aparece a 8 pixels do adversário e corta-o numa
    // investida.
    1055: {
      action: 1055,
      trail: true,
      physics: 'S',
      stop: true,
      invulnerable: true,
      power: -500,
      velocity: [
        { elem: 2, x: 10 },
        { elem: 3, x: 5 },
        { elem: 4, x: 2 },
      ],
      hit: {
        damage: 20,
        stun: 70,
        push: [-5, 0],
        pause: [15, 8],
        sounds: [
          { sound: [1, 34], volume: 0.35 },
          { sound: [1, 6], volume: 0.75 },
          { sound: [10, 134], volume: 0.2 },
        ],
      },
      tick(fighter) {
        const foe = fighter.opponent;
        if (foe && fighter.moveTime === 1) {
          // PosAdd x = P2BodyDist X - 8: fica a 8 pixels do corpo dele.
          const bodies = (fighter.width + foe.width) / 2 / fighter.unit;
          fighter.jumpTo(foe, -(bodies + 8));
          freeze(fighter, 8);
          streak(fighter, [8, -25], [0.6, 0.25]);
        }
        if (fighter.moveHit && fighter.moveTime >= fighter.elemStart(4)) fighter.startMove(1060);
      },
    },

    // Os cortes invisíveis: o Kaneki some, corta três vezes colado ao
    // adversário, aparece-lhe nas costas, some outra vez e corta mais três.
    // Com os seis, fecha com o 1065.
    1060: {
      action: 1060,
      trail: true,
      physics: 'S',
      stop: true,
      invulnerable: true,
      velocity: [
        { elem: 3, offset: 2, x: 2 },
        { elem: 5, x: 2.5 },
        { elem: 7, x: -2.5 },
      ],
      sounds: [
        { elem: 4, sound: [0, 205] },
        { elem: 6, sound: [0, 207] },
      ],
      hits: [
        { elem: 4, ...QUARTER_CUT, push: [-4, 0] },
        // Já nas costas dele: o empurrão vira-se.
        { elem: 6, ...QUARTER_CUT, push: [4, 0] },
      ],
      effects: [
        { elem: 3, offset: 2, action: 1070, atlas: 'specials', at: [25, -25], scale: [0.6, 0.3], angle: -90, velocity: [1, 0] },
      ],
      tick(fighter) {
        const foe = fighter.opponent;
        const time = fighter.moveTime;
        const start = (elem) => fighter.elemStart(elem);
        if (!foe) return;

        // BindToTarget: nos frames invisíveis fica em cima do adversário.
        const bound = (time >= start(4) && time < start(4) + 5)
          || (time >= start(6) && time < start(6) + 5);
        if (bound) fighter.jumpTo(foe, 1);

        // Os saltos de sítio: para trás dele, e de volta para a frente.
        if (time === start(5)) {
          fighter.jumpTo(foe, 20);
          streak(fighter, [0, -25], [0.75, 0.175]);
        }
        if (time === start(7)) {
          fighter.jumpTo(foe, -25);
          streak(fighter, [0, -25], [0.75, 0.175]);
        }

        // O original conta os seis toques (HitCount>=6); aqui os três da
        // segunda volta.
        if (time >= start(6) && fighter.hitCount >= 3) {
          fighter.jumpTo(foe, -20);
          fighter.startMove(1065);
        }
      },
    },

    // O fecho: a kagune rasga o adversário e atira-o para longe.
    1065: {
      action: 1065,
      trail: true,
      physics: 'S',
      stop: true,
      invulnerable: true,
      velocity: [{ time: 0, x: -5 }],
      sounds: [{ time: 0, sound: [0, 63] }],
      hit: {
        damage: 70,
        stun: 70,
        push: [-8, 0],
        fall: true,
        pause: [15, 15],
        sounds: [
          { sound: [10, 78] },
          { sound: [10, 139] },
          { sound: [10, 79], volume: 0.4 },
        ],
      },
      tick(fighter) {
        if (fighter.moveTime === 1) streak(fighter, [-5, -25], [0.75, 0.175]);
      },
    },

    // Eater Hunt: arranca a correr com a kagune à frente, a cortar de dois
    // em dois ticks e a arrastar o adversário. Acaba com o 1105.
    1100: {
      action: 1100,
      trail: true,
      physics: 'S',
      stop: true,
      loop: true,
      power: -1000,
      velocity: [{ elem: 4, x: 5 }],
      physicsAt: [{ elem: 4, physics: 'N' }],
      sounds: [
        { time: 0, sound: [950, 1], volume: 0.5 },
        { time: 0, sound: [0, 9] },
        { time: 33, sound: [10, 65], volume: 0.5 },
        { time: 33, sound: [10, 111] },
        { time: 33, sound: [10, 108] },
        { time: 33, sound: [5, 43] },
        { time: 33, sound: [40, 3], volume: 0.75 },
        { time: 33, sound: [10, 19] },
      ],
      hit: {
        damage: 8,
        max: 14,
        stun: 15,
        push: [-6, 0],
        pause: [2, 10],
        sounds: [
          { sound: [10, 136], volume: 0.5 },
          { sound: [10, 78], volume: 0.5 },
          { sound: [10, 79], volume: 0.25 },
        ],
      },
      effects: [
        { time: 35, action: 7020, atlas: 'specials', at: [-15, -27], scale: [0.6, 0.3], angle: 90 },
      ],
      tick(fighter) {
        specialPause(fighter);
        const time = fighter.moveTime;
        const foe = fighter.opponent;

        if (time >= 35) {
          // Acelera até 15; depois de acertar, trava para os ~10.
          if (fighter.forwardSpeed <= 15) fighter.forwardSpeed += 0.75;
          if (fighter.moveHit && fighter.forwardSpeed >= 10) fighter.forwardSpeed -= 1.5;
          // O pó que levanta atrás de si (o explod 7030).
          if (time % 4 === 0) {
            fighter.fx?.spawnAt(fighter, 7030, {
              dx: 5, dy: 2, scale: [0.2, 0.25], velocity: [-1.5, 0], blend: { alpha: 0.78 },
            });
          }
        }
        if (time === 35) fighter.fx?.spawnAt(fighter, 7022, { dx: 35, dy: -27, scale: 0.2 });

        // A partir do terceiro toque, leva o adversário 50 pixels à frente.
        if (foe && fighter.hitCount >= 3 && foe.hitStun > 0) bindOpponent(fighter, 50);

        const { unit, facing } = fighter;
        const atWall = facing === 1
          ? fighter.position.x >= fighter.bounds.width - fighter.width - unit
          : fighter.position.x <= unit;
        const done = time >= 100
          || fighter.hitCount >= 14
          || (time >= 75 && !fighter.moveHit)
          || (time >= 35 && atWall)
          || (time >= 50 && opponentGap(fighter) < -5);
        if (done) fighter.startMove(1105);
      },
    },

    // O fecho do Eater Hunt: um último corte que atira o adversário ao ar.
    1105: {
      action: 1105,
      trail: true,
      physics: 'N',
      stop: true,
      velocity: [
        { time: 0, x: 15 },
        { elem: 3, x: 5 },
      ],
      physicsAt: [{ elem: 3, physics: 'S' }],
      hit: {
        damage: 63,
        stun: 15,
        push: [0, -7.5],
        fall: true,
        pause: [2, 5],
        sounds: [
          { sound: [10, 63], volume: 0.75 },
          { sound: [10, 74] },
          { sound: [10, 78], volume: 0.5 },
          { sound: [10, 79], volume: 0.5 },
        ],
      },
      tick(fighter) {
        // TargetBind no toque: o adversário fica 25 pixels à frente.
        if (fighter.moveHit && !fighter.eaterBound) bindOpponent(fighter, 25);
        fighter.eaterBound = fighter.moveHit;

        // Se passou por ele, vira-se no fim.
        if (fighter.moveTime === fighter.elemStart(6) + 3 && opponentGap(fighter) <= -5) {
          fighter.facing *= -1;
        }
      },
    },

    // Rising Pierce: um golpe de kagune de baixo para cima; se acertar,
    // o Kaneki faz pose e a kagune rebenta do chão debaixo do adversário
    // (1155).
    1150: {
      action: 1150,
      trail: true,
      physics: 'S',
      stop: true,
      power: -500,
      velocity: [{ elem: 2, offset: 2, x: 4 }],
      sounds: [
        { time: 0, sound: [950, 1], volume: 0.5 },
        { time: 28, sound: [10, 108] },
      ],
      hit: {
        damage: 35,
        stun: 20,
        push: [-2.5, -6.5],
        fall: true,
        pause: [10, 12],
        sounds: [
          { sound: [1, 14], volume: 0.75 },
          { sound: [1, 33], volume: 0.75 },
          { sound: [10, 37], volume: 0.35 },
        ],
      },
      // O risco do golpe, inclinado (facing=-1 e Angle=45 no original).
      effects: [
        { elem: 4, action: 1159, atlas: 'specials', at: [10, -25], scale: [0.25, 0.175], angle: -45 },
      ],
      tick(fighter) {
        specialPause(fighter);
        if (fighter.moveHit && fighter.moveTime >= fighter.elemStart(5)) fighter.startMove(1155);
      },
    },

    // A pose do Rising Pierce: a meio, a kagune rebenta do chão 25 pixels
    // para lá do adversário (o helper 1160), e recolhe no fim.
    1155: {
      action: 1155,
      physics: 'S',
      stop: true,
      power: -500,
      sounds: [{ elem: 1, sound: [0, 77] }],
      tick(fighter) {
        if (fighter.moveTime === fighter.elemStart(4)) spawnPierce(fighter);
        // As pontas recolhem 30 ticks depois do 5.º frame.
        updatePierceSpikes(fighter, fighter.elemStart(5) + 30);
      },
    },

    // Rinkaku Crawling: mete a kagune no chão, e ela vai a rastejar por
    // baixo da terra até ao adversário (o helper 1255, ver CRAWL). O
    // Kaneki não pode ser atingido enquanto o faz.
    1250: {
      action: 1250,
      physics: 'S',
      stop: true,
      invulnerable: true,
      power: -1000,
      // O original volta ao 1.º estado aos 40 ticks, a meio da animação.
      duration: 40,
      sounds: [
        { time: 0, sound: [950, 1], volume: 0.5 },
        { time: 0, sound: [0, 22] },
      ],
      projectiles: [CRAWL],
      tick: specialPause,
    },
  },

  commands: {
    // Os comandos do original (Kaneki.cmd, SPECIAL1 a SPECIAL6): baixo,
    // frente ou trás, e o botão, em 15 ticks. Os de ↓→ + A e ↓→ + C dão os
    // especiais que já estavam no I.
    motions: [
      { name: 'qcfA', sequence: ['D', 'F'], button: 'a', window: 15 },
      { name: 'qcbA', sequence: ['D', 'B'], button: 'a', window: 15 },
      { name: 'qcfB', sequence: ['D', 'F'], button: 'b', window: 15 },
      { name: 'qcbB', sequence: ['D', 'B'], button: 'b', window: 15 },
      { name: 'qcfC', sequence: ['D', 'F'], button: 'c', window: 15 },
      { name: 'qcbC', sequence: ['D', 'B'], button: 'c', window: 15 },
    ],
    ground: [
      { input: 'qcfA', to: 1000, power: SPECIAL_POWER },
      { input: 'qcbA', to: 1050, power: SPECIAL_POWER },
      { input: 'qcfB', to: 1100, power: SPECIAL_POWER },
      { input: 'qcbB', to: 1150, power: SPECIAL_POWER },
      { input: 'qcfC', to: 1200, power: SPECIAL_POWER },
      { input: 'qcbC', to: 1250, power: SPECIAL_POWER },
    ],
    air: [{ input: 'qcfC', to: 1201, power: SPECIAL_POWER }],
  },
};
