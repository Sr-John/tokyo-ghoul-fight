import { buildAnimations, pickSounds } from './characterAnimations.js';
import { KANEKI_COMMANDS, KANEKI_CONSTANTS, KANEKI_MOVES } from './kanekiMoves.js';
import { MoveFighter } from './MoveFighter.js';

/**
 * O lutador do jogador.
 *
 * A arte vem do personagem de MUGEN exportado para assets/kaneki. Se essa
 * pasta faltar, usa o boneco de reserva desenhado aqui a código — cabelo
 * branco, kakugan no olho da frente, t-shirt preta e calção rasgado.
 */

/**
 * As animações de estar, andar e reagir, pelo número da acção no MUGEN. As
 * dos golpes vêm da tabela do kanekiMoves.js.
 *
 * Os sons são os que o personagem toca no MUGEN: `at` é o tick da animação
 * e cada som é [grupo, número], o nome do ficheiro em assets/kaneki/snd.
 */
const KANEKI_ACTIONS = {
  idle: { action: 0 },
  walk: { action: 20 },
  jump: { action: 41 },
  crouch: { action: 11 },

  // Vitória: solta a kagune e fica a estalar o dedo. A Rize aparece ao lado
  // dele a meio (ver drawRize).
  win: {
    action: 180,
    sounds: [
      { at: 10, sound: [0, 40] },
      // O estalo do dedo, no 8.º frame.
      { at: 50, sound: [0, 206] },
    ],
  },

  // A pôr a máscara, quando a vida chega a metade. A animação é montada em
  // addMaskAnimation, mais abaixo.
  maskOn: {
    action: 'maskOn',
    loop: false,
    sounds: [
      { at: 1, sound: [0, 15] },
      // A mão a assentar a máscara na cara.
      { at: 47, sound: [0, 201] },
    ],
  },

  // A apanhar: fica nesta pose enquanto durar o atordoamento. Atirado pelo
  // ar, estendido no chão, a levantar-se, e derrotado.
  hurt: { action: 5000 },
  hurtAir: { action: 5050 },
  down: { action: 5110 },
  getUp: { action: 5120, loop: false },
  dead: { action: 5150 },

  // Entrada: preso na cadeira, o cabelo fica branco e ele levanta-se. Toca
  // sozinha no início do combate; até acabar, o Kaneki não responde às teclas.
  intro: {
    action: 192,
    loop: false,
    sounds: [
      { at: 1, sound: [0, 43] },
      // Quando se põe de pé (o 27.º frame, ao tick 218).
      { at: 218, sound: [0, 201] },
    ],
  },
};

// A Rize na pose de vitória. O pacote só traz o sprite dela de pé (usado
// numa das entradas), por isso a cena é montada aqui: ela surge às costas
// do Kaneki, meio transparente, como a presença que ele vê na cabeça.
const RIZE_SPRITE = '250,0';
/** Ticks de pose antes de ela aparecer, e quanto demora a surgir. */
const RIZE_DELAY = 60;
const RIZE_FADE_TICKS = 50;
const RIZE_ALPHA = 0.85;
/** Distância atrás do Kaneki, em pixels da arte. */
const RIZE_OFFSET = 26;

/**
 * O personagem tem uma segunda forma, de máscara posta: as mesmas animações,
 * com o número da acção somado de 10000.
 */
const MASKED_FORM = 10000;

/** Fracção da vida a partir da qual o Kaneki põe a máscara. */
const MASK_HEALTH = 0.5;

/** Entradas do personagem de onde saem os frames de pôr a máscara. */
const TURN_ACTION = 191;
const MASKED_TURN_ACTION = 10191;

/**
 * O pacote não traz uma animação de pôr a máscara, mas cada forma tem uma
 * entrada em que o Kaneki está de costas e se vira para a frente. Juntas
 * dão a cena: vira as costas sem máscara, e volta-se já com ela, a ajeitá-la
 * com a mão.
 */
function addMaskAnimation(character) {
  const plain = character.actions[TURN_ACTION];
  const masked = character.actions[MASKED_TURN_ACTION];
  if (!plain || !masked) return;

  const frame = (source, index, ticks) => ({ ...source.frames[index], t: ticks });

  character.actions.maskOn = {
    frames: [
      // Sem máscara, a virar-se para trás: a entrada tocada ao contrário.
      frame(plain, 3, 4),
      frame(plain, 2, 4),
      frame(plain, 1, 4),
      frame(plain, 0, 10),
      // De costas, já na forma de máscara, e a virar-se para a frente.
      frame(masked, 0, 10),
      frame(masked, 1, 5),
      frame(masked, 2, 5),
      frame(masked, 3, 5),
      // A mão na cara, a pose, e a mão outra vez.
      frame(masked, 4, 8),
      frame(masked, 5, 22),
      frame(masked, 6, 4),
    ],
  };
}

