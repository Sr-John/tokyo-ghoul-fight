/**
 * Carregamento e reprodução de animações a partir de imagens PNG.
 *
 * Funciona com uma imagem única (um só frame) ou com uma spritesheet, que é
 * uma imagem com os frames lado a lado numa única linha. A geometria é
 * medida a partir da própria imagem depois de carregar, por isso basta dizer
 * quantos frames tem — não é preciso andar a medir pixels à mão.
 *
 * O tempo conta-se em ticks do game loop (1 tick = 1 frame de render, ~60
 * por segundo), para acompanhar o resto do jogo, que também trabalha por
 * frame e não por relógio.
 */

export class SpriteAnimation {
  constructor({
    name,
    src,
    /** Quantos frames a imagem tem, lado a lado. 1 = imagem única. */
    frameCount = 1,
    /** Ticks que cada frame fica no ecrã. Maior = mais lento. */
    ticksPerFrame = 8,
    loop = true,
    /**
     * Tamanho de cada frame. Deixa em null para ser medido a partir da
     * imagem — só é preciso preencher se a folha tiver margens ou
     * espaçamento entre frames.
     */
    frameWidth = null,
    frameHeight = null,
    /** Acerto fino da posição, em pixels de ecrã. */
    offsetX = 0,
    offsetY = 0,
  }) {
    this.name = name;
    this.src = src;
    this.frameCount = frameCount;
    this.ticksPerFrame = ticksPerFrame;
    this.loop = loop;
    this.frameWidth = frameWidth;
    this.frameHeight = frameHeight;
    this.offsetX = offsetX;
    this.offsetY = offsetY;

    this.ready = false;
    this.failed = false;
    this.image = null;

    this.load();
  }

  load() {
    // Fora do browser (testes em Node) não há Image: a animação fica marcada
    // como falhada e o lutador cai no desenho de reserva.
    if (typeof Image === 'undefined') {
      this.failed = true;
      return;
    }

    this.image = new Image();

    this.image.addEventListener('load', () => {
      // Mede a geometria agora que se sabe o tamanho real da imagem.
      this.frameWidth ??= Math.floor(this.image.naturalWidth / this.frameCount);
      this.frameHeight ??= this.image.naturalHeight;
      this.ready = true;
    });

    this.image.addEventListener('error', () => {
      this.failed = true;
      console.warn(
        `[sprites] não consegui carregar "${this.src}". `
        + 'O lutador fica com o desenho de reserva até o ficheiro existir.',
      );
    });

    this.image.src = this.src;
  }

  get totalTicks() {
    return this.frameCount * this.ticksPerFrame;
  }

  /** Frame a mostrar num dado tick. Sem loop, fixa no último frame. */
  frameAt(tick) {
    const index = Math.floor(tick / this.ticksPerFrame);
    return this.loop
      ? index % this.frameCount
      : Math.min(index, this.frameCount - 1);
  }

  isFinished(tick) {
    return !this.loop && tick >= this.totalTicks;
  }

  drawFrame(ctx, frameIndex, dx, dy, dw, dh) {
    ctx.drawImage(
      this.image,
      frameIndex * this.frameWidth,
      0,
      this.frameWidth,
      this.frameHeight,
      dx,
      dy,
      dw,
      dh,
    );
  }
}

/**
 * Guarda o conjunto de animações de um lutador e qual está a tocar.
 *
 * O contador de ticks é próprio do animador (e não o do lutador) porque
 * reinicia a cada troca de animação — é isso que permite um ataque tocar do
 * princípio e saber quando acabou.
 */
export class Animator {
  constructor(definitions = {}) {
    this.animations = new Map(
      Object.entries(definitions).map(
        ([name, definition]) => [name, new SpriteAnimation({ name, ...definition })],
      ),
    );

    this.currentName = null;
    this.tick = 0;
  }

  get current() {
    return this.animations.get(this.currentName) ?? null;
  }

  has(name) {
    return this.animations.has(name);
  }

  play(name, { restart = false } = {}) {
    if (!this.animations.has(name)) return false;
    if (this.currentName === name && !restart) return true;

    this.currentName = name;
    this.tick = 0;
    return true;
  }

  update() {
    this.tick += 1;
  }

  get isFinished() {
    const animation = this.current;
    return animation ? animation.isFinished(this.tick) : true;
  }

  get frameIndex() {
    const animation = this.current;
    return animation ? animation.frameAt(this.tick) : 0;
  }
}
