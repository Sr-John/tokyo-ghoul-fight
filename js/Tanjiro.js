import { buildAnimations, pickSounds } from './characterAnimations.js';
import { MoveFighter } from './MoveFighter.js';
import { TANJIRO_COMMANDS, TANJIRO_CONSTANTS, TANJIRO_MOVES } from './tanjiroMoves.js';
import { REINFORCE_COOLDOWN, REINFORCE_TICKS, TANJIRO_EXTRA } from './tanjiroExtraMoves.js';
import { TANJIRO_SWORDLESS } from './tanjiroSwordless.js';
import { combineMoves } from './moveTables.js';

/** Os golpes do Tanjiro com espada: os da tabela principal e os extra. */
const ARMED = combineMoves(
  { moves: TANJIRO_MOVES, commands: TANJIRO_COMMANDS },
  TANJIRO_EXTRA,
);

/** Os golpes com espada só saem com ela na mão (a Var(11) = 0 do .cmd). */
const withSword = (command) => ({
  ...command,
  when: (fighter) => !fighter.isSwordless && (command.when?.(fighter) ?? true),
});

/** Todos: os sem espada (tanjiroSwordless.js) vêm primeiro, e só saem sem ela. */
const MOVES = { ...TANJIRO_SWORDLESS.moves, ...ARMED.moves };
const COMMANDS = {
  motions: ARMED.commands.motions,
  ground: [...TANJIRO_SWORDLESS.commands.ground, ...ARMED.commands.ground.map(withSword)],
  air: [...TANJIRO_SWORDLESS.commands.air, ...ARMED.commands.air.map(withSword)],
};

/**
 * O adversário: Tanjiro Kamado.
 *
 * A arte e os golpes vêm do personagem de MUGEN exportado para
 * assets/tanjiro. É um lutador como o Kaneki — recebe as mesmas "teclas" —
 * só que quem as prime é a EnemyAi, ou um segundo jogador.
 */

/**
 * A Dança do Deus do Fogo: quanto os especiais tiram a mais, e os efeitos
 * de fogo. Os arcos da espada existem em duas cores, que são a mesma acção
 * com 10000 (água) ou 20000 (fogo) somados ao número.
 */
const HINOKAMI_DAMAGE = 1.5;
const FIRST_SPECIAL = 1000;
const WATER_ARCS = 10000;
const FIRE_ARCS = 20000;
const FIRE_ACTION = 7653;
/** De quantos em quantos ticks a espada larga uma labareda: num especial, e parado. */
const FIRE_EVERY = 3;
const EMBER_EVERY = 14;

/**
 * Os golpes de cada ultimate, pelo nome da fotografia dele: `cuts` (os quatro
 * cortes, ↓ + 5) e `dragon` (o dragão de água, ↓ + 6). Ao começar um, a
 * fotografia dele aparece uns segundos, escurecida para os lutadores e os
 * efeitos se verem por cima, e depois apaga-se. Se o ultimate acabar antes,
 * sai com ele.
 */
const ULTIMATE_MOVES = {
  // Os da Dança (4000…, ↓ + 5; 4100…, ↓ + 6) usam as mesmas.
  cuts: new Set([3000, 3001, 3002, 3003, 3004, 4000, 4001, 4002, 4003, 4004, 4012, 4013]),
  dragon: new Set([1800, 1801, 4100, 4101, 4102]),
};
const BACKDROP_TAG = 'tanjiro:ultimate';
const BACKDROP_FILTER = 'brightness(0.7)';
const BACKDROP_TICKS = 90;
const BACKDROP_FADE_TICKS = 20;

/**
 * Ao ligar a Dança do Deus do Fogo: a câmara fecha nele e a fotografia do
 * modo cobre o fundo, durante este tempo (o último bocado a apagar-se).
 */
const HINOKAMI_SPOTLIGHT_TICKS = 90;
const HINOKAMI_FADE_TICKS = 15;

/** Os efeitos dos especiais, pelo número da acção. */
const DUST_ACTION = 6120;
const SPLASH_ACTION = 7652;
/** O rebentar em chamas dos golpes da Dança (atlas extra). */
const FIRE_BURST_ACTION = 10065;

/** De quantos em quantos ticks ele respira. */
const BREATH_EVERY = 15;

