import { freezeOpponent } from './kanekiMoves.js';
import { SUPER_FLASHES, superFlash, throwRock } from './kanekiSpecials.js';

/**
 * Os supers do Kaneki, transcritos do Kaneki.cns (estados 1500, 1550 e
 * 1600, e os que se lhes seguem) com os mesmos campos de kanekiMoves.js. Os
 * comandos são os do original: ↓→↓→ (ou ↓←↓←) e um botão.
 *
 *   ↓→↓→ + A  Half Kill        agarra, e devora o adversário no chão
 *   ↓→↓→ + B  Devouring Hunt   salto e uma série de cortes a atravessá-lo
 *   ↓→↓→ + C  Rinkaku Overkill a kagune em rajada, e espetos do chão
 *
 * O primeiro golpe de cada um acerta como os outros (pelas caixas de ataque
 * da arte). O resto é uma sequência em que, no original, o adversário já
 * está preso (TargetBind) ou atordoado; aqui esses toques dão-se a direito,
 * com `strike`, e o adversário é posto no sítio com `hold`. As caixas do
 * original para esses toques vão muito além da arte (a do 1515 é o ecrã
 * inteiro), e cortadas ao desenho não acertavam.
 *
 * Os efeitos grandes vêm de assets/kaneki/fx-supers (`atlas: 'supers'`); a
 * poeira, de fx-common. Os que enchem o ecrã (o fundo de riscos, a moldura
 * de sangue, o vidro a partir) esticam-se ao ecrã, como no original, onde
 * estão presos à câmara.
 *
 * Os clarões da superpause (helper 850, acções 7100–7102) e a onda de choque
 * e as nuvens do fecho do Overkill (1621, 1622 e 392) vêm de
 * fx-superpause (`atlas: 'superpause'`): a meia resolução e, as do Overkill,
 * com um frame em cada dois ou quatro, que inteiras eram mais de 16 MB.
 *
 * Como no original (NotHitBy), o Kaneki não pode ser atingido no Half Kill
 * inteiro, na rajada do Overkill (1600) e no fecho (1615); no Devouring Hunt,
 * só durante a superpause (o `unhittable` dela).
 *
 * Fica de fora: o Kaneki em vermelho a crescer atrás de si no fecho do
 * Overkill (helper 1621, uma cópia da animação dele) e as faíscas do
 * helper 2000 a cada toque desse fecho (ficam as faíscas do jogo).
 */

// ---------------------------------------------------------------- utilidades

/**
 * O primeiro tick em que o `tick` de um golpe corre (o tick 0 é o do
 * startMove, que não o chama): é aí que fica o que o original faz com !Time.
 */
const FIRST_TICK = 1;

const centerX = (fighter) => fighter.position.x + fighter.width / 2;
const groundLine = (fighter) => fighter.bounds.groundY ?? fighter.bounds.height;

/** A que distância está o adversário, para a frente do Kaneki, nas medidas do MUGEN. */
function opponentGap(fighter) {
  const foe = fighter.opponent;
  return foe ? ((centerX(foe) - centerX(fighter)) * fighter.facing) / fighter.unit : 0;
}

/** O adversário ainda está a apanhar (atordoado, no ar ou no chão). */
const foeIsReeling = (fighter) => Boolean(fighter.opponent?.isInCombo && !fighter.opponent.isDefeated);

/**
 * Prende o adversário a `dx` à frente do Kaneki (o TargetBind do MUGEN):
 * sem se mexer e sem recuperar. `dy` é a altura em relação aos pés do
 * Kaneki (negativo = mais alto), sem passar do chão; sem ele, fica no chão.
 * `lying` deixa-o estendido, como os estados 1530/1531 do original.
 */
function hold(fighter, dx, { dy = null, lying = false } = {}) {
  const foe = fighter.opponent;
  if (!foe || foe.isDefeated) return;

  // De pé, os corpos empurram-se: a menos disso, o Kaneki ia recuando.
  const minimum = lying ? 0 : (fighter.width + foe.width) / 2 + 1;
  const offset = Math.max(dx * fighter.unit, minimum);
  const x = centerX(fighter) + offset * fighter.facing - foe.width / 2;
  foe.position.x = Math.max(0, Math.min(x, foe.bounds.width - foe.width));
  foe.position.y = dy === null
    ? foe.groundY
    : Math.min(foe.groundY, fighter.position.y + fighter.height - foe.height + dy * fighter.unit);
  foe.velocity.x = 0;
  foe.velocity.y = 0;
  foe.knockback = 0;
  foe.facing = -fighter.facing;
  foe.hitStun = Math.max(foe.hitStun, 2);
  if (lying) {
    foe.isFalling = false;
    foe.downTicks = Math.max(foe.downTicks, 2);
  }
}

/**
 * Um toque dado a direito, sem caixas: o adversário leva o `hit` como se
 * tivesse sido apanhado por ele, com as faíscas e os sons do costume.
 * `spread` espalha o ponto do impacto pelo corpo dele (nas medidas do MUGEN).
 */
function strike(fighter, hit, { spread = 0 } = {}) {
  const foe = fighter.opponent;
  if (!foe || foe.isDefeated) return false;

  fighter.arm(hit);
  foe.receiveHit({ ...fighter.currentMove, direction: fighter.facing });
  const jitter = () => (Math.random() - 0.5) * 2 * spread * fighter.unit;
  const point = {
    x: centerX(foe) + jitter(),
    y: foe.position.y + foe.height * 0.45 + jitter(),
  };
  fighter.registerHit({ point, defender: foe });
  if (hit.shake) fighter.fx?.tremble(...hit.shake);
  return true;
}

/** Toca um som já, sem esperar pela tabela. */
const play = (fighter, sound, volume = 1) => fighter.playSound?.(sound, { volume });

