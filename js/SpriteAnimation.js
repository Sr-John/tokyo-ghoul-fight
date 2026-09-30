/**
 * Reprodução de animações.
 *
 * O tempo conta-se em ticks do game loop (1 tick = 1 frame de render, ~60
 * por segundo), para acompanhar o resto do jogo, que também trabalha por
 * frame e não por relógio.
 */

/**
 * A parte de uma animação que é só tempo: quanto dura cada frame, se repete
 * e a partir de onde. De onde vêm os pixels é com as subclasses.
 */
export class FrameTimeline {
  constructor({
    name,
    /** Duração de cada frame, em ticks. Uma entrada por frame. */
    frameTicks,
    loop = true,
    /**
     * Frame para onde a animação volta ao repetir. Serve para as que têm uma
     * parte de arranque que só toca uma vez antes do ciclo (0 = repete tudo).
     */
    loopStart = 0,
  }) {
    this.name = name;
    this.frameCount = frameTicks.length;
    this.loop = loop;
    this.loopStart = loopStart;

    // Tick em que cada frame acaba, acumulado: [2, 4, 3] -> [2, 6, 9].
    let total = 0;
    this.frameEnds = frameTicks.map((ticks) => (total += ticks));
  }

  get totalTicks() {
    return this.frameEnds.at(-1);
  }

  /** Frame a mostrar num dado tick. Sem loop, fixa no último frame. */
  frameAt(tick) {
    let local = tick;

    if (this.loop && tick >= this.totalTicks) {
      // Depois da primeira passagem, só se repete do loopStart em diante.
      const loopFrom = this.loopStart > 0 ? this.frameEnds[this.loopStart - 1] : 0;
      local = loopFrom + ((tick - this.totalTicks) % (this.totalTicks - loopFrom));
    }

    const found = this.frameEnds.findIndex((end) => local < end);
    return found === -1 ? this.frameCount - 1 : found;
  }

  isFinished(tick) {
    return !this.loop && tick >= this.totalTicks;
  }
}

/**
 * Animação a partir de uma imagem PNG solta: uma imagem única (um só frame)
 * ou uma spritesheet, que é uma imagem com os frames lado a lado numa única
 * linha. A geometria é medida a partir da própria imagem depois de carregar,
 * por isso basta dizer quantos frames tem — não é preciso andar a medir
 * pixels à mão.
 */
export class SpriteAnimation extends FrameTimeline {
  constructor({
    name,
    src,
    /** Quantos frames a imagem tem, lado a lado. 1 = imagem única. */
    frameCount = 1,
    /** Ticks que cada frame fica no ecrã. Maior = mais lento. */
    ticksPerFrame = 8,
    /**
     * Duração de cada frame, em ticks, quando não duram todos o mesmo — é o
     * que dá o tempo a um golpe (preparar devagar, bater depressa). Uma
     * entrada por frame; substitui o ticksPerFrame.
     */
    frameTicks = null,
    loop = true,
    loopStart = 0,
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
    super({
      name,
      frameTicks: frameTicks ?? Array(frameCount).fill(ticksPerFrame),
      loop,
      loopStart,
    });

    this.src = src;
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

  /**
   * Desenha um frame com a origem do canvas nos pés do lutador: o frame fica
   * centrado na largura e assente no chão.
   */
  draw(ctx, frameIndex, scale) {
    const width = this.frameWidth * scale;
    const height = this.frameHeight * scale;

    ctx.drawImage(
      this.image,
      frameIndex * this.frameWidth,
      0,
      this.frameWidth,
      this.frameHeight,
      -width / 2 + this.offsetX,
      -height + this.offsetY,
      width,
      height,
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
  /**
   * Cada entrada é uma animação já feita ou a descrição de uma spritesheet
   * (`{ src, frameCount, … }`), que é carregada aqui.
   */
  constructor(definitions = {}) {
    this.animations = new Map();
    for (const [name, definition] of Object.entries(definitions)) {
      this.add(
        name,
        definition instanceof FrameTimeline
          ? definition
          : new SpriteAnimation({ name, ...definition }),
      );
    }

    this.currentName = null;
    this.tick = 0;
  }

  add(name, animation) {
    this.animations.set(name, animation);
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
    // O tick conta os updates já feitos; o que está no ecrã é o anterior.
    return animation ? animation.frameAt(Math.max(0, this.tick - 1)) : 0;
  }
}