/** Com o reforço ligado, de quantos em quantos ticks se vê o bafo. */
const REINFORCE_BREATH_EVERY = 20;

/** A esquiva do reforço. */
const DODGE_MOVE = 900;

/**
 * As defesas automáticas (os HitOverride do statedef -3 do original): com a
 * Dança ligada, um golpe que o apanhe tem 15% de virar a esquiva por trás
 * e outros 15% de virar a guarda do contra-ataque; sem espada, 15% de virar
 * a defesa. (No .cmd o do contra-ataque é `random > 150 && random < 300`,
 * dois sorteios, que no MUGEN dão mais do que isso; fica o que o autor quis.)
 */
const AUTO_DEFENSE_CHANCE = 0.15;
const FIRE_DODGE = 41504;
const FIRE_COUNTER = 41500;
const SWORDLESS_PARRY = 113350;

/**
 * A espada atirada (o helper 41181 do original), nas medidas do MUGEN:
 * sai a 30 por tick, um pouco para cima e apontada à altura do adversário,
 * e vai caindo. Se o apanha, fica-lhe espetada um instante e salta dele a
 * rodar (a acertar de 10 em 10 ticks) até se espetar no chão; se não, salta
 * assim que bate no chão ou chega à beira do ecrã.
 */
const SWORD = {
  at: [3, -40],
  speed: 30,
  lift: -4,
  aim: 0.1,
  gravity: 0.1,
  // A 41182 do original solta-a logo; fica uns ticks para se ver espetada.
  stuckTicks: 20,
  pop: { speed: 2, lift: -8, gravity: 0.25, spin: 30, every: 10 },
  edge: 30,
  // Ao pé dela (|x| ≤ 40, |y| ≤ 30) apanha-se com o 4.
  reach: [40, 30],
  // O computador recupera-a sozinho passados 20 s, como no original.
  aiReturnTicks: 1200,
  hit: { damage: 60, stun: 45, push: [0, 0], pause: [0, 140], sounds: [{ sound: [1, 25] }] },
  // Ao sair do corpo dele. No original este segundo toque vem logo a seguir
  // ao primeiro e prende-o 200 ticks; aqui vem `stuckTicks` depois, e
  // prende-o o que falta para os mesmos 200.
  tearOut: {
    damage: 50, stun: 45, push: [0, 0], pause: [0, 180], sounds: [{ sound: [4, 0] }],
  },
  spin: { damage: 20, stun: 45, push: [-2, -2], pause: [0, 10], sounds: [{ sound: [1, 25] }] },
  // A que a arranca de quem estiver em cima dela (41185).
  grab: { damage: 50, stun: 45, push: [-2, -2], pause: [0, 120], sounds: [{ sound: [1, 25] }] },
  grabBox: [-11, -28, 9, 8],
  sprites: { flying: '3782,0', stuck: '3782,1', ground: '3782,3' },
};

/** As animações que mudam sem espada (idle → idleSwordless…). */
const SWORDLESS_POSES = new Set(['idle', 'walk', 'jump', 'crouch']);

/**
 * Animações que o jogo corta de outras, porque o original muda de animação
 * a meio (ChangeAnim com elem): número novo -> [acção, frame de onde começa].
 */
const DERIVED_ACTIONS = {
  // A aterragem do corte em queda (1702 passa à 1722 no 5.º frame).
  17225: [1722, 5],
};

/** Junta ao personagem as animações de DERIVED_ACTIONS, uma vez. */
function withDerivedActions(character) {
  for (const [number, [action, elem]] of Object.entries(DERIVED_ACTIONS)) {
    const source = character.actions[action];
    if (source && !character.actions[number]) {
      character.actions[number] = { frames: source.frames.slice(elem - 1) };
    }
  }
  return character;
}