/** Um de dois sons, à sorte (os `Cond(Random<500, …)` do original). */
const either = (a, b) => (Math.random() < 0.5 ? a : b);

/**
 * A fala de arranque dos supers: o original toca-a três vezes a seguir e
 * repete-a mais baixo aos 5 e aos 10 ticks, como um eco.
 */
function voice(fighter, sound, [echo1 = 1, echo2 = 0.5] = []) {
  const time = fighter.moveTime;
  if (time === FIRST_TICK) play(fighter, sound);
  if (time === FIRST_TICK + 5) play(fighter, sound, echo1);
  if (time === FIRST_TICK + 10) play(fighter, sound, echo2);
}

/** Um efeito de fx-supers esticado ao ecrã inteiro (os explods "postype=back"). */
function screenFx(fighter, action, { loop = false, ...options } = {}) {
  const animation = fighter.fxAtlases.supers?.animation(action, { loop });
  if (!animation || !fighter.fx) return null;
  return fighter.fx.effects.spawn({ animation, cover: true, ...options });
}

/**
 * Um efeito de fx-supers assente no chão, a `dx` à frente do Kaneki (os do
 * fecho do Overkill nascem no chão, com ele lá em cima). `flip` espelha-o;
 * `atlas` vai buscá-lo a outra pasta.
 */
function groundFx(fighter, action, {
  dx = 0, dy = 0, scale = 1, flip = false, angle = 0, layer = 'front', atlas = 'supers', ...options
} = {}) {
  const animation = fighter.fxAtlases[atlas]?.animation(action, { loop: false });
  if (!animation || !fighter.fx) return null;
  const [scaleX, scaleY] = Array.isArray(scale) ? scale : [scale, scale];
  return fighter.fx.effects.spawn({
    animation,
    x: centerX(fighter) + dx * fighter.facing * fighter.unit,
    y: groundLine(fighter) + dy * fighter.unit,
    scale: [scaleX * fighter.unit, scaleY * fighter.unit],
    facing: fighter.facing * (flip ? -1 : 1),
    angle,
    layer,
    ...options,
  });
}

/** Estado de cada super a meio (os var() do original), por lutador. */
const progress = new WeakMap();
const stateOf = (fighter) => {
  if (!progress.has(fighter)) progress.set(fighter, {});
  return progress.get(fighter);
};

/** Misturas dos explods. */
const ADD = { additive: true };
const SOFT = { alpha: 0.78, additive: true };

/**
 * O risco de velocidade do original (a acção 7020 deitada, facing e vfacing
 * a -1): marca as investidas. A 7020 já traz Trans=Sub nos frames.
 */
const streak = (spec) => ({ action: 7020, atlas: 'supers', angle: 270, scale: [0.75, 0.2], ...spec });

/** O arranque de todos os supers: a aura no chão (1502). */
const SUPER_AURA = { elem: 1, action: 1502, atlas: 'supers', scale: 0.35, blend: ADD, layer: 'back' };

/** Os estados de cada super, do arranque ao fecho (os intervalos do helper 3500). */
const SUPER_STATES = [[1500, 1525], [1550, 1575], [1600, 1625]];

/** O Kaneki ainda está no super, e não foi atingido (o `Parent,MoveType=H`). */
const inSuper = (fighter) => Boolean(fighter.move) && !fighter.isLocked
  && SUPER_STATES.some(([first, last]) => fighter.moveId >= first && fighter.moveId <= last);

/**
 * O fundo a escurecer durante um super (o BGPalFX dos helpers 3500 e 3501):
 * uma cor lisa por baixo dos lutadores que escurece `rise` por tick até
 * `depth` enquanto `active(lutador)` e, a partir daí, clareia `fall` por tick
 * durante no máximo `fallTicks` (o DestroySelf do original, que o tira de vez).
 * As medidas são as do BGPalFX: 256 é o preto.
 *
 * Anda com o tick do efeito, e não com o do golpe: continua a escurecer ou a
 * clarear durante as pausas dos impactos, como os helpers com IgnoreHitPause.
 */
class BackgroundDim {
  constructor(fighter, { depth, rise, fall, fallTicks, active }) {
    Object.assign(this, { fighter, depth, rise, fall, fallTicks, active });
    this.level = 0;
    this.lit = true;
    this.fading = 0;
    this.lastTick = 0;
    this.totalTicks = Infinity;
  }

  frameAt(tick) {
    for (; this.lastTick < tick; this.lastTick++) this.step();
    return 0;
  }

  step() {
    this.lit = this.lit && this.active(this.fighter);
    if (this.lit) {
      this.level = Math.min(this.depth, this.level + this.rise);
      return;
    }
    this.level -= this.fall;
    this.fading += 1;
    // Com totalTicks a 0, o EffectLayer retira-o no tick seguinte.
    if (this.level <= 0 || this.fading >= this.fallTicks) this.totalTicks = 0;
  }

