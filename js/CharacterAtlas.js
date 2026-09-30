import { FrameTimeline } from './SpriteAnimation.js';

/**
 * Um personagem inteiro trazido do MUGEN pelo tools/mugen2game.mjs.
 *
 * Em vez de uma imagem por animação, há um atlas com todos os sprites e um
 * character.json que diz onde está cada um e que sprites formam cada
 * animação. Qualquer uma das centenas de animações do personagem fica
 * disponível pelo número que tem no MUGEN (a "acção"), sem gerar mais nada.
 */

const HIT_BOX_COLOR = 'rgba(255, 40, 40, 0.45)';
const BODY_BOX_COLOR = 'rgba(60, 140, 255, 0.35)';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error(`não consegui carregar "${src}"`)));
    image.src = src;
  });
}

/**
 * Modo de mistura de um frame do MUGEN, traduzido para o canvas. "A" soma a
 * cor ao fundo (brilhos); "S" subtrai-a (escurece); "AS<origem>D<destino>"
 * é uma transparência, com a origem de 0 a 256.
 */
function parseBlend(blend = '') {
  const alpha = blend.match(/^AS(\d+)D(\d+)$/);
  if (alpha) {
    // O MUGEN soma a origem e o destino, cada um com o seu peso. Quando os
    // pesos passam do total (256), o efeito é sobretudo de somar luz; o
    // fundo, esse, fica escurecido pelo peso dele (`dim`) debaixo do sprite.
    // Abaixo do total, é uma transparência normal.
    const source = Number(alpha[1]);
    const destination = Number(alpha[2]);
    const additive = source + destination > 256;
    return {
      alpha: Math.min(1, source / 256),
      additive,
      subtract: false,
      dim: additive ? Math.max(0, 1 - destination / 256) : 0,
    };
  }
  return { alpha: 1, additive: blend === 'A', subtract: blend === 'S' };
}

/** Aplica um modo de mistura ao canvas. Quem chama faz o save/restore. */
export function applyBlend(ctx, { alpha = 1, additive = false, subtract = false }) {
  ctx.globalAlpha *= alpha;
  if (additive) ctx.globalCompositeOperation = 'lighter';
  if (subtract) {
    // O canvas não subtrai; multiplicar pelo negativo do sprite escurece
    // nos mesmos sítios, que é o efeito que estes sprites procuram.
    ctx.globalCompositeOperation = 'multiply';
    ctx.filter = 'invert(1)';
  }
}

export class CharacterAtlas {
  constructor({ sprites, actions, sounds = [] }, images, basePath = '') {
    this.sprites = sprites;
    this.actions = actions;
    this.sounds = new Set(sounds);
    this.images = images;
    this.basePath = basePath;
  }

  /** Carrega o character.json e os atlas de uma pasta. */
  static async load(basePath) {
    const response = await fetch(`${basePath}/character.json`);
    if (!response.ok) throw new Error(`não consegui carregar "${basePath}/character.json"`);

    const data = await response.json();
    const images = await Promise.all(
      data.atlases.map((name) => loadImage(`${basePath}/${name}`)),
    );
    return new CharacterAtlas(data, images, basePath);
  }

  has(action) {
    return action in this.actions;
  }

  /** Números de todas as acções disponíveis, por ordem. */
  get actionNumbers() {
    return Object.keys(this.actions).map(Number).sort((a, b) => a - b);
  }

  /** A animação de uma acção, ou null se o personagem não a tiver. */
  animation(action, { name = `action:${action}`, loop = true } = {}) {
    if (!this.has(action)) return null;
    return new AtlasAnimation({ name, character: this, action, loop });
  }

  /**
   * Desenha um sprite solto, pelo "grupo,número" do MUGEN, com o eixo dele
   * na origem do canvas. Devolve false se o personagem não o tiver.
   */
  drawSprite(ctx, id, scale) {
    const sprite = this.sprites[id];
    if (!sprite) return false;

    const [page, sx, sy, width, height, axisX, axisY] = sprite;
    ctx.drawImage(
      this.images[page],
      sx,
      sy,
      width,
      height,
      -axisX * scale,
      -axisY * scale,
      width * scale,
      height * scale,
    );
    return true;
  }

  /** Toca um som do personagem, pelo grupo e número que tem no MUGEN. */
  playSound(group, item, { volume = 1 } = {}) {
    if (!this.sounds.has(`${group}_${item}`)) return null;

    const audio = new Audio(`${this.basePath}/snd/${group}_${item}.wav`);
    audio.volume = Math.min(1, volume);
    // O browser recusa som antes de o jogador tocar numa tecla; não é erro.
    audio.play().catch(() => {});
    // Quem chama pode querer calá-lo a meio (audio.pause()).
    return audio;
  }
}