/** As animações de estar e reagir, pelo número da acção no MUGEN. */
const TANJIRO_ACTIONS = {
  idle: { action: 0 },
  walk: { action: 20 },
  jump: { action: 41 },
  crouch: { action: 11 },

  // Sem espada, o original soma 11000 às de estar (a Var(11)).
  idleSwordless: { action: 11000 },
  walkSwordless: { action: 11020 },
  jumpSwordless: { action: 11041 },
  crouchSwordless: { action: 11011 },

  hurt: { action: 5000 },
  hurtAir: { action: 5050 },
  down: { action: 5110 },
  getUp: { action: 5120, loop: false },
  dead: { action: 5150 },

  // Vitória: a respirar fundo, de espada na mão, com a fala dele.
  win: { action: 181, sounds: [{ at: 1, sound: [0, 45] }] },
  // A mesma, ganha com a Dança do Deus do Fogo ligada: outra pose e outra fala.
  winFire: {
    action: 182,
    sounds: [
      { at: 1, sound: [0, 94] },
      { at: 1, sound: [9103, 4] },
    ],
  },

  // Entrada: de espada na mão, antes de a baixar, com a fala dele.
  intro: {
    action: 190,
    loop: false,
    sounds: [
      { at: 1, sound: [0, 2] },
      { at: 1, sound: [1, 41] },
    ],
  },
};

export class Tanjiro extends MoveFighter {
  /** `character` é o CharacterAtlas do Tanjiro; sem ele, fica um retângulo. */
  /**
   * `ultimateBackdrops` são as fotografias (Pictures) de fundo dos ultimates,
   * { cuts, dragon }; `hinokamiBackdrop`, a de ligar a Dança do Deus do Fogo.
   */
  constructor({
    character = null, ultimateBackdrops = {}, hinokamiBackdrop = null, ...options
  }) {
    super({
      animations: character
        ? buildAnimations(withDerivedActions(character), TANJIRO_ACTIONS, MOVES)
        : {},
      moveSet: MOVES,
      commands: COMMANDS,
      constants: TANJIRO_CONSTANTS,
      sounds: pickSounds(TANJIRO_ACTIONS),
      playSound: ([group, item], { volume } = {}) =>
        character?.playSound(group, item, { volume }) ?? null,
      // A entrada dele só toca quando a câmara lá chega.
      autoIntro: false,
      ...options,
    });

    this.character = character;
    this.ultimateBackdrops = ultimateBackdrops;
    this.hinokamiBackdrop = hinokamiBackdrop;

    /** Ticks em que a câmara ainda fica nele (quem a move é o main.js). */
    this.spotlightTicks = 0;
    /** O ultimate cuja fotografia está no ecrã ('cuts', 'dragon'), ou null. */
    this.shownBackdrop = null;

    /** Verdadeiro com a Dança do Deus do Fogo ligada. */
    this.isHinokami = false;

    /** Ticks que ainda faltam ao reforço (1900), e até ele se poder repetir. */
    this.reinforceTicks = 0;
    this.reinforceCooldown = 0;

    /** As chamas que andam agarradas a ele: { effect, place }. */
    this.boundFlames = [];

    /** Sem espada (a Var(11) do original), e há quantos ticks. */
    this.isSwordless = false;
    this.swordlessTicks = 0;
    /**
     * A espada atirada, enquanto não a apanha: { phase, x, y, vx, vy, angle,
     * tick, facing, lastHit }, com x e y no ecrã. `phase` é 'flying',
     * 'stuck' (espetada no adversário), 'popping' (a saltar dele) ou 'ground'.
     */
    this.sword = null;
  }

  /** O reforço está ligado: os golpes que o apanhem viram esquivas. */
  get isReinforced() {
    return this.reinforceTicks > 0;
  }

  get canReinforce() {
    return this.reinforceCooldown === 0 && !this.isReinforced;
  }

  startReinforceCooldown() {
    this.reinforceCooldown = REINFORCE_COOLDOWN;
  }

  startReinforce() {
    this.reinforceTicks = REINFORCE_TICKS;
  }

  /** Nos golpes invulneráveis (as esquivas, as cenas dos ultimates) não há onde acertar. */
  getHurtBoxes() {
    if (this.move?.invulnerable && !this.isLocked) return [];
    return super.getHurtBoxes();
  }

  /**
   * Um golpe a chegar: numa guarda (41500, 113300, 113350) vira
   * contra-ataque; senão, pode virar uma das defesas automáticas
   * (`autoDefense`). Se nada disso, leva-o.
   */
  receiveHit(hit) {
    const { move } = this;
    if (move?.counter && this.moveTime <= move.counter && !this.isLocked) {
      this.startMove(move.onCounter);
      // O adversário fica preso enquanto ele lhe passa por trás.
      this.opponent?.receiveHit({ damage: 0, stun: 45, pause: 30, direction: this.facing });
      return;
    }
    const defense = this.autoDefense();
    if (defense !== null) {
      // O golpe não chega a entrar: sai do que estivesse a sofrer e defende-se.
      this.hitStun = 0;
      this.isFalling = false;
      this.knockback = 0;
      this.hitPause = 0;
      this.startMove(defense);
      return;
    }
    super.receiveHit(hit);
  }

