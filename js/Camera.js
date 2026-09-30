/**
 * Câmara do ringue: aproxima-se de um lutador e volta ao plano geral.
 *
 * Não mexe em nenhuma posição do jogo — só transforma o canvas antes de a
 * arena e os lutadores se desenharem. O HUD desenha-se depois de a
 * transformação ser desfeita, por isso fica sempre no sítio.
 */

/** Fracção da distância ao alvo percorrida a cada tick. Maior = mais seco. */
const EASING = 0.08;

export class Camera {
  constructor({ width, height }) {
    this.width = width;
    this.height = height;

    // Ponto do ringue que fica ao centro do ecrã, e a ampliação.
    this.x = width / 2;
    this.y = height / 2;
    this.zoom = 1;

    this.target = { x: this.x, y: this.y, zoom: 1 };

    // Tremor: a amplitude em px, quantos ticks ainda dura e quantos durava.
    this.shakeAmplitude = 0;
    this.shakeTicks = 0;
    this.shakeLength = 0;
  }

  /**
   * Faz o ecrã tremer na vertical durante uns ticks, a perder força. Um
   * tremor mais fraco não interrompe um mais forte que ainda esteja a correr.
   */
  shake(amplitude, ticks) {
    const current = this.shakeAmplitude * (this.shakeTicks / (this.shakeLength || 1));
    if (this.shakeTicks > 0 && current > amplitude) return;

    this.shakeAmplitude = amplitude;
    this.shakeTicks = ticks;
    this.shakeLength = ticks;
  }

  /** Aponta para o centro de um lutador. `snap` salta para lá sem deslizar. */
  focusOn(fighter, { zoom = 2, snap = false } = {}) {
    this.target = {
      x: fighter.position.x + fighter.width / 2,
      y: fighter.position.y + fighter.height / 2,
      zoom,
    };
    if (snap) this.jumpToTarget();
  }

  /** Volta ao plano geral, com o ringue inteiro à vista. */
  reset() {
    this.target = { x: this.width / 2, y: this.height / 2, zoom: 1 };
  }

  jumpToTarget() {
    this.x = this.target.x;
    this.y = this.target.y;
    this.zoom = this.target.zoom;
  }

  update() {
    this.x += (this.target.x - this.x) * EASING;
    this.y += (this.target.y - this.y) * EASING;
    this.zoom += (this.target.zoom - this.zoom) * EASING;
    if (this.shakeTicks > 0) this.shakeTicks -= 1;
  }

  /** Desvio vertical do tremor neste tick, em px. */
  get shakeOffset() {
    if (this.shakeTicks <= 0) return 0;
    const strength = this.shakeAmplitude * (this.shakeTicks / this.shakeLength);
    // Sobe e desce a cada tick, que é o que dá a vibração.
    return this.shakeTicks % 2 === 0 ? strength : -strength;
  }

  /** Aplica a transformação ao canvas. Quem chama faz o save/restore. */
  apply(ctx) {
    // Não deixa a vista sair do ringue: sem isto, focar um lutador encostado
    // à parede mostrava o vazio para lá da arena.
    const halfWidth = this.width / (2 * this.zoom);
    const halfHeight = this.height / (2 * this.zoom);
    const x = Math.max(halfWidth, Math.min(this.x, this.width - halfWidth));
    const y = Math.max(halfHeight, Math.min(this.y, this.height - halfHeight));

    ctx.translate(this.width / 2, this.height / 2 + this.shakeOffset);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-x, -y);
  }
}
