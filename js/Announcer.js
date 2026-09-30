/**
 * Os anúncios do combate: "Round 1", "Final Round", "Fight", "K.O.", e os
 * de texto ("Time Over", "Draw Game", quem venceu), com a voz de cada um.
 *
 * A arte e as vozes são as do pacote de lifebars (assets/hud/announcer): de
 * cada animação dele guardou-se só o frame já formado, e a entrada e a saída
 * fazem-se aqui, a crescer e a desaparecer. Os sprites trazem no eixo a
 * posição no ecrã de 1280×720 para que o pacote foi desenhado, como os do HUD.
 */

const DESIGN_WIDTH = 1280;
const DESIGN_HEIGHT = 720;

/** Cada anúncio: o sprite (ou texto), a voz e quanto tempo fica no ecrã. */
export const ANNOUNCEMENTS = {
  round1: { sprite: '101,14', sound: [0, 1], ticks: 75 },
  round2: { sprite: '102,14', sound: [0, 2], ticks: 75 },
  round3: { sprite: '103,14', sound: [0, 3], ticks: 75 },
  finalRound: { sprite: '108,17', sound: [0, 8], ticks: 75 },
  fight: { sprite: '110,15', sound: [1, 0], ticks: 50 },
  ko: { sprite: '111,23', sound: [2, 0], ticks: 100 },
  timeOver: { text: 'TIME OVER', sound: [2, 2], ticks: 100 },
  draw: { text: 'DRAW GAME', sound: [2, 3], ticks: 100 },
};

/** Ticks a entrar (a encolher até ao tamanho certo) e a sair (a apagar-se). */
const POP_TICKS = 8;
const FADE_TICKS = 12;
/** De quanto maior parte ao entrar. */
const POP_SCALE = 1.35;

export class Announcer {
  /** `atlas` é o CharacterAtlas de assets/hud/announcer (pode faltar), `width` a do canvas. */
  constructor({ atlas, width }) {
    this.atlas = atlas;
    this.scale = width / DESIGN_WIDTH;
    this.current = null;
  }

  /** Mostra um anúncio (pelo nome, em ANNOUNCEMENTS) e diz a voz dele. */
  show(name, { text = null } = {}) {
    const announcement = ANNOUNCEMENTS[name];
    if (!announcement) return;

    this.current = { ...announcement, text: text ?? announcement.text, tick: 0 };
    if (announcement.sound) this.atlas?.playSound(...announcement.sound);
  }

  /** Verdadeiro enquanto houver um anúncio no ecrã. */
  get isShowing() {
    return this.current !== null;
  }

  update() {
    if (!this.current) return;
    this.current.tick += 1;
    if (this.current.tick >= this.current.ticks) this.current = null;
  }

  draw(ctx) {
    const current = this.current;
    if (!current) return;

    const { tick, ticks } = current;
    const pop = Math.min(1, tick / POP_TICKS);
    const scale = POP_SCALE - (POP_SCALE - 1) * pop;
    const alpha = Math.min(pop, (ticks - tick) / FADE_TICKS, 1);

    ctx.save();
    ctx.scale(this.scale, this.scale);
    ctx.globalAlpha = Math.max(0, alpha);
    // Cresce e encolhe a partir do centro do ecrã.
    ctx.translate(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2);
    ctx.scale(scale, scale);
    ctx.translate(-DESIGN_WIDTH / 2, -DESIGN_HEIGHT / 2);
    ctx.imageSmoothingEnabled = true;

    const drawn = current.sprite && this.atlas?.drawSprite(ctx, current.sprite, 1);
    if (!drawn) this.drawText(ctx, current.text ?? '');
    ctx.restore();
  }

  /** Os anúncios sem arte: letras grossas e inclinadas, com contorno. */
  drawText(ctx, text) {
    ctx.font = 'italic 900 96px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#0c0d11';
    const gradient = ctx.createLinearGradient(0, DESIGN_HEIGHT / 2 - 48, 0, DESIGN_HEIGHT / 2 + 48);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.55, '#c9d3e6');
    gradient.addColorStop(1, '#f2b8c8');
    ctx.fillStyle = gradient;
    ctx.strokeText(text, DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2);
    ctx.fillText(text, DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2);
  }
}