  /**
   * Os HitOverride do original, pela ordem em que ganham: sem espada, 15% de
   * defesa; com o reforço (água), sempre a esquiva; com a Dança, 15% de
   * esquiva por trás e 15% de guarda do contra-ataque. Null: leva o golpe.
   */
  autoDefense() {
    if (this.isDefeated || this.downTicks > 0) return null;
    if (this.isSwordless) return Math.random() < AUTO_DEFENSE_CHANCE ? SWORDLESS_PARRY : null;
    if (this.isReinforced && !this.isHinokami && this.moveId !== DODGE_MOVE) return DODGE_MOVE;
    if (!this.isHinokami) return null;

    const roll = Math.random();
    if (roll < AUTO_DEFENSE_CHANCE) return FIRE_DODGE;
    if (roll < 2 * AUTO_DEFENSE_CHANCE) return FIRE_COUNTER;
    return null;
  }

  resolveAnimationName() {
    const name = super.resolveAnimationName();
    if (name === 'win' && this.isHinokami && this.animator.has('winFire')) return 'winFire';
    // Sem espada, as de estar são as outras.
    const bare = `${name}Swordless`;
    if (this.isSwordless && SWORDLESS_POSES.has(name) && this.animator.has(bare)) return bare;
    return name;
  }

  /** Distância ao adversário, nas medidas do MUGEN; infinita se não houver. */
  get distanceToOpponent() {
    if (!this.opponent) return Infinity;
    const gap = (this.opponent.position.x + this.opponent.width / 2)
      - (this.position.x + this.width / 2);
    return Math.abs(gap) / this.unit;
  }

  toggleHinokami() {
    this.isHinokami = !this.isHinokami;
    if (this.isHinokami) {
      // Uma labareda grande a marcar a transformação.
      this.spawnAt(this, FIRE_ACTION, { at: [0, -25], scale: 0.5 });
    }
  }

  /** Com o fogo ligado, os especiais tiram metade a mais. */
  toGameHit(hit) {
    const gameHit = super.toGameHit(hit);
    // Os golpes que só existem na Dança já trazem o dano dela.
    const boosted = this.isHinokami && this.moveId >= FIRST_SPECIAL && !this.move?.ownFire;
    if (boosted) gameHit.damage *= HINOKAMI_DAMAGE;
    return gameHit;
  }

  update(ctx) {
    // A espada anda antes do desenho dele, que também a desenha.
    if (this.hitPause === 0) this.updateSword();
    super.update(ctx);
    this.updateBackdrop();
    if (this.spotlightTicks > 0) this.spotlightTicks -= 1;
    this.updateReinforce();
    this.updateBoundFlames();
    if (this.isSwordless) this.swordlessTicks += 1;

    // Fora dos golpes, umas brasas à volta dele mostram que o modo está ligado.
    if (this.isHinokami && !this.hidden && !this.isDefeated && this.animationTime % EMBER_EVERY === 0) {
      this.drawFire(0.06);
    }
  }

  /** O arranque da Dança do Deus do Fogo: a câmara nele e a fotografia atrás. */
  showHinokamiSpotlight() {
    this.spotlightTicks = HINOKAMI_SPOTLIGHT_TICKS;
    if (!this.hinokamiBackdrop || !this.fx) return;

    this.fx.effects.spawn({
      animation: this.hinokamiBackdrop,
      cover: true,
      layer: 'backdrop',
      duration: HINOKAMI_SPOTLIGHT_TICKS,
      fadeOut: HINOKAMI_FADE_TICKS,
    });
  }

  /** Põe a fotografia ao começar um ultimate; se ele acabar antes dela, tira-a. */
  updateBackdrop() {
    if (!this.fx) return;

    const ultimate = this.move
      ? Object.keys(ULTIMATE_MOVES).find((name) => ULTIMATE_MOVES[name].has(this.moveId)) ?? null
      : null;
    if (ultimate === this.shownBackdrop) return;

    this.shownBackdrop = ultimate;
    this.fx.effects.clear(BACKDROP_TAG);
    const picture = ultimate && this.ultimateBackdrops[ultimate];
    if (!picture) return;

    this.fx.effects.spawn({
      animation: picture,
      cover: true,
      layer: 'backdrop',
      duration: BACKDROP_TICKS,
      fadeOut: BACKDROP_FADE_TICKS,
      filter: BACKDROP_FILTER,
      tag: BACKDROP_TAG,
    });
  }