const KANEKI_SOUNDS = pickSounds(KANEKI_ACTIONS);

/** Todas as animações do Kaneki numa das formas: `form` é 0 ou MASKED_FORM. */
const kanekiAnimations = (character, form = 0) => (
  buildAnimations(character, KANEKI_ACTIONS, KANEKI_MOVES, form)
);

const PALETTE = {
  hair: '#eef0f4',
  hairShade: '#c4c8d2',
  skin: '#f0d6c3',
  skinShade: '#d8b49c',
  shirt: '#14151a',
  shirtLight: '#23252e',
  shorts: '#2b2f3a',
  shortsLight: '#363b48',
  boots: '#0b0c10',
  eyeWhite: '#f4f4f6',
  eyeDark: '#24252c',
  kakuganSclera: '#0d0d11',
  kakuganIris: '#e01733',
  kakuganGlow: 'rgba(224, 23, 51, 0.28)',
  mouth: '#b9897a',
};

/** Radianos por frame do ciclo de passada. */
const WALK_CYCLE_SPEED = 0.2;

/** Amplitude da passada e do balanço dos braços, em radianos. */
const LEG_SWING = 0.55;
const ARM_SWING = 0.42;

/**
 * Desenha um membro como um rectângulo que pende a partir da articulação.
 * Ângulo 0 aponta para baixo, positivo roda para a frente do boneco.
 */
function drawLimb(ctx, { x, y, width, length, angle, color, boot }) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-width / 2, 0, width, length, width / 2);
  ctx.fill();

  if (boot) {
    ctx.fillStyle = PALETTE.boots;
    ctx.beginPath();
    ctx.roundRect(-width / 2 - 1, length - 4, width + 2, 15, 3);
    ctx.fill();
    // Biqueira virada para a frente, para a perna ler como um pé.
    ctx.beginPath();
    ctx.roundRect(-width / 2 - 1, length + 5, width + 7, 6, 3);
    ctx.fill();
  }

  ctx.restore();
}

export class Kaneki extends MoveFighter {
  /** `character` é o CharacterAtlas do Kaneki; sem ele, fica o boneco de reserva. */
  constructor({ character = null, ...options }) {
    if (character) addMaskAnimation(character);

    super({
      animations: character ? kanekiAnimations(character) : {},
      moveSet: KANEKI_MOVES,
      commands: KANEKI_COMMANDS,
      constants: KANEKI_CONSTANTS,
      sounds: KANEKI_SOUNDS,
      playSound: ([group, item], { volume } = {}) =>
        character?.playSound(group, item, { volume }) ?? null,
      // As caixas de ataque do original vão muito além do desenho (acertava
      // de longe, até no ar por cima do adversário): cortam-se à arte.
      clipHitsToArt: true,
      ...options,
    });

    this.character = character;

    /** Verdadeiro depois de pôr a máscara. */
    this.isMasked = false;
  }

  // Os efeitos que são só do Kaneki; os comuns estão no MoveFighter.
  onMoveTick() {
    super.onMoveTick();

    // Carregar a energia, a descarga quando a barra enche e o recolher da
    // kagune, com os efeitos nos ticks em que o original os larga.
    if (this.moveId === 500) this.fx?.charge(this, this.moveTime);
    if (this.moveId === 506) {
      if (this.moveTime === this.elemStart(4)) this.fx?.chargeBurst(this);
      if (this.moveTime === this.elemStart(6)) this.fx?.chargeMist(this);
    }
    if (this.moveId === 505 && this.moveTime === this.elemStart(3) + 3) {
      this.fx?.chargeRelease(this);
    }
  }

  /**
   * Põe a máscara: toca a animação e passa à segunda forma do personagem,
   * com os mesmos golpes e outra arte. Não se tira.
   */
  putOnMask() {
    if (this.isMasked || !this.character) return;
    this.isMasked = true;

    for (const [name, animation] of Object.entries(kanekiAnimations(this.character, MASKED_FORM))) {
      this.animator.add(name, animation);
    }
    this.playOnce('maskOn');
  }

  update(ctx) {
    // Só a põe quando está livre e de pé: a meio de um golpe, de um salto
    // ou de apanhar, espera.
    const ready = !this.isMasked
      && !this.isDefeated
      && !this.isVictorious
      && this.healthRatio <= MASK_HEALTH
      && this.hitPause === 0
      && !this.move
      && !this.isLocked
      && this.isOnGround;
    if (ready) this.putOnMask();

    super.update(ctx);
  }

  draw(ctx) {
    super.draw(ctx);
    // Depois do Kaneki: por trás, a kagune tapava-lhe a cara.
    this.drawRize(ctx);
  }

