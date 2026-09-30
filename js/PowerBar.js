/**
 * Barra de energia, desenhada no canvas como a de vida.
 *
 * Enche ao atacar e ao carregar. Está dividida em três níveis porque é por
 * níveis que a energia se gasta: correr a meio de um combo custa um quarto
 * de nível, e os especiais do personagem custam níveis inteiros.
 */

const TRACK_COLOR = '#2b2c34';
const BORDER_COLOR = '#0c0d11';
const FILL_COLOR = '#e01733';
const FULL_COLOR = '#ff6b81';
const LABEL_COLOR = '#c9cad2';

const LEVELS = 3;

export class PowerBar {
  constructor({ fighter, x, y, width = 300, height = 12, label = 'ENERGIA' }) {
    this.fighter = fighter;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.label = label;
  }

  draw(ctx) {
    const { x, y, width, height } = this;
    const ratio = this.fighter.powerRatio ?? 0;

    ctx.save();

    ctx.fillStyle = TRACK_COLOR;
    ctx.fillRect(x, y, width, height);

    ctx.fillStyle = ratio >= 1 ? FULL_COLOR : FILL_COLOR;
    ctx.fillRect(x, y, width * ratio, height);

    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    // Divisórias dos níveis.
    ctx.beginPath();
    for (let level = 1; level < LEVELS; level++) {
      const lineX = x + (width * level) / LEVELS;
      ctx.moveTo(lineX, y);
      ctx.lineTo(lineX, y + height);
    }
    ctx.stroke();

    ctx.fillStyle = LABEL_COLOR;
    ctx.font = 'bold 11px sans-serif';
    // A barra de vida do adversário deixa o alinhamento à direita.
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(this.label, x, y - 3);

    ctx.restore();
  }
}