  /** Uma labareda pequena num ponto à sorte em frente ao peito. */
  drawFire(scale = 0.1) {
    this.spawnAt(this, FIRE_ACTION, {
      at: [20 - Math.random() * 30, -30 + Math.random() * 30],
      scale,
    });
  }

  onMoveTick() {
    super.onMoveTick();
    this.drawSlash();
    this.drawDust();
    this.runExtraEvents();

    // Com o fogo ligado, os especiais vão largando labaredas (sem espada, não).
    const burning = this.isHinokami && this.moveId >= FIRST_SPECIAL && !this.move.swordless;
    if (burning && this.moveTime % FIRE_EVERY === 0) this.drawFire();

    // A respirar: o bafo sai da boca de tempos a tempos.
    if (this.move.breath && this.moveTime % BREATH_EVERY === 0) this.drawBreath();
  }

  onMoveStart(id) {
    // Os golpes que vão ter com o adversário põem-se ao pé dele, virados
    // para ele, antes de mais nada.
    const { closeIn } = this.move;
    if (closeIn && this.opponent) {
      const gap = this.opponent.position.x - this.position.x;
      this.facing = Math.sign(gap) || this.facing;
      this.jumpTo(this.opponent, -closeIn);
    }

    super.onMoveStart(id);
    // O que está marcado para o primeiro tick do golpe.
    this.drawSlash();
    this.drawDust();
    this.runExtraEvents();
  }

  onHitLanded(impact) {
    super.onHitLanded(impact);
    // Os golpes fortes rebentam em água sobre o adversário.
    if (this.move?.splash) {
      this.spawnAt(impact.defender, SPLASH_ACTION, { at: [-6, -15], scale: 0.4 });
    }
    // Os da Dança, em chamas.
    if (this.move?.burst) {
      this.spawnFlame({ action: FIRE_BURST_ACTION, at: [0, -30], scale: 0.4, onOpponent: true });
    }
  }

  /** O reforço e o tempo até se poder repetir vão-se gastando; ligado, vê-se o bafo. */
  updateReinforce() {
    if (this.reinforceCooldown > 0) this.reinforceCooldown -= 1;
    if (this.reinforceTicks <= 0) return;

    this.reinforceTicks -= 1;
    if (!this.hidden && this.reinforceTicks % REINFORCE_BREATH_EVERY === 0) this.drawBreath();
  }

  /** As chamas agarradas a ele acompanham-no enquanto duram. */
  updateBoundFlames() {
    if (this.boundFlames.length === 0) return;
    const alive = new Set(this.fx?.effects.effects ?? []);
    this.boundFlames = this.boundFlames.filter(({ effect }) => alive.has(effect));
    for (const { effect, place } of this.boundFlames) Object.assign(effect, place());
  }

  /** O que os golpes deste ficheiro e do tanjiroExtraMoves.js marcam para este tick. */
  runExtraEvents() {
    const { move, moveTime } = this;
    for (const spec of move.flames ?? []) {
      if (this.eventTime(spec) === moveTime) this.spawnFlame(spec);
    }
    for (const spec of move.pulls ?? []) {
      if (this.eventTime(spec) === moveTime) this.pullOpponent(spec.at);
    }
    for (const spec of move.strikes ?? []) {
      if (this.eventTime(spec) === moveTime) this.strike(spec);
    }
    // O TargetBind: depois de acertar, o adversário vem com ele.
    if (move.pin && this.moveHit) this.pullOpponent(move.pin);
  }

