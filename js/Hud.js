/**
 * O HUD do combate: barras de vida com retrato e nome, e barras de energia.
 *
 * A arte é a de um pacote de lifebars de MUGEN (assets/hud), e a disposição
 * a que o fight.def dele define. Esse pacote foi desenhado para um ecrã de
 * 1280×720, e cada sprite traz no eixo a posição onde fica nesse ecrã; aqui
 * desenha-se tudo nessas medidas, com o canvas reduzido à proporção.
 */

/** O ecrã para que o pacote foi desenhado. */
const DESIGN_WIDTH = 1280;
const DESIGN_HEIGHT = 720;

/** Abaixo desta fracção de vida, a barra passa à cor de perigo. */
const DANGER_RATIO = 0.25;

/** Fracção da diferença que a barra de dano recente percorre por tick. */
const DRAIN_EASING = 0.035;

/** Energia de cada nível da barra. */
const POWER_PER_LEVEL = 1000;

/**
 * O que muda de um lado para o outro. `life` e `power` são os limites em x
 * da parte que se enche: [vazio, cheio]. `face` é a janela do retrato.
 */
const SIDES = [
  {
    sprites: { bar: '10,0', damage: '10,1', life: '10,2', danger: '10,3', tag: '25,0' },
    plate: '35,0',
    power: { back: '30,0', fill: '30,1', range: [103, 265], counter: [80, 689] },
    life: [578, 116],
    face: { x: 0, y: 16, width: 130, height: 48 },
    name: { x: 13, y: 31, align: 'left' },
    mirrored: false,
  },
  {
    sprites: { bar: '11,0', damage: '11,1', life: '11,2', danger: '11,3', tag: '25,1' },
    plate: '36,0',
    power: { back: '31,0', fill: '31,1', range: [1177, 1015], counter: [1201, 689] },
    life: [699, 1164],
    face: { x: 1150, y: 16, width: 130, height: 48 },
    name: { x: 1267, y: 31, align: 'right' },
    mirrored: true,
  },
];

/** A moldura do relógio, ao centro. */
const TIMER_SPRITE = '39,0';
const TIMER_CENTER = [640, 73];
/** Abaixo destes segundos, o relógio fica vermelho. */
const TIMER_WARNING = 10;

/**
 * Os rounds ganhos, ao lado do relógio: onde fica o primeiro ícone de cada
 * lado e para onde vão os seguintes. Os que faltam ganhar ficam apagados.
 */
const WIN_ICONS = [
  { sprite: '38,0', x: 526, y: 19, step: -30 },
  { sprite: '38,1', x: 719, y: 19, step: 30 },
];
const EMPTY_ICON_ALPHA = 0.25;

export class Hud {
  /**
   * `atlas` é o CharacterAtlas de assets/hud e `width` a largura do canvas.
   * `players` são os dois lados, por ordem: { fighter, name, portrait }, em
   * que `portrait` é { atlas, sprite, top } — o atlas e o sprite do retrato,
   * e a que altura dele (em fracção) começa a faixa que se mostra.
   */
  constructor({ atlas, width, players }) {
    this.atlas = atlas;

    /** Segundos que faltam no round; null mostra o infinito. */
    this.time = null;
    /** Rounds ganhos por cada lado, e quantos é preciso ganhar. */
    this.wins = [0, 0];
    this.winsNeeded = 2;

    this.scale = width / DESIGN_WIDTH;
    this.players = players.map((player, index) => ({
      ...player,
      side: SIDES[index],
      // A barra de dano recente persegue a de vida, para se ver o que saiu.
      damageRatio: player.fighter.healthRatio,
    }));
  }

