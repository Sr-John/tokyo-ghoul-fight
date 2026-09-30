/**
 * Barra de vida desenhada no canvas.
 *
 * Fica no canvas (e não em <div>s sobrepostas) para acompanhar a escala do
 * ringue: o canvas encolhe por CSS em ecrãs pequenos, e uma barra em HTML
 * teria de replicar essa escala à mão para continuar alinhada.
 */

/** Cor do preenchimento por faixa de vida — avisa o jogador sem números. */
const FILL_COLORS = [
  { threshold: 0.5, color: '#4ade80' },
  { threshold: 0.25, color: '#facc15' },
  { threshold: 0, color: '#ef4444' },
];

const TRACK_COLOR = '#2b2c34';
const BORDER_COLOR = '#0c0d11';
const LABEL_COLOR = '#c9cad2';

/** Fracção da diferença percorrida por frame quando a vida muda. */
const DRAIN_EASING = 0.12;

export class HealthBar {
  constructor({
    fighter,
    x,
    y,
    width = 432,
    height = 26,
    label = '',
    /**
     * Espelha a barra: o preenchimento fica ancorado à direita e recua para
     * esse lado. É o que dá a leitura clássica de jogo de luta, com as duas
     * barras a esvaziarem a partir do centro do ecrã.
     */
    mirrored = false,
  }) {
    this.fighter = fighter;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.label = label;
    this.mirrored = mirrored;

    // Valor mostrado, distinto do valor real: persegue-o ao longo de alguns
    // frames para o dano aparecer como um esvaziamento e não como um salto.
    this.displayedRatio = fighter.healthRatio;
  }

  get fillColor() {
    const ratio = this.displayedRatio;
    return FILL_COLORS.find((step) => ratio > step.threshold)?.color
      ?? FILL_COLORS[FILL_COLORS.length - 1].color;
  }

  update(ctx) {
    const target = this.fighter.healthRatio;
    const delta = target - this.displayedRatio;

    // Encosta ao valor real quando a diferença deixa de ser visível, senão a
    // interpolação nunca termina e a barra fica sempre a redesenhar.
    this.displayedRatio = Math.abs(delta) < 0.001
      ? target
      : this.displayedRatio + delta * DRAIN_EASING;

    this.draw(ctx);
  }

  draw(ctx) {
    const { x, y, width, height } = this;
    const fillWidth = width * this.displayedRatio;

    ctx.fillStyle = TRACK_COLOR;
    ctx.fillRect(x, y, width, height);

    if (fillWidth > 0) {
      ctx.fillStyle = this.fillColor;
      ctx.fillRect(
        this.mirrored ? x + width - fillWidth : x,
        y,
        fillWidth,
        height,
      );
    }

    ctx.lineWidth = 3;
    ctx.strokeStyle = BORDER_COLOR;
    ctx.strokeRect(x, y, width, height);

    if (this.label) {
      ctx.fillStyle = LABEL_COLOR;
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.textAlign = this.mirrored ? 'right' : 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(
        this.label,
        this.mirrored ? x + width : x,
        y + height + 8,
      );
    }
  }
}