  /**
   * Uma chama (ou outro efeito) da tabela: do atlas `extra`, ou do corpo
   * com `atlas: 'body'`. Ver o cabeçalho do tanjiroExtraMoves.js.
   */
  spawnFlame(spec) {
    const atlas = spec.atlas === 'body' ? this.character : this.fxAtlases.extra;
    const animation = atlas?.animation(spec.action, { loop: false });
    if (!animation || !this.fx) return null;

    const anchor = spec.onOpponent && this.opponent ? this.opponent : this;
    const [dx, dy] = spec.at ?? [0, 0];
    const facing = this.facing;
    const place = () => ({
      x: anchor.position.x + anchor.width / 2 + dx * facing * this.unit,
      y: anchor.position.y + anchor.height + dy * this.unit,
    });
    const [scaleX, scaleY] = Array.isArray(spec.scale) ? spec.scale : [spec.scale ?? 1, spec.scale ?? 1];

    const effect = this.fx.effects.spawn({
      animation,
      ...place(),
      scale: [(spec.flip ? -1 : 1) * scaleX * this.unit, scaleY * this.unit],
      facing,
      angle: spec.angle ?? 0,
      layer: spec.layer ?? 'front',
      blend: spec.blend === 'add' ? { additive: true } : null,
    });
    if (effect && spec.bound !== false && !spec.onOpponent) this.boundFlames.push({ effect, place });
    return effect;
  }

  /**
   * Põe o adversário à frente dele, a `dx` (e `dy` acima dos pés dele), nas
   * medidas do MUGEN: é o PosAdd/TargetBind com que o original o arrasta.
   */
  pullOpponent([dx, dy] = [30, 0]) {
    const { opponent } = this;
    if (!opponent || opponent.isDefeated) return;
    opponent.position.x = this.position.x + this.width / 2 + dx * this.facing * this.unit
      - opponent.width / 2;
    opponent.position.y = Math.min(
      opponent.groundY,
      this.position.y + this.height - opponent.height + dy * this.unit,
    );
  }

  /** Um golpe sem caixas: acerta no adversário onde ele estiver. */
  strike(hit) {
    const defender = this.opponent;
    if (!defender || defender.isDefeated) return;

    const gameHit = this.toGameHit(hit);
    defender.receiveHit({ ...gameHit, direction: this.facing });
    this.moveHit = true;
    this.activeHit = hit;
    const point = {
      x: defender.position.x + defender.width / 2,
      y: defender.position.y + defender.height / 2,
    };
    this.onHitLanded({ point, defender, hit });
    for (const cue of gameHit.sounds) this.playSound?.(cue.sound, cue);
  }

  /** Larga uma animação do Tanjiro como efeito, junto a um lutador. */
  spawnAt(fighter, action, { at = [0, 0], scale = 1, angle = 0, layer = 'front', ...options } = {}) {
    const animation = this.character?.animation(action, { loop: false });
    if (!animation || !this.fx) return null;

    const [scaleX, scaleY] = Array.isArray(scale) ? scale : [scale, scale];
    return this.fx.effects.spawn({
      animation,
      x: fighter.position.x + fighter.width / 2 + at[0] * this.facing * this.unit,
      y: fighter.position.y + fighter.height + at[1] * this.unit,
      scale: [scaleX * this.unit, scaleY * this.unit],
      facing: this.facing,
      angle,
      layer,
      ...options,
    });
  }

  /** O pó que os especiais levantam do chão ao arrancar. */
  drawDust() {
    const { dust } = this.move;
    if (dust && this.eventTime(dust) === this.moveTime) {
      this.spawnAt(this, DUST_ACTION, { scale: 0.3, layer: 'back' });
    }
  }

  /** O bafo da respiração: duas nuvens pequenas à altura da boca. */
  drawBreath() {
    for (const x of [4, 7]) {
      this.spawnAt(this, DUST_ACTION, { at: [x, -28], scale: [0.05, 0.1] });
    }
  }

  /** Larga o arco que a espada deixa no ar, no tick em que o golpe o marca. */
  drawSlash() {
    const { slash } = this.move;
    if (!slash || !this.fx || this.eventTime(slash) !== this.moveTime) return;

    // O arco na cor do modo em que está: água, ou fogo.
    const tinted = slash.action + (this.isHinokami ? FIRE_ARCS : WATER_ARCS);
    const action = this.character?.has(tinted) ? tinted : slash.action;
    const animation = this.character?.animation(action, { loop: false });
    if (!animation) return;

    const size = (slash.scale ?? 1) * this.unit;
    this.fx.effects.spawn({
      animation,
      x: this.position.x + this.width / 2 + slash.at[0] * this.facing * this.unit,
      y: this.position.y + this.height + slash.at[1] * this.unit,
      scale: [size, size],
      facing: this.facing,
      angle: slash.angle,
      layer: 'front',
    });
  }