  drawRize(ctx) {
    const elapsed = this.victoryTicks - RIZE_DELAY;
    if (!this.character || elapsed <= 0) return;

    const scale = this.artScale;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = Math.min(1, elapsed / RIZE_FADE_TICKS) * RIZE_ALPHA;
    ctx.translate(this.position.x + this.width / 2, this.position.y + this.height);
    ctx.scale(this.facing, 1);
    ctx.translate(-RIZE_OFFSET * scale, 0);
    this.character.drawSprite(ctx, RIZE_SPRITE, scale);
    ctx.restore();
  }

  /**
   * Põe o Kaneki numa acção do personagem, sem mais nada: é como as cenas
   * o animam. Devolve a animação, ou null se ele não a tiver.
   */
  pose(action, { loop = false } = {}) {
    const name = `pose:${action}`;

    if (!this.animator.has(name)) {
      const animation = this.character?.animation(action, { name, loop });
      if (!animation) return null;
      this.animator.add(name, animation);
    }

    this.animator.play(name, { restart: true });
    return this.animator.current;
  }

  /**
   * Toca uma vez qualquer acção do personagem, pelo número. Serve para ver o
   * que ele tem antes de a ligar a uma tecla — na consola do browser:
   *   game.player1.playAction(405)
   */
  playAction(action) {
    const name = `action:${action}`;

    if (!this.animator.has(name)) {
      const animation = this.character?.animation(action, { name, loop: false });
      if (!animation) return false;
      this.animator.add(name, animation);
    }

    // Interrompe o que estiver a tocar: aqui o que se quer é ver a animação.
    if (this.move) this.finishMove();
    this.oneShot = null;
    return this.playOnce(name);
  }

  drawFallback(ctx) {
    const scale = this.height / 150;
    const centerX = this.position.x + this.width / 2;
    const feetY = this.position.y + this.height;

    ctx.save();
    ctx.translate(centerX, feetY);
    // Vira o boneco para o adversário. A partir daqui, +x é a frente.
    ctx.scale(this.facing * scale, scale);

    const walking = this.isOnGround && this.velocity.x !== 0;
    const airborne = !this.isOnGround;
    const phase = this.animationTime * WALK_CYCLE_SPEED;
    const swing = walking ? Math.sin(phase) : 0;

    // O corpo sobe e desce ao andar, com as pernas assentes no chão.
    const bob = walking ? Math.abs(Math.cos(phase)) * -2 : 0;

    let frontLeg = swing * LEG_SWING;
    let backLeg = -swing * LEG_SWING;
    let frontArm = -swing * ARM_SWING;
    let backArm = swing * ARM_SWING;

    if (this.isAttacking) {
      // Soco: braço da frente estendido, o de trás recuado.
      frontArm = -1.55;
      backArm = 0.5;
      frontLeg = 0.2;
      backLeg = -0.2;
    } else if (airborne) {
      // Pose de salto: perna da frente recolhida, a de trás estendida atrás.
      frontLeg = 0.75;
      backLeg = -0.5;
      frontArm = -0.9;
      backArm = -0.35;
    }

    this.drawArm(ctx, bob, backArm, true);
    this.drawLeg(ctx, backLeg, true);
    this.drawLeg(ctx, frontLeg, false);
    this.drawShorts(ctx, bob);
    this.drawShirt(ctx, bob);
    this.drawHead(ctx, bob);
    this.drawArm(ctx, bob, frontArm, false);

    ctx.restore();
  }

  drawLeg(ctx, angle, isBack) {
    drawLimb(ctx, {
      x: isBack ? -7 : 7,
      y: -62,
      width: 12,
      length: 48,
      angle,
      // Pernas à mostra por baixo do calção; a de trás fica na sombra.
      color: isBack ? PALETTE.skinShade : PALETTE.skin,
      boot: true,
    });
  }

  drawArm(ctx, bob, angle, isBack) {
    drawLimb(ctx, {
      x: isBack ? -13 : 13,
      y: -106 + bob,
      width: 10,
      length: 42,
      angle,
      color: isBack ? PALETTE.skinShade : PALETTE.skin,
    });
  }

