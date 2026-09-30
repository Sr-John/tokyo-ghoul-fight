import { buildAnimations, pickSounds } from './characterAnimations.js';
import { MoveFighter } from './MoveFighter.js';
import { TANJIRO_COMMANDS, TANJIRO_CONSTANTS, TANJIRO_MOVES } from './tanjiroMoves.js';

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
  cuts: new Set([3000, 3001, 3002, 3003, 3004]),
  dragon: new Set([1800, 1801]),
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

/** De quantos em quantos ticks ele respira. */
const BREATH_EVERY = 15;

/** As animações de estar e reagir, pelo número da acção no MUGEN. */
const TANJIRO_ACTIONS = {
  idle: { action: 0 },
  walk: { action: 20 },
  jump: { action: 41 },
  crouch: { action: 11 },

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
      animations: character ? buildAnimations(character, TANJIRO_ACTIONS, TANJIRO_MOVES) : {},
      moveSet: TANJIRO_MOVES,
      commands: TANJIRO_COMMANDS,
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
  }

  resolveAnimationName() {
    const name = super.resolveAnimationName();
    return name === 'win' && this.isHinokami && this.animator.has('winFire') ? 'winFire' : name;
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
    if (this.isHinokami && this.moveId >= FIRST_SPECIAL) gameHit.damage *= HINOKAMI_DAMAGE;
    return gameHit;
  }

  update(ctx) {
    super.update(ctx);
    this.updateBackdrop();
    if (this.spotlightTicks > 0) this.spotlightTicks -= 1;

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

    // Com o fogo ligado, os especiais vão largando labaredas.
    const burning = this.isHinokami && this.moveId >= FIRST_SPECIAL;
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
  }

  onHitLanded(impact) {
    super.onHitLanded(impact);
    // Os golpes fortes rebentam em água sobre o adversário.
    if (this.move?.splash) {
      this.spawnAt(impact.defender, SPLASH_ACTION, { at: [-6, -15], scale: 0.4 });
    }
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
}