  update() {
    for (const player of this.players) {
      const target = player.fighter.healthRatio;
      const delta = target - player.damageRatio;
      // Enquanto o combo dura, o dano fica todo à vista; só desce no fim.
      if (delta < 0 && player.fighter.isInCombo) continue;
      player.damageRatio = Math.abs(delta) < 0.001 || delta > 0
        ? target
        : player.damageRatio + delta * DRAIN_EASING;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.scale(this.scale, this.scale);
    ctx.imageSmoothingEnabled = true;

    for (const player of this.players) {
      this.drawFace(ctx, player);
      this.drawLife(ctx, player);
      this.drawPower(ctx, player);
      this.drawName(ctx, player);
    }
    this.drawTimer(ctx);
    this.drawWins(ctx);

    ctx.restore();
  }

  sprite(ctx, id) {
    this.atlas.drawSprite(ctx, id, 1);
  }

  /** Desenha um sprite cortado à faixa entre dois x. */
  spriteBetween(ctx, id, from, to) {
    const left = Math.min(from, to);
    const width = Math.abs(to - from);
    if (width <= 0) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(left, 0, width, DESIGN_HEIGHT);
    ctx.clip();
    this.sprite(ctx, id);
    ctx.restore();
  }

  /** A placa do nome e, por cima, a faixa do retrato. */
  drawFace(ctx, { side, portrait }) {
    this.sprite(ctx, side.plate);

    const sprite = portrait?.atlas?.sprites[portrait.sprite];
    if (!sprite) return;

    const [page, sx, sy, width, height] = sprite;
    const { face } = side;
    // O retrato enche a largura da janela; em altura mostra-se uma faixa.
    const scale = face.width / width;
    const top = (portrait.top ?? 0.25) * height * scale;

    ctx.save();
    ctx.beginPath();
    ctx.rect(face.x, face.y, face.width, face.height);
    ctx.clip();
    // O do lado direito olha para o centro: espelha-se.
    if (side.mirrored) {
      ctx.translate(face.x + face.width, face.y - top);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(face.x, face.y - top);
    }
    ctx.drawImage(
      portrait.atlas.images[page], sx, sy, width, height, 0, 0, width * scale, height * scale,
    );
    ctx.restore();
  }

  drawLife(ctx, { side, fighter, damageRatio }) {
    const [empty, full] = side.life;
    const edge = (ratio) => empty + (full - empty) * Math.max(0, Math.min(1, ratio));
    const ratio = fighter.healthRatio;

    this.sprite(ctx, side.sprites.bar);
    this.spriteBetween(ctx, side.sprites.damage, empty, edge(damageRatio));
    this.spriteBetween(
      ctx, ratio <= DANGER_RATIO ? side.sprites.danger : side.sprites.life, empty, edge(ratio),
    );
    this.sprite(ctx, side.sprites.tag);
  }

  /** A energia enche por níveis: a barra mostra o nível em curso, o número os já cheios. */
  drawPower(ctx, { side, fighter }) {
    if (fighter.power === undefined) return;

    const { back, fill, range, counter } = side.power;
    const level = Math.floor(fighter.power / POWER_PER_LEVEL);
    const isFull = fighter.power >= fighter.maxPower;
    const fraction = isFull ? 1 : (fighter.power % POWER_PER_LEVEL) / POWER_PER_LEVEL;

    this.sprite(ctx, back);
    this.spriteBetween(ctx, fill, range[0], range[0] + (range[1] - range[0]) * fraction);

    ctx.save();
    ctx.font = 'italic 900 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#0c0d11';
    ctx.fillStyle = isFull ? '#ffd84a' : '#ffffff';
    ctx.strokeText(level, counter[0], counter[1] - 8);
    ctx.fillText(level, counter[0], counter[1] - 8);
    ctx.restore();
  }

  drawName(ctx, { side, name }) {
    if (!name) return;

    ctx.save();
    ctx.font = 'italic 800 19px sans-serif';
    ctx.textAlign = side.name.align;
    ctx.textBaseline = 'top';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#0c0d11';
    ctx.fillStyle = '#ffffff';
    ctx.strokeText(name, side.name.x, side.name.y + 40);
    ctx.fillText(name, side.name.x, side.name.y + 40);
    ctx.restore();
  }

  /** O relógio do round: os segundos que faltam, ou o infinito sem tempo. */
  drawTimer(ctx) {
    this.sprite(ctx, TIMER_SPRITE);

    const text = this.time === null ? '∞' : String(Math.max(0, this.time)).padStart(2, '0');
    ctx.save();
    ctx.font = this.time === null ? '900 44px sans-serif' : 'italic 900 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#0c0d11';
    ctx.fillStyle = this.time !== null && this.time <= TIMER_WARNING ? '#ff4d5e' : '#ffffff';
    if (this.time !== null) ctx.strokeText(text, TIMER_CENTER[0], TIMER_CENTER[1] - 14);
    ctx.fillText(text, TIMER_CENTER[0], TIMER_CENTER[1] - 14);
    ctx.restore();
  }

  /** Um ícone por round a ganhar: aceso os já ganhos, apagado os outros. */
  drawWins(ctx) {
    WIN_ICONS.forEach((icon, index) => {
      for (let i = 0; i < this.winsNeeded; i += 1) {
        ctx.save();
        ctx.translate(icon.x + icon.step * i, icon.y);
        if (i >= this.wins[index]) ctx.globalAlpha = EMPTY_ICON_ALPHA;
        this.sprite(ctx, icon.sprite);
        ctx.restore();
      }
    });
  }
}