  drawCover(ctx, frame, width, height) {
    ctx.save();
    ctx.globalAlpha *= Math.max(0, Math.min(1, this.level / 256));
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

function dimBackground(fighter, options) {
  fighter.fx?.effects.spawn({ animation: new BackgroundDim(fighter, options), cover: true, layer: 'backdrop' });
}

/**
 * O helper 3500: -70 durante o super todo, até o Kaneki ser atingido ou
 * acabar; no Half Kill, até ao 5.º frame do 1515, onde o 3501 o substitui.
 */
const SUPER_DIM = {
  depth: 70,
  rise: 10,
  fall: 5,
  fallTicks: 10,
  active: (fighter) => inSuper(fighter) && fighter.moveId !== 1520
    && !(fighter.moveId === 1515 && fighter.moveTime >= fighter.elemStart(5)),
};

/** O helper 3501 do 1515: o fundo vai ao preto até o vidro partir (1520). */
const FEAST_BLACKOUT = {
  depth: 300,
  rise: 20,
  fall: 15,
  fallTicks: 7,
  active: (fighter) => inSuper(fighter)
    && (fighter.moveId === 1515 || (fighter.moveId === 1520 && fighter.moveTime < fighter.elemStart(3))),
};

/**
 * A superpause: o adversário parado 30 ticks com o fundo escuro, os clarões
 * do helper 850, o fundo a escurecer até ao fim do super, o som de carregar
 * e, no 1550 e no 1600, o fundo de riscos (o helper 1992, acção 9010) por
 * trás dos dois.
 */
function superPause(fighter, { lines = false } = {}) {
  freezeOpponent(fighter);
  if (fighter.moveTime !== FIRST_TICK) return;
  play(fighter, [950, 2], 0.5);
  superFlash(fighter, SUPER_FLASHES);
  dimBackground(fighter, SUPER_DIM);
  if (lines) screenFx(fighter, 9010, { layer: 'backdrop', blend: ADD, duration: 30, fadeOut: 10, loop: true });
}

/** Os 30 ticks da superpause, em que o original também é intocável. */
const duringSuperPause = (fighter) => fighter.moveTime <= FIRST_TICK + 30;

// --------------------------------------------------------------- Half Kill

/** Os 25 toques do 1515: de 5 em 5 ticks, a partir do frame em que ataca. */
const FEAST_HIT = {
  damage: 20,
  stun: 15,
  push: [0, 0],
  pause: [0, 5],
  slash: true,
  shake: [8, 10],
};
const FEAST_FIRST = 45;
const FEAST_HITS = 25;

const halfKill = {
  // Agarra: prepara-se, corre, desaparece e reaparece colado ao adversário.
  // Se o apanhar, segura-o e passa ao 1505; senão, fica por aqui.
  1500: {
    action: 1500,
    invulnerable: true,
    trail: true,
    physics: 'N',
    stop: true,
    power: -1500,
    velocity: [
      { elem: 4, x: 5 },
      { elem: 6, x: 0 },
      { elem: 7, x: 2.5 },
    ],
    physicsAt: [{ elem: 7, physics: 'S' }],
    sounds: [
      { time: 0, sound: [0, 27] },
      { time: 5, sound: [0, 27] },
      { time: 10, sound: [0, 27], volume: 0.5 },
      { elem: 2, sound: [10, 81] },
      { elem: 4, sound: [5, 43] },
      { elem: 4, sound: [40, 3], volume: 0.75 },
    ],
    effects: [
      SUPER_AURA,
      // O brilho do kakugan (helper 1501, acção 1531), preso à cara.
      { elem: 2, action: 1531, atlas: 'supers', at: [3, -43], scale: 0.2, blend: ADD },
      streak({ elem: 4, at: [25, -25] }),
      streak({ elem: 7, at: [0, -25] }),
    ],
    // Só segura: quem tira vida é o que vem a seguir.
    hit: {
      damage: 0,
      stun: 25,
      push: [0, 0],
      pause: [0, 100],
      sounds: [{ sound: [5, 7], volume: 0.5 }, { sound: [10, 53], volume: 0.75 }],
    },
    tick(fighter) {
      const time = fighter.moveTime;
      if (time === fighter.elemStart(2)) fighter.fx?.tremble(5, 10);
      if (time === fighter.elemStart(4)) fighter.fx?.spawnAt(fighter, 7030, { dx: 15, scale: 0.3, layer: 'back' });

      // O salto de sítio: cola-se ao adversário se ele estiver a menos de
      // 200 px, senão avança 50.
      if (time === fighter.elemStart(6)) {
        const foe = fighter.opponent;
        const gap = opponentGap(fighter);
        const bodies = foe ? (fighter.width + foe.width) / 2 / fighter.unit : 0;
        const step = foe && gap >= 0 && gap <= 200 ? gap - bodies - 5 : 50;
        fighter.position.x += Math.max(0, step) * fighter.facing * fighter.unit;
      }

      if (fighter.moveHit) {
        hold(fighter, 15);
        if (time >= fighter.elemStart(9) + 5) fighter.startMove(1505);
      }
    },
  },

  // Preso: a superpause e dois golpes seguidos.
  1505: {
    action: 1505,
    invulnerable: true,
    trail: true,
    physics: 'S',
    stop: true,
    tick(fighter) {
      const time = fighter.moveTime;
      superPause(fighter);
      hold(fighter, 15);

      const hitSounds = [
        { sound: [1, 34], volume: 0.35 },
        { sound: [1, 6], volume: 0.75 },
        { sound: [10, 134], volume: 0.2 },
      ];
      if (time === fighter.elemStart(3)) {
        strike(fighter, { damage: 15, stun: 25, push: [0, 0], pause: [10, 100], sounds: hitSounds, shake: [6, 10] });
      }
      if (time === fighter.elemStart(6)
        && strike(fighter, { damage: 15, stun: 25, push: [0, 0], pause: [15, 100], sounds: hitSounds, shake: [6, 10] })) {
        stateOf(fighter).halfKill = true;
      }
      if (time > fighter.elemStart(6) && stateOf(fighter).halfKill) {
        stateOf(fighter).halfKill = false;
        fighter.startMove(1510);
      }
    },
  },

  // O terceiro golpe, que deita o adversário no chão (o estado 1530 dele).
  1510: {
    action: 1510,
    invulnerable: true,
    trail: true,
    physics: 'S',
    stop: true,
    tick(fighter) {
      const time = fighter.moveTime;
      const struck = stateOf(fighter);
      if (time < fighter.elemStart(5)) struck.pinned = false;

      hold(fighter, 15, { lying: struck.pinned });
      if (time === fighter.elemStart(5)) {
        strike(fighter, {
          damage: 25,
          stun: 25,
          push: [0, 0],
          pause: [10, 15],
          sounds: [
            { sound: [1, 34], volume: 0.75 },
            { sound: [1, 14], volume: 0.6 },
            { sound: [1, 33], volume: 0.6 },
            { sound: [10, 37], volume: 0.35 },
          ],
          shake: [12, 20],
        });
      }
      if (time >= fighter.elemStart(6) + 4 && fighter.moveHit) {
        struck.pinned = true;
        fighter.startMove(1515);
      }
    },
  },

  // Devora-o: de joelhos por cima dele, a kagune a bater sem parar. O ecrã
  // escurece, pisca com os impactos e ganha uma moldura de sangue.
  1515: {
    action: 1515,
    invulnerable: true,
    trail: true,
    physics: 'S',
    stop: true,
    loop: true,
    tick(fighter) {
      const time = fighter.moveTime;
      const struck = stateOf(fighter);
      if (time === FIRST_TICK) {
        struck.feast = 0;
        struck.voice = either([0, 63], [0, 64]);
      }
      voice(fighter, struck.voice);
      hold(fighter, 20, { lying: true });

      // O ecrã a escurecer (helper 1501 com a acção 1532): no original é um
      // ecrã branco invertido; aqui, a subtrair, que dá o mesmo escuro.
      if (time === fighter.elemStart(4) + 15) {
        screenFx(fighter, 1532, {
          layer: 'backdrop', blend: { subtract: true, alpha: 0.6 }, duration: 150, fadeOut: 15, loop: true,
        });
      }
      // No 5.º frame o fundo vai ao preto (o helper 3501), até ao vidro partir.
      if (time === fighter.elemStart(5)) dimBackground(fighter, FEAST_BLACKOUT);
      // Os três clarões de impacto (1533) e a moldura de sangue (1534).
      if ([60, 80, 100].includes(time)) screenFx(fighter, 1533, { blend: { alpha: 0.5, additive: true } });
      if (time === 60) screenFx(fighter, 1534, { fadeOut: 20 });

      const due = time >= FEAST_FIRST && (time - FEAST_FIRST) % 5 === 0 && struck.feast < FEAST_HITS;
      if (due) {
        const sounds = [];
        // Os sons de carne e de corte, e a fala dele de tempos a tempos.
        if (struck.feast % 2 === 0) {
          sounds.push(
            { sound: [10, 73], volume: 0.25 },
            { sound: [10, 77], volume: 0.5 },
            { sound: [10, 78], volume: 0.5 },
            { sound: [10, 79], volume: 0.3 },
            { sound: [1, 34], volume: 0.25 },
          );
        }
        if (struck.feast % 3 === 0) sounds.push({ sound: [0, 205 + Math.floor(Math.random() * 4)] });
        if (!strike(fighter, { ...FEAST_HIT, sounds }, { spread: 15 })) {
          fighter.finishMove();
          return;
        }
        struck.feast += 1;
      }
      if (struck.feast >= FEAST_HITS && time > FEAST_FIRST + (FEAST_HITS - 1) * 5) {
        fighter.startMove(1520);
      }
    },
  },

  // O fecho: o vidro do ecrã parte e o adversário é atirado para longe.
  1520: {
    action: 1520,
    invulnerable: true,
    trail: true,
    physics: 'S',
    stop: true,
    effects: [
      // A poça por baixo dele (1535).
      {
        time: 0, action: 1535, atlas: 'supers', onOpponent: true, at: [0, 3], scale: [0.2, 0.15],
        layer: 'back', blend: ADD, duration: 120, fadeOut: 40, loop: true,
      },
    ],
    tick(fighter) {
      const time = fighter.moveTime;
      const blow = fighter.elemStart(3);
      if (time < blow) hold(fighter, 20, { lying: true });

      if (time === blow) {
        screenFx(fighter, 9016, { duration: 36 });
        const foe = fighter.opponent;
        if (foe) foe.downTicks = 0;
        const landed = strike(fighter, {
          damage: 21,
          stun: 15,
          push: [-5, -5],
          fall: true,
          pause: [0, 10],
          sounds: [
            { sound: [10, 74] },
            { sound: [10, 78] },
            { sound: [10, 79], volume: 0.45 },
            { sound: [10, 80] },
          ],
          shake: [15, 20],
        });
        if (landed) {
          fighter.spawnEffect({ action: 1010, atlas: 'supers', onOpponent: true, at: [0, -15], scale: 0.5, blend: ADD });
        }
      }
      if (time === blow + 2) screenFx(fighter, 9017, { blend: { alpha: 0.5, additive: true } });
    },
  },
};

// ---------------------------------------------------------- Devouring Hunt

/** Os toques que se seguem ao salto: o adversário ainda tem de estar perto. */
const inReach = (fighter, far = 150) => {
  const gap = opponentGap(fighter);
  return foeIsReeling(fighter) && gap >= -far && gap <= far;
};

/**
 * As investidas do 1560 e do 1565 atravessam o adversário (PlayerPush=0):
 * como aqui os corpos se empurram, ao chegar-lhe ao pé o Kaneki salta para
 * o outro lado dele.
 */
function passThrough(fighter) {
  const foe = fighter.opponent;
  if (!foe) return;
  const gap = (centerX(foe) - centerX(fighter)) * fighter.facing;
  const bodies = (fighter.width + foe.width) / 2;
  if (gap > 0 && gap < bodies + Math.abs(fighter.velocity.x)) {
    const x = centerX(foe) + (bodies + 1) * fighter.facing - fighter.width / 2;
    fighter.position.x = Math.max(0, Math.min(x, fighter.bounds.width - fighter.width));
  }
}

/** Vira-se para o adversário (o Turn do original, a meio da investida). */
function faceOpponent(fighter) {
  const foe = fighter.opponent;
  if (foe) fighter.facing = Math.sign(centerX(foe) - centerX(fighter)) || fighter.facing;
}

/** O arranque das investidas: os riscos de velocidade e a poeira. */
const DASH_EFFECTS = [
  streak({ elem: 3, at: [25, -25], scale: [0.75, 0.25] }),
];
const DASH_SOUNDS = [
  { elem: 3, sound: [5, 43] },
  { elem: 3, sound: [40, 3], volume: 0.75 },
];

/** A investida (elems 3 a 5) com o atravessar e o virar a meio. */
function dash(fighter) {
  const time = fighter.moveTime;
  if (time === fighter.elemStart(3)) fighter.fx?.spawnAt(fighter, 7030, { dx: 15, scale: 0.3, layer: 'back' });
  if (time >= fighter.elemStart(3) && time < fighter.elemStart(5)) passThrough(fighter);
  if (time === fighter.elemStart(5) + 3) faceOpponent(fighter);
}

const CUT_SOUNDS = [
  { sound: [10, 136] },
  { sound: [10, 136], volume: 0.25 },
  { sound: [10, 78] },
  { sound: [10, 79], volume: 0.75 },
  { sound: [1, 14], volume: 0.5 },
];

const devouringHunt = {
  // Salta em frente com um corte; se acertar, continua no 1555.
  1550: {
    action: 1550,
    invulnerable: duringSuperPause,
    trail: true,
    physics: 'N',
    stop: true,
    power: -1000,
    velocity: [
      { elem: 6, x: 6, y: -4.5 },
      { elem: 10, y: -0.5 },
    ],
    physicsAt: [{ elem: 6, physics: 'A' }],
    sounds: [
      { elem: 6, sound: [5, 43] },
      { elem: 6, sound: [40, 3], volume: 0.75 },
      { time: 45, sound: [10, 107] },
      { time: 45, sound: [10, 108], volume: 0.5 },
    ],
    effects: [SUPER_AURA],
    hit: {
      damage: 20,
      stun: 25,
      push: [-7.5, 0],
      pause: [10, 15],
      sounds: [
        { sound: [1, 14], volume: 0.75 },
        { sound: [1, 33], volume: 0.75 },
        { sound: [10, 37], volume: 0.35 },
      ],
    },
    tick(fighter) {
      const time = fighter.moveTime;
      superPause(fighter, { lines: true });
      voice(fighter, [0, 75]);
      if (time === FIRST_TICK) fighter.fx?.tremble(5, 10);
      if (time === fighter.elemStart(6)) {
        fighter.fx?.spawnAt(fighter, 7026, { dx: 3, dy: -2, scale: 0.45, blend: SOFT, layer: 'back' });
      }
      // No ar trava como os golpes aéreos (os VelAdd do original).
      if (time > fighter.elemStart(6)) fighter.applyDrag([0.2, 0.2, 0.15]);

      if (fighter.moveHit && time >= fighter.elemStart(10)) fighter.startMove(1555);
    },
  },

  // Cai, assenta e dá o segundo corte.
  1555: {
    action: 1555,
    trail: true,
    // No original é 'A' até ao 5.º frame; aqui a gravidade vai à mão, para
    // o golpe não acabar ao tocar no chão antes do tempo.
    physics: 'N',
    power: -500,
    velocity: [
      { elem: 5, x: 0, y: 0 },
      { elem: 6, x: 5 },
      { elem: 7, x: 2.5 },
    ],
    physicsAt: [{ elem: 5, physics: 'S' }],
    sounds: [{ time: 13, sound: [10, 108], volume: 0.25 }],
    tick(fighter) {
      const time = fighter.moveTime;
      if (time < fighter.elemStart(5)) fighter.velocity.y += fighter.constants.gravity * fighter.unit;
      if (time === fighter.elemStart(5)) fighter.position.y = fighter.groundY;

      if (time === fighter.elemStart(7) && inReach(fighter, 110)
        && strike(fighter, {
          damage: 20,
          stun: 25,
          push: [-8, 0],
          pause: [10, 15],
          sounds: [{ sound: [1, 33], volume: 0.75 }, { sound: [10, 37], volume: 0.35 }],
          shake: [8, 8],
        })) {
        fighter.startMove(1560);
      }
    },
  },

  // Atravessa-o a correr, vira-se e corta mais duas vezes; o último puxa-o.
  1560: {
    action: 1560,
    trail: true,
    physics: 'S',
    stop: true,
    velocity: [
      { elem: 3, x: 10 },
      { elem: 5, x: 2 },
    ],
    physicsAt: [
      { elem: 3, physics: 'N' },
      { elem: 5, physics: 'S' },
    ],
    sounds: DASH_SOUNDS,
    effects: DASH_EFFECTS,
    tick(fighter) {
      const time = fighter.moveTime;
      dash(fighter);

      const second = [
        { sound: [10, 73], volume: 0.5 },
        { sound: [10, 77] },
        { sound: [10, 78] },
        { sound: [10, 79], volume: 0.45 },
      ];
      if (time === fighter.elemStart(4) && inReach(fighter)) {
        strike(fighter, { damage: 20, stun: 25, push: [0, 0], pause: [10, 15], sounds: CUT_SOUNDS, shake: [8, 8] });
      }
      if (time === fighter.elemStart(6) && inReach(fighter)) {
        strike(fighter, { damage: 25, stun: 25, push: [-7.5, 0], pause: [10, 15], sounds: second, shake: [8, 8] });
      }
      if (time === fighter.elemStart(10) && inReach(fighter)
        && strike(fighter, { damage: 25, stun: 25, push: [5, 0], pause: [10, 15], sounds: second, shake: [8, 8] })) {
        fighter.startMove(1565);
      }
    },
  },

  // Outra vez a atravessá-lo; o segundo corte atira-o ao ar.
  1565: {
    action: 1565,
    trail: true,
    physics: 'S',
    stop: true,
    velocity: [
      { elem: 3, x: 10 },
      { elem: 5, x: 2 },
    ],
    physicsAt: [
      { elem: 3, physics: 'N' },
      { elem: 5, physics: 'S' },
    ],
    sounds: DASH_SOUNDS,
    effects: DASH_EFFECTS,
    tick(fighter) {
      const time = fighter.moveTime;
      dash(fighter);

      if (time === fighter.elemStart(4) && inReach(fighter)) {
        strike(fighter, { damage: 20, stun: 25, push: [0, 0], pause: [10, 15], sounds: CUT_SOUNDS, shake: [8, 8] });
      }
      if (time === fighter.elemStart(6) && inReach(fighter)
        && strike(fighter, {
          damage: 30,
          stun: 25,
          push: [-2, -3.5],
          fall: true,
          pause: [10, 15],
          sounds: [
            { sound: [10, 78] },
            { sound: [10, 79] },
            { sound: [10, 139] },
            { sound: [10, 139], volume: 0.25 },
          ],
          shake: [10, 12],
        })) {
        stateOf(fighter).launched = true;
      }
      if (time >= fighter.elemStart(7) && stateOf(fighter).launched) {
        stateOf(fighter).launched = false;
        fighter.startMove(1570);
      }
    },
  },

  // O fecho: a kagune (1571) espeta-o a 90 px e segura-o no ar uns ticks.
  1570: {
    action: 1570,
    trail: true,
    physics: 'S',
    stop: true,
    effects: [
      // Presa ao Kaneki até ao 9.º frame (o RemoveExplod do original).
      { elem: 7, action: 1571, layer: 'back', duration: 21, loop: true },
    ],
    tick(fighter) {
      const time = fighter.moveTime;
      const struck = stateOf(fighter);
      if (time === FIRST_TICK) struck.finisher = either([0, 25], [0, 11]);
      voice(fighter, struck.finisher);

      // A caixa do original chega aos 212 px, com a kagune; a arte do
      // corpo, só aos 91.
      const gap = opponentGap(fighter);
      if (time === fighter.elemStart(7) && foeIsReeling(fighter) && gap >= -10 && gap <= 230) {
        hold(fighter, 90, { dy: -7 });
        const landed = strike(fighter, {
          damage: 65,
          stun: 25,
          push: [0, 0],
          fall: true,
          pause: [10, 35],
          sounds: [
            { sound: [10, 139] },
            { sound: [10, 139], volume: 0.5 },
            { sound: [10, 74] },
            { sound: [10, 78] },
            { sound: [10, 79], volume: 0.45 },
          ],
          shake: [12, 20],
        });
        if (landed) {
          fighter.spawnEffect({ action: 1010, atlas: 'supers', at: [90, -15], scale: 0.5, blend: ADD });
          fighter.spawnEffect({
            action: 1535, atlas: 'supers', at: [90, 2], scale: [0.35, 0.3], layer: 'back',
            blend: ADD, duration: 150, fadeOut: 50, loop: true,
          });
        }
      }
    },
  },
};

// -------------------------------------------------------- Rinkaku Overkill

/** Frames do 1600: o ciclo da rajada (11 a 14) e o fim (15). */
const BURST_START = 38;
const BURST_END = 48;
const BURST_HITS = 15;

/**
 * Os dois toques de cada volta da rajada. O empurrão depende da distância,
 * como no original: perto afasta, longe puxa.
 */
function burstHit(fighter, damage) {
  const gap = opponentGap(fighter);
  const pushX = gap >= 0 && gap <= 70 ? -4 : gap >= 80 ? 2 : -1;
  return {
    damage,
    stun: 15,
    push: [pushX, 0],
    pause: [0, 3],
    sounds: [
      { sound: [10, 136], volume: 0.5 },
      { sound: [10, 136], volume: 0.25 },
      { sound: [10, 78], volume: 0.5 },
      { sound: [10, 79], volume: 0.25 },
    ],
  };
}

/** O que a rajada larga à frente dele: pontas de kagune, riscos e pó. */
function burstEffects(fighter, time) {
  if (time % 6 === 0) {
    play(fighter, either([10, 66], [10, 67]), 0.65);
    play(fighter, [10, 111], 0.5);
  }
  if (time % 5 === 0) {
    const at = [35 + Math.random() * 15, -45 + Math.random() * 35];
    fighter.spawnEffect({ action: 1617, atlas: 'supers', at, scale: 0.065, velocity: [-0.5, 0], blend: { alpha: 0.78, additive: true } });
    fighter.spawnEffect({ action: 1618, atlas: 'supers', at, scale: [0.35, 0.375], angle: -90 });
  }
  if (time % 10 === 0) {
    fighter.fx?.spawnAt(fighter, 520, { dx: -5, scale: 0.4, velocity: [-0.5, 0], blend: SOFT, layer: 'back' });
  }
}

const rinkakuOverkill = {
  // A rajada: a kagune a espetar sem parar. Enquanto acertar repete os
  // frames 11 a 14 (os ChangeAnim do original); ao 15.º toque passa ao 1605.
  1600: {
    action: 1600,
    invulnerable: true,
    trail: true,
    physics: 'N',
    stop: true,
    loop: true,
    power: -2000,
    effects: [SUPER_AURA],
    tick(fighter) {
      const time = fighter.moveTime;
      const burst = stateOf(fighter);
      if (time === FIRST_TICK) {
        burst.hits = 0;
        burst.voice = either([0, 76], [0, 55]);
      }
      superPause(fighter, { lines: true });
      voice(fighter, burst.voice, [0.5, 0.25]);

      // A animação anda à parte do tempo do golpe: volta ao frame 11 de 10
      // em 10 ticks, até aos 70 (200 se estiver a acertar).
      const animator = fighter.animator;
      const limit = fighter.moveHit ? 200 : 70;
      if (time >= 40 && time <= limit && time % 10 === 0 && animator.tick < BURST_END + 2) {
        animator.tick = BURST_START;
      }
      // Longe dele, desiste da rajada.
      const gap = opponentGap(fighter);
      if (time >= 100 && (gap < -20 || gap > 100) && animator.tick < BURST_END) animator.tick = BURST_END;

      const frame = animator.tick;
      if (frame >= BURST_START && frame < BURST_END + 4) burstEffects(fighter, time);
      if (frame === 40 || frame === 45) {
        burst.hits += fighter.hitCount;
        fighter.arm(burstHit(fighter, frame === 40 ? 25 : 5));
      }

      if (burst.hits + fighter.hitCount >= BURST_HITS) {
        fighter.startMove(1605);
        return;
      }
      if (frame >= animator.current.totalTicks) fighter.finishMove();
    },
  },

  // A kagune estende-se de uma vez: afasta-o, espeta-o e puxa-o de volta.
  1605: {
    action: 1605,
    trail: true,
    physics: 'S',
    stop: true,
    sounds: [
      { time: 7, sound: [10, 65], volume: 0.5 },
      { time: 7, sound: [10, 111] },
      { time: 7, sound: [10, 108] },
    ],
    effects: [
      // As pontas que saem disparadas em frente (helper 012, acção 1619).
      { elem: 4, action: 1619, atlas: 'supers', at: [40, -35], scale: 0.2, velocity: [15, 0], angle: 90, blend: ADD },
      { elem: 4, action: 1619, atlas: 'supers', at: [40, -15], scale: 0.2, velocity: [15, 0], angle: 90, blend: ADD },
      { elem: 4, action: 1617, atlas: 'supers', at: [30, -25], scale: 0.1, velocity: [-0.5, 0], blend: ADD },
    ],
    tick(fighter) {
      const time = fighter.moveTime;
      const stab = [
        { sound: [10, 78] },
        { sound: [10, 139] },
        { sound: [10, 139], volume: 0.25 },
        { sound: [10, 79], volume: 0.4 },
      ];
      if (time < fighter.elemStart(5)) hold(fighter, 75);
      else if (time < fighter.elemStart(7)) hold(fighter, 135);
      else hold(fighter, 90);

      if (time === fighter.elemStart(4)) {
        strike(fighter, { damage: 33, stun: 20, push: [0, 0], pause: [4, 2], sounds: stab, shake: [10, 8] });
      }
      if (time === fighter.elemStart(5)) {
        fighter.fx?.tremble(4, 10);
        strike(fighter, { damage: 33, stun: 20, push: [0, 0], pause: [0, 10] });
      }
      if (time === fighter.elemStart(7)
        && strike(fighter, { damage: 0, stun: 75, push: [0, 0], pause: [0, 2] })) {
        fighter.startMove(1610);
      }
    },
  },

  // Gancho de kagune que o atira ao ar, e sobe atrás dele.
  1610: {
    action: 1610,
    trail: true,
    physics: 'S',
    stop: true,
    velocity: [{ elem: 4, x: 1.5, y: -8.5 }],
    physicsAt: [{ elem: 4, physics: 'A' }],
    sounds: [
      { time: 10, sound: [10, 65], volume: 0.5 },
      { time: 10, sound: [10, 67], volume: 0.4 },
      { time: 10, sound: [10, 111] },
      { time: 10, sound: [10, 108] },
    ],
    tick(fighter) {
      const time = fighter.moveTime;
      const struck = stateOf(fighter);
      if (time === FIRST_TICK) struck.uppercut = false;
      if (time < fighter.elemStart(6)) hold(fighter, 90);

      if (time === fighter.elemStart(6)) {
        struck.uppercut = strike(fighter, {
          damage: 40,
          stun: 15,
          push: [-2.5, -8],
          fall: true,
          pause: [8, 8],
          sounds: [
            { sound: [10, 37], volume: 0.35 },
            { sound: [10, 68] },
            { sound: [10, 139] },
            { sound: [10, 79], volume: 0.5 },
          ],
          shake: [8, 10],
        });
      }
      if (time >= fighter.elemStart(9) && struck.uppercut) fighter.startMove(1615);
    },
  },

  // Lá de cima, a kagune (1616) crava-se no chão onde ele caiu: sete
  // toques, os espetos de pedra a rebentar à volta e o último que o deixa
  // estendido.
  1615: {
    action: 1615,
    invulnerable: true,
    trail: true,
    physics: 'N',
    velocity: [
      { elem: 3, x: 0.15, y: -0.15 },
      { elem: 4, x: 1.5, y: -4.4 },
      { elem: 8, x: 0, y: 0 },
      { elem: 12, x: -2, y: -3 },
    ],
    physicsAt: [
      { elem: 4, physics: 'A' },
      { elem: 5, physics: 'N' },
      { elem: 11, offset: 2, physics: 'A' },
    ],
    sounds: [
      { elem: 2, sound: [10, 81] },
      { elem: 2, sound: [10, 108], volume: 0.5 },
      { elem: 5, sound: [10, 64] },
      { elem: 5, sound: [10, 65], volume: 0.5 },
      { elem: 5, sound: [10, 66], volume: 0.75 },
    ],
    // A kagune gigante, presa ao corpo.
    projectiles: [{ elem: 2, action: 1616, bound: true, lifetime: 61 }],
    effects: [
      { elem: 3, action: 1624, atlas: 'supers', at: [2, -43], scale: 0.15, blend: ADD },
    ],
    tick(fighter) {
      const time = fighter.moveTime;
      const struck = stateOf(fighter);
      if (time === FIRST_TICK) {
        struck.stabs = 0;
        struck.voice = either([0, 52], [0, 61]);
      }
      if (time === FIRST_TICK || time === FIRST_TICK + 2) play(fighter, struck.voice);
      if (time === FIRST_TICK + 1) play(fighter, struck.voice, 0.5);

      // Preso lá em baixo, 70 à frente e (no máximo) 150 abaixo dele.
      if (struck.stabs < 8) hold(fighter, 70, { dy: 150, lying: true });

      // O chão rebenta (helper 000): a racha, a luz, o pó e os espetos.
      const burst = fighter.elemStart(8);
      if (time === burst) {
        groundFx(fighter, 1625, { dx: 75, dy: 4, scale: 0.4, blend: ADD });
        groundFx(fighter, 1626, { dx: 75, scale: 0.5, blend: ADD });
        groundFx(fighter, 1623, { dx: 75, dy: 3, scale: [0.3, 0.15], layer: 'back', duration: 200, fadeOut: 60 });
        groundFx(fighter, 393, { dx: 75, scale: 0.525, blend: ADD });
        groundFx(fighter, 395, { dx: 75, scale: 0.3, flip: true, blend: ADD });
        groundFx(fighter, 396, { dx: 75, scale: 0.3, flip: true });
        groundFx(fighter, 1620, { dx: 95, dy: 8, scale: 0.2, angle: 15 });
        groundFx(fighter, 1620, { dx: 55, dy: 8, scale: 0.2, angle: 15, flip: true });
        // A onda de choque (1621), a nuvem de terra e pedras (1622) e o anel
        // de pó rente ao chão (392), de fx-superpause.
        groundFx(fighter, 1621, { dx: 75, dy: 4, scale: 0.225, atlas: 'superpause' });
        groundFx(fighter, 1622, { dx: 75, dy: 4, scale: 0.225, atlas: 'superpause' });
        groundFx(fighter, 392, { dx: 75, dy: 4, scale: 0.2, layer: 'back', atlas: 'superpause' });
      }
      if (time === burst + 5) {
        groundFx(fighter, 1620, { dx: 110, dy: 5, scale: 0.275 });
        groundFx(fighter, 1620, { dx: 40, dy: 5, scale: 0.275, flip: true });
      }
      if (time === burst + 10) {
        groundFx(fighter, 1620, { dx: 90, dy: 2, scale: 0.275, angle: 15, layer: 'back' });
        groundFx(fighter, 1620, { dx: 60, dy: 2, scale: 0.275, angle: 15, flip: true, layer: 'back' });
      }

      // Sete toques de 3 em 3 ticks e o último, mais forte.
      const due = time >= 30 && (time - 30) % 3 === 0;
      if (due && struck.stabs < 7) {
        const sounds = struck.stabs === 0 ? [{ sound: [5, 75], volume: 0.5 }] : [];
        if (struck.stabs % 3 === 0) {
          sounds.push(
            { sound: [10, 70], volume: 0.75 },
            { sound: [10, 74], volume: 0.5 },
            { sound: [10, 139] },
          );
        }
        if (strike(fighter, { damage: 10, stun: 20, push: [0, 0], pause: [2, 5], slash: true, sounds, shake: [10, 10] }, { spread: 12 })) {
          struck.stabs += 1;
          // Ao segundo toque saltam cinco pedras de onde ele está (os helpers
          // 1622): duas para a frente e três para trás.
          if (struck.stabs === 2) {
            for (const facing of [1, 1, -1, -1, -1]) {
              throwRock(fighter, centerX(fighter) + 75 * fighter.facing * fighter.unit, {
                scale: 0.5,
                speed: [2 + Math.floor(Math.random() * 3), -6 - Math.floor(Math.random() * 6)],
                facing,
                rest: 150,
                fade: 13,
              });
            }
          }
        }
      } else if (due && struck.stabs === 7) {
        struck.stabs = 8;
        if (strike(fighter, { damage: 20, stun: 20, push: [0, 0], pause: [2, 5], slash: true, shake: [15, 20] })) {
          // Fica estendido (o estado 1626 do original).
          const foe = fighter.opponent;
          if (!foe.isDefeated) foe.downTicks = 30;
        }
      }
    },
  },
};

// ---------------------------------------------------------------- comandos

export const KANEKI_SUPERS = {
  moves: { ...halfKill, ...devouringHunt, ...rinkakuOverkill },
  commands: {
    // ↓→↓→ ou ↓←↓← e o botão, em 30 ticks, como no original. Carregar para
    // trás vira o Kaneki, por isso o segundo ← conta já como "frente": o
    // ↓←↓← chega aqui como ↓ trás ↓ frente. O golpe sai para onde ele olhava
    // ao começar o comando.
    motions: ['a', 'b', 'c'].flatMap((button) => [
      { name: `superF${button}`, sequence: ['D', 'F', 'D', 'F'], button, window: 30 },
      { name: `superB${button}`, sequence: ['D', 'B', 'D', 'B'], button, window: 30 },
      { name: `superBT${button}`, sequence: ['D', 'B', 'D', 'F'], button, window: 30 },
    ]),
    ground: [
      ...['superF', 'superB', 'superBT'].flatMap((motion) => [
        { input: `${motion}a`, to: 1500, power: 1500 },
        { input: `${motion}b`, to: 1550, power: 1500 },
        { input: `${motion}c`, to: 1600, power: 2000 },
      ]),
    ],
    air: [],
  },
};