  // ----------------------------------------------------------- a espada

  /** Atira a espada (o 41180, no 3.º frame) e fica sem ela. */
  throwSword() {
    const { unit, opponent } = this;
    const [dx, dy] = SWORD.at;
    // A altura do adversário em relação aos pés dele, como o p2dist y do MUGEN.
    const drop = opponent
      ? ((opponent.position.y + opponent.height) - (this.position.y + this.height)) / unit
      : 0;
    this.sword = {
      phase: 'flying',
      x: this.position.x + this.width / 2 + dx * this.facing * unit,
      y: this.position.y + this.height + dy * unit,
      vx: SWORD.speed * this.facing * unit,
      vy: (SWORD.lift + drop * SWORD.aim) * unit,
      angle: 0,
      tick: 0,
      facing: this.facing,
      lastHit: -Infinity,
      hasHit: false,
    };
    this.sword.angle = Math.atan2(this.sword.vy, this.sword.vx);
    this.isSwordless = true;
    this.swordlessTicks = 0;
  }

  /** Está ao pé da espada (e sem ela): o 4 apanha-a. */
  get canPickUpSword() {
    const { sword } = this;
    if (!this.isSwordless || !sword) return false;
    const [reachX, reachY] = SWORD.reach;
    return Math.abs(this.position.x + this.width / 2 - sword.x) <= reachX * this.unit
      && Math.abs(this.position.y + this.height - sword.y) <= reachY * this.unit;
  }

  /**
   * A espada volta-lhe à mão (o 115500). Com `grab`, quem estiver em cima
   * dela leva o golpe de a arrancar (o 41185 do original).
   */
  recoverSword({ grab = false } = {}) {
    const { sword, opponent } = this;
    if (grab && sword && opponent && !opponent.isDefeated) {
      const [x1, y1, x2, y2] = SWORD.grabBox.map((value) => value * this.unit);
      const box = { x: sword.x + x1, y: sword.y + y1, width: x2 - x1, height: y2 - y1 };
      const touches = opponent.getHurtBoxes().some((hurt) => (
        box.x < hurt.x + hurt.width && box.x + box.width > hurt.x
        && box.y < hurt.y + hurt.height && box.y + box.height > hurt.y
      ));
      if (touches) this.swordHit(SWORD.grab, sword.facing);
    }
    this.sword = null;
    this.isSwordless = false;
    this.swordlessTicks = 0;
  }

  /** O golpe da espada no adversário, fora de qualquer golpe dele. */
  swordHit(hit, direction) {
    const defender = this.opponent;
    if (!defender || defender.isDefeated) return;
    // O MoveFighter, não o do Tanjiro: a espada não leva o extra da Dança.
    const gameHit = MoveFighter.prototype.toGameHit.call(this, hit);
    defender.receiveHit({ ...gameHit, direction });
    this.onSwordImpact(defender, hit, direction);
  }

  /** A faísca e os sons de um toque da espada. */
  onSwordImpact(defender, hit, direction) {
    const point = {
      x: defender.position.x + defender.width / 2,
      y: defender.position.y + defender.height / 2,
    };
    if (hit.damage) this.fx?.hit(point, 'slash', direction);
    for (const cue of hit.sounds ?? []) this.playSound?.(cue.sound, cue);
  }

  /** A espada anda um tick: a voar, espetada nele, a saltar ou no chão. */
  updateSword() {
    const { sword, opponent, unit } = this;
    if (!sword) return;
    sword.tick += 1;
    const groundY = this.bounds.groundY ?? this.bounds.height;

    if (sword.phase === 'flying' || sword.phase === 'popping') {
      sword.x += sword.vx;
      sword.y += sword.vy;
      const popping = sword.phase === 'popping';
      sword.vy += (popping ? SWORD.pop.gravity : SWORD.gravity) * unit;
      sword.angle = popping
        ? sword.angle + (SWORD.pop.spin * sword.facing * Math.PI) / 180
        : Math.atan2(sword.vy, sword.vx);

      const edge = SWORD.edge * unit;
      const atEdge = sword.x < edge || sword.x > this.bounds.width - edge;
      if (!popping && sword.tick > 2 && (atEdge || sword.y >= groundY)) this.popSword();
      else if (popping) {
        sword.x = Math.max(edge, Math.min(this.bounds.width - edge, sword.x));
        if (sword.tick > 2 && sword.y >= groundY) {
          Object.assign(sword, { phase: 'ground', y: groundY, vx: 0, vy: 0, angle: 0, tick: 0 });
          this.playSound?.([1, 51]);
        }
      }
      return;
    }

    if (sword.phase === 'stuck') {
      if (opponent) {
        sword.x = opponent.position.x + opponent.width / 2;
        sword.y = opponent.position.y + opponent.height;
      }
      // Sai do corpo dele com um último golpe, e salta a rodar.
      if (sword.tick >= SWORD.stuckTicks) {
        this.swordHit(SWORD.tearOut, sword.facing);
        sword.y -= 30 * unit;
        this.popSword();
      }
    }
  }

