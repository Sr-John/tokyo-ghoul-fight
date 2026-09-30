export const GRAVITY = 0.7;

/**
 * Representa um lutador no ringue.
 *
 * Ainda é um retângulo colorido, mas já com física: cai por acção da
 * gravidade, assenta no chão e não sai pelas laterais do ringue. Sprites,
 * hitboxes e estados de animação entram nos passos seguintes.
 */
export class Fighter {
  constructor({
    x,
    y,
    width = 50,
    height = 150,
    color = '#ffffff',
    bounds,
  }) {
    this.position = { x, y };
    this.velocity = { x: 0, y: 0 };
    this.width = width;
    this.height = height;
    this.color = color;

    // Limites do ringue: o lutador precisa de saber onde está o chão e as
    // paredes para a colisão, em vez de ir buscar o canvas por fora.
    this.bounds = bounds;
  }

  /** O chão, em coordenadas de canvas (topo do lutador quando assentado). */
  get groundY() {
    return this.bounds.height - this.height;
  }

  get isOnGround() {
    return this.position.y >= this.groundY;
  }

  jump(force) {
    // Só salta com os pés no chão — sem isto, manter a tecla premida daria
    // um salto infinito a meio do ar.
    if (this.isOnGround) {
      this.velocity.y = force;
    }
  }

  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.position.x, this.position.y, this.width, this.height);
  }

  update(ctx) {
    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;

    // Gravidade: aplicada enquanto o lutador ainda não chegou ao chão. Ao
    // aterrar, a posição é fixada para não haver afundamento nem tremor.
    if (this.position.y >= this.groundY) {
      this.position.y = this.groundY;
      this.velocity.y = 0;
    } else {
      this.velocity.y += GRAVITY;
    }

    // Mantém o lutador dentro do ringue.
    this.position.x = Math.max(
      0,
      Math.min(this.position.x, this.bounds.width - this.width),
    );

    this.draw(ctx);
  }
}
