import { applyBlend } from './CharacterAtlas.js';

/**
 * Camada de efeitos: animações soltas desenhadas por trás ou por cima dos
 * lutadores — auras, salpicos, clarões de ecrã inteiro.
 *
 * Cada efeito é uma animação com posição, velocidade e duração próprias, que
 * não pertence a nenhum lutador. Há dois planos: 'back' desenha-se entre a
 * arena e os lutadores, 'front' por cima deles.
 */
/**
 * Uma fotografia (um JPG ou PNG solto) para usar como efeito de ecrã
 * inteiro: enche o ecrã sem deformar, cortando o que sobrar, e aproxima-se
 * devagar enquanto está à vista.
 */
export class Picture {
  constructor(image, { zoomPerTick = 0.0006 } = {}) {
    this.image = image;
    this.zoomPerTick = zoomPerTick;
    // Não acaba sozinha: fica até ser retirada.
    this.totalTicks = Infinity;
  }

  /** Não tem frames; o "frame" é o tick, que é o que dá a aproximação. */
  frameAt(tick) {
    return tick;
  }

  drawCover(ctx, tick, width, height) {
    const { naturalWidth, naturalHeight } = this.image;
    const zoom = 1 + tick * this.zoomPerTick;
    // A parte da fotografia com as proporções do ecrã, ao centro.
    const scale = Math.max(width / naturalWidth, height / naturalHeight) * zoom;
    const cropWidth = width / scale;
    const cropHeight = height / scale;

    ctx.save();
    // Ao contrário da pixel art, uma fotografia quer-se suavizada.
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      this.image,
      (naturalWidth - cropWidth) / 2,
      (naturalHeight - cropHeight) / 2,
      cropWidth,
      cropHeight,
      0,
      0,
      width,
      height,
    );
    ctx.restore();
  }
}

/** Carrega uma fotografia; falha se o ficheiro não existir. */
export function loadPicture(src, options) {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      reject(new Error('sem suporte para imagens'));
      return;
    }

    const image = new Image();
    image.addEventListener('load', () => resolve(new Picture(image, options)));
    image.addEventListener('error', () => reject(new Error(`não consegui carregar "${src}"`)));
    image.src = src;
  });
}

export class EffectLayer {
  constructor({ width, height }) {
    this.width = width;
    this.height = height;
    this.effects = [];
  }

  /**
   * Larga um efeito. Devolve-o, para quem quiser mexer-lhe depois.
   *
   *   animation  a animação a tocar (ou uma Picture, com `cover`)
   *   x, y       onde fica o eixo do sprite, em coordenadas do ringue
   *   velocity   [x, y] em px por tick
   *   scale      [x, y], px de ecrã por px da arte
   *   facing     -1 espelha
   *   angle      rotação em graus, no sentido contrário ao dos ponteiros
   *   layer      'back' ou 'front'; 'backdrop' fica atrás de tudo, fora da câmara
   *   cover      estica o sprite ao ecrã inteiro (ignora x, y e scale)
   *   blend      { alpha, additive, subtract }, por cima do que a animação já traz
   *   filter     filtro do canvas (por exemplo 'blur(2px)')
   *   frame      mostra sempre este frame, em vez de tocar a animação
   *   duration   ticks de vida; sem ele, vive até a animação acabar
   *   fadeOut    nos últimos tantos ticks de vida, vai-se apagando
   *   hold       fica no último frame (ou em ciclo) até ser retirado à mão
   *   tag        nome para o retirar com clear(tag)
   */
  spawn({
    animation,
    x = 0,
    y = 0,
    velocity = [0, 0],
    scale = [1, 1],
    facing = 1,
    angle = 0,
    layer = 'front',
    cover = false,
    blend = null,
    filter = null,
    frame = null,
    duration = null,
    fadeOut = 0,
    hold = false,
    tag = null,
  }) {
    if (!animation) return null;

    const effect = {
      animation,
      x,
      y,
      velocity,
      scale,
      facing,
      angle,
      layer,
      cover,
      blend,
      filter,
      frame,
      duration,
      fadeOut,
      hold,
      tag,
      tick: 0,
    };
    this.effects.push(effect);
    return effect;
  }

  /** Retira os efeitos com um dado nome, ou todos. */
  clear(tag = null) {
    this.effects = tag === null
      ? []
      : this.effects.filter((effect) => effect.tag !== tag);
  }

  update() {
    for (const effect of this.effects) {
      effect.tick += 1;
      effect.x += effect.velocity[0];
      effect.y += effect.velocity[1];
    }

    this.effects = this.effects.filter((effect) => {
      if (effect.duration !== null) return effect.tick < effect.duration;
      return effect.hold || effect.tick < effect.animation.totalTicks;
    });
  }

  draw(ctx, layer) {
    for (const effect of this.effects) {
      if (effect.layer !== layer) continue;

      const index = effect.frame ?? effect.animation.frameAt(effect.tick);

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      if (effect.blend) applyBlend(ctx, effect.blend);
      if (effect.filter) ctx.filter = effect.filter;

      if (effect.fadeOut > 0 && !effect.hold) {
        const life = effect.duration ?? effect.animation.totalTicks;
        ctx.globalAlpha *= Math.max(0, Math.min(1, (life - effect.tick) / effect.fadeOut));
      }

      if (effect.cover) {
        effect.animation.drawCover(ctx, index, this.width, this.height);
      } else {
        ctx.translate(effect.x, effect.y);
        // Espelhar primeiro, para o ângulo valer em relação à frente do efeito.
        ctx.scale(effect.facing, 1);
        if (effect.angle) ctx.rotate((-effect.angle * Math.PI) / 180);
        ctx.scale(effect.scale[0], effect.scale[1]);
        effect.animation.draw(ctx, index, 1);
      }

      ctx.restore();
    }
  }
}