  /** Salta (o 41183): para cima e um pouco para a frente, a rodar. */
  popSword() {
    const { sword, unit } = this;
    const pop = SWORD.pop;
    Object.assign(sword, {
      phase: 'popping',
      vx: pop.speed * sword.facing * unit,
      vy: pop.lift * unit,
      tick: 0,
      lastHit: -Infinity,
    });
    const variant = 1 + Math.floor(Math.random() * 4);
    this.playSound?.([4, variant]);
  }

  /** O que a espada tem a bater neste tick, para o combat.js. */
  swordAttack() {
    const { sword, unit } = this;
    if (!sword) return null;

    let boxes;
    let hit;
    let onHit;
    if (sword.phase === 'flying' && !sword.hasHit) {
      // A lâmina, de 6 atrás a 29 à frente do eixo, com 5 de cada lado.
      const [back, front, side] = [-6, 29, 5].map((value) => value * unit);
      const cos = Math.cos(sword.angle);
      const sin = Math.sin(sword.angle);
      const xs = [sword.x + cos * back, sword.x + cos * front];
      const ys = [sword.y + sin * back, sword.y + sin * front];
      boxes = [{
        x: Math.min(...xs) - side,
        y: Math.min(...ys) - side,
        width: Math.abs(xs[1] - xs[0]) + 2 * side,
        height: Math.abs(ys[1] - ys[0]) + 2 * side,
      }];
      hit = SWORD.hit;
      onHit = ({ defender }) => {
        sword.hasHit = true;
        Object.assign(sword, { phase: 'stuck', tick: 0, vx: 0, vy: 0 });
        this.onSwordImpact(defender, hit, sword.facing);
      };
    } else if (sword.phase === 'popping') {
      const ready = sword.tick > SWORD.pop.every && sword.tick - sword.lastHit >= SWORD.pop.every;
      if (!ready) return null;
      const size = 18 * unit;
      boxes = [{ x: sword.x - size, y: sword.y - size, width: 2 * size, height: 2 * size }];
      hit = SWORD.spin;
      onHit = ({ defender }) => {
        sword.lastHit = sword.tick;
        this.onSwordImpact(defender, hit, sword.facing);
      };
    } else {
      return null;
    }

    return {
      boxes,
      hit: MoveFighter.prototype.toGameHit.call(this, hit),
      facing: sword.facing,
      onHit,
    };
  }

  getAttacks() {
    const attacks = super.getAttacks();
    const sword = this.swordAttack();
    if (sword) attacks.push(sword);
    return attacks;
  }

  draw(ctx) {
    super.draw(ctx);
    this.drawSword(ctx);
  }

  /** Desenha a espada onde ela estiver. */
  drawSword(ctx) {
    const { sword, opponent, unit } = this;
    if (!sword || !this.character) return;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (sword.phase === 'stuck' && opponent) {
      // Atravessada no corpo dele, com o punho do lado de quem a atirou.
      ctx.translate(sword.x - 12 * sword.facing * unit, sword.y - 30 * unit);
      ctx.scale(sword.facing, 1);
      this.character.drawSprite(ctx, SWORD.sprites.stuck, unit);
    } else if (sword.phase === 'ground') {
      ctx.translate(sword.x, sword.y);
      this.character.drawSprite(ctx, SWORD.sprites.ground, unit);
    } else {
      ctx.translate(sword.x, sword.y);
      ctx.rotate(sword.angle);
      this.character.drawSprite(ctx, SWORD.sprites.flying, unit);
    }
    ctx.restore();
  }
}
