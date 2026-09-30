import { SpriteFighter } from './SpriteFighter.js';

/**
 * O lutador do jogador.
 *
 * Desenha-se a partir da imagem em assets/kaneki.png. Enquanto ela não
 * existir, usa o boneco de reserva desenhado aqui a código —
 * cabelo branco, kakugan no olho da frente, t-shirt preta e calção rasgado.
 */

/**
 * A arte do Kaneki.
 *
 * Basta uma imagem PNG em assets/kaneki.png para ele aparecer na arena. O
 * tamanho e medido a partir da propria imagem, por isso nao ha nada para
 * medir a mao: se for uma imagem unica, deixa frameCount a 1; se for uma
 * spritesheet (frames lado a lado numa linha), poe o numero de frames.
 */
export const KANEKI_ANIMATIONS = {
  idle: {
    src: 'assets/kaneki.png',
    frameCount: 4,
    // 8 ticks = ~130 ms, o mesmo ritmo do GIF de onde a folha saiu.
    ticksPerFrame: 8,
  },

  // Descomenta quando tiveres as folhas de andar e de atacar. Ate la, o
  // Kaneki usa a imagem de cima em todos os estados.
  //
  // walk: {
  //   src: 'assets/kaneki-walk.png',
  //   frameCount: 6,
  //   ticksPerFrame: 6,
  // },
  //
  // attack: {
  //   src: 'assets/kaneki-attack.png',
  //   frameCount: 4,
  //   ticksPerFrame: 5,
  //   loop: false,   // um ataque toca uma vez e devolve o controlo
  // },
};

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

export class Kaneki extends SpriteFighter {
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