  drawShorts(ctx, bob) {
    ctx.save();
    ctx.translate(0, bob);

    // Calção com a bainha esfarrapada: o contorno desce em bicos irregulares
    // em vez de fechar a direito.
    ctx.fillStyle = PALETTE.shorts;
    ctx.beginPath();
    ctx.moveTo(-15, -78);
    ctx.lineTo(15, -78);
    ctx.lineTo(16, -56);
    ctx.lineTo(12, -50);
    ctx.lineTo(9, -57);
    ctx.lineTo(5, -52);
    ctx.lineTo(2, -60);
    ctx.lineTo(-2, -54);
    ctx.lineTo(-6, -59);
    ctx.lineTo(-10, -51);
    ctx.lineTo(-13, -57);
    ctx.lineTo(-16, -56);
    ctx.closePath();
    ctx.fill();

    // Luz no lado da frente.
    ctx.fillStyle = PALETTE.shortsLight;
    ctx.beginPath();
    ctx.moveTo(5, -78);
    ctx.lineTo(15, -78);
    ctx.lineTo(16, -56);
    ctx.lineTo(12, -50);
    ctx.lineTo(9, -57);
    ctx.lineTo(5, -52);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  drawShirt(ctx, bob) {
    ctx.save();
    ctx.translate(0, bob);

    // T-shirt preta: ombros largos a afunilar na cintura.
    ctx.fillStyle = PALETTE.shirt;
    ctx.beginPath();
    ctx.moveTo(-17, -112);
    ctx.lineTo(17, -112);
    ctx.lineTo(14, -74);
    ctx.lineTo(-14, -74);
    ctx.closePath();
    ctx.fill();

    // Luz no lado da frente, para o tronco não ler como uma silhueta chapada.
    ctx.fillStyle = PALETTE.shirtLight;
    ctx.beginPath();
    ctx.moveTo(5, -112);
    ctx.lineTo(17, -112);
    ctx.lineTo(14, -74);
    ctx.lineTo(5, -74);
    ctx.closePath();
    ctx.fill();

    // Mangas curtas, a cobrir o topo dos braços.
    ctx.fillStyle = PALETTE.shirt;
    ctx.beginPath();
    ctx.roundRect(-19, -112, 12, 16, 3);
    ctx.fill();
    ctx.fillStyle = PALETTE.shirtLight;
    ctx.beginPath();
    ctx.roundRect(7, -112, 12, 16, 3);
    ctx.fill();

    ctx.restore();
  }

  drawHead(ctx, bob) {
    ctx.save();
    ctx.translate(0, bob);

    // Pescoço.
    ctx.fillStyle = PALETTE.skin;
    ctx.beginPath();
    ctx.roundRect(-5, -120, 10, 10, 3);
    ctx.fill();

    // Rosto.
    ctx.beginPath();
    ctx.ellipse(0, -131, 13.5, 16.5, 0, 0, Math.PI * 2);
    ctx.fill();

    this.drawHair(ctx);
    this.drawEyes(ctx);

    ctx.fillStyle = PALETTE.mouth;
    ctx.beginPath();
    ctx.roundRect(2, -121, 6, 1.6, 1);
    ctx.fill();

    ctx.restore();
  }

  drawHair(ctx) {
    // Calota branca com franja em bico, desenhada num só path: a curva faz o
    // topo da cabeça, o ziguezague faz os picos sobre a testa.
    ctx.fillStyle = PALETTE.hair;
    ctx.beginPath();
    ctx.moveTo(-14, -132);
    ctx.quadraticCurveTo(-16, -150, 0, -149);
    ctx.quadraticCurveTo(16, -148, 14.5, -131);
    ctx.lineTo(11, -138);
    ctx.lineTo(7.5, -131);
    ctx.lineTo(3.5, -139);
    ctx.lineTo(-1, -131.5);
    ctx.lineTo(-5, -139);
    ctx.lineTo(-9, -132);
    ctx.closePath();
    ctx.fill();

    // Sombra do cabelo junto à nuca, do lado de trás.
    ctx.fillStyle = PALETTE.hairShade;
    ctx.beginPath();
    ctx.moveTo(-14, -132);
    ctx.quadraticCurveTo(-16, -146, -6, -148.5);
    ctx.lineTo(-9, -132);
    ctx.closePath();
    ctx.fill();
  }

  drawEyes(ctx) {
    // Olho de trás, normal.
    ctx.fillStyle = PALETTE.eyeWhite;
    ctx.beginPath();
    ctx.ellipse(-5.5, -128, 3.2, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.eyeDark;
    ctx.beginPath();
    ctx.ellipse(-5, -128, 1.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Olho da frente: kakugan — esclera negra, íris vermelha e um halo para
    // dar a impressão de brilho próprio.
    ctx.fillStyle = PALETTE.kakuganGlow;
    ctx.beginPath();
    ctx.ellipse(6, -128, 6.5, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = PALETTE.kakuganSclera;
    ctx.beginPath();
    ctx.ellipse(6, -128, 3.4, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = PALETTE.kakuganIris;
    ctx.beginPath();
    ctx.ellipse(6.4, -128, 1.8, 2.1, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = PALETTE.kakuganSclera;
    ctx.beginPath();
    ctx.ellipse(6.4, -128, 0.8, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