export class AtlasAnimation extends FrameTimeline {
  constructor({ name, character, action, loop = true }) {
    const data = character.actions[action];

    super({
      name,
      // No MUGEN, -1 é "fica neste frame até o estado mudar"; aqui quem
      // decide quando uma animação acaba é o jogo, por isso vale um tick.
      frameTicks: data.frames.map((frame) => (frame.t > 0 ? frame.t : 1)),
      loop,
      loopStart: data.loopStart ?? 0,
    });

    this.character = character;
    this.action = action;

    this.frames = data.frames.map((frame) => ({
      // [atlas, x, y, largura, altura, eixoX, eixoY], ou null num frame vazio.
      sprite: frame.s ? character.sprites[frame.s] : null,
      x: frame.x ?? 0,
      y: frame.y ?? 0,
      flipH: (frame.flip ?? '').includes('H'),
      flipV: (frame.flip ?? '').includes('V'),
      // Ampliação e rotação próprias do frame, que alguns efeitos trazem.
      scale: frame.scale ?? [1, 1],
      angle: frame.angle ?? 0,
      ...parseBlend(frame.blend),
      /** Caixas de ataque e de corpo: [x1, y1, x2, y2] a partir dos pés. */
      hit: frame.hit ?? [],
      body: frame.body ?? [],
    }));

    // Os atlas já vêm carregados, por isso nunca há que esperar.
    this.ready = true;

    // Altura da arte acima do chão no primeiro frame; serve de referência a
    // quem não fixa a escala.
    this.frameHeight = this.frames[0].sprite?.[6] ?? 1;
  }

  /**
   * Desenha um frame com a origem do canvas nos pés do lutador. Cada sprite
   * traz o seu eixo (o ponto que assenta no chão), por isso os frames podem
   * ter tamanhos diferentes sem o lutador saltar de sítio.
   */
  draw(ctx, frameIndex, scale) {
    const frame = this.frames[frameIndex];
    if (!frame.sprite) return;

    const [page, sx, sy, width, height, axisX, axisY] = frame.sprite;

    ctx.save();
    ctx.translate(frame.x * scale, frame.y * scale);
    if (frame.angle) ctx.rotate((-frame.angle * Math.PI) / 180);
    ctx.scale(
      (frame.flipH ? -1 : 1) * frame.scale[0],
      (frame.flipV ? -1 : 1) * frame.scale[1],
    );
    const drawImage = () => ctx.drawImage(
      this.character.images[page],
      sx,
      sy,
      width,
      height,
      -axisX * scale,
      -axisY * scale,
      width * scale,
      height * scale,
    );
    if (frame.dim > 0) {
      // Primeiro escurece o fundo com a silhueta do sprite, depois soma-lhe a luz.
      ctx.save();
      ctx.globalAlpha *= frame.dim;
      ctx.filter = 'brightness(0)';
      drawImage();
      ctx.restore();
    }
    applyBlend(ctx, frame);
    drawImage();
    ctx.restore();
  }

  /** Desenha um frame esticado a um rectângulo inteiro: clarões e fundos de ecrã. */
  drawCover(ctx, frameIndex, width, height) {
    const frame = this.frames[frameIndex];
    if (!frame.sprite) return;

    const [page, sx, sy, spriteWidth, spriteHeight] = frame.sprite;

    ctx.save();
    applyBlend(ctx, frame);
    ctx.drawImage(
      this.character.images[page], sx, sy, spriteWidth, spriteHeight, 0, 0, width, height,
    );
    ctx.restore();
  }

  /**
   * O rectângulo que a arte do frame ocupa, [x1, y1, x2, y2] a partir dos pés
   * e nas medidas da arte (as mesmas das caixas), ou null num frame vazio.
   */
  artBounds(frameIndex) {
    const frame = this.frames[frameIndex];
    if (!frame?.sprite) return null;

    const [, , , width, height, axisX, axisY] = frame.sprite;
    const [scaleX, scaleY] = frame.scale;
    let left = -axisX * scaleX;
    let right = (width - axisX) * scaleX;
    let top = -axisY * scaleY;
    let bottom = (height - axisY) * scaleY;
    if (frame.flipH) [left, right] = [-right, -left];
    if (frame.flipV) [top, bottom] = [-bottom, -top];
    return [left + frame.x, top + frame.y, right + frame.x, bottom + frame.y];
  }

  /** Desenha as caixas de colisão do frame, para afinar os golpes. */
  drawBoxes(ctx, frameIndex, scale) {
    const frame = this.frames[frameIndex];

    for (const [boxes, color] of [[frame.body, BODY_BOX_COLOR], [frame.hit, HIT_BOX_COLOR]]) {
      ctx.fillStyle = color;
      for (const [x1, y1, x2, y2] of boxes) {
        ctx.fillRect(x1 * scale, y1 * scale, (x2 - x1) * scale, (y2 - y1) * scale);
      }
    }
  }
}
