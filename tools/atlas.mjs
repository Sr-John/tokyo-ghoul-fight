/**
 * Junta as animacoes de um personagem do MUGEN num conjunto que o jogo le:
 * os sprites arrumados em poucas imagens (atlas) e a descricao de cada
 * animacao. Partilhado pelos conversores desta pasta.
 */
import fs from 'node:fs';
import path from 'node:path';
import { encodePng } from './png.mjs';

/** Lado maximo de cada atlas. 2048 cabe em qualquer browser e placa grafica. */
const ATLAS_SIZE = 2048;

/** Folga entre sprites, para um nao sangrar para o vizinho ao ampliar. */
const PADDING = 1;

const spriteId = (frame) => `${frame.group},${frame.item}`;

/**
 * Escreve em `outDir` os atlas com os sprites das accoes pedidas (mais os
 * `extraSprites`, dados como "grupo,numero") e devolve o que vai para o
 * character.json: { atlases, sprites, actions, pages }.
 *
 * `air` e o resultado do parseAir; `numbers` as accoes a incluir.
 *
 * `recolors` junta copias de accoes pintadas com outra paleta do .sff:
 * [{ from, palette: "grupo,numero", to }] cria a accao `to`, igual a `from`
 * noutra cor.
 */
export function exportActions({
  sff, air, numbers, outDir, extraSprites = [], recolors = [],
}) {
  const actions = {};
  const usedSprites = new Set(extraSprites.filter((id) => sff.byId.has(id)));
  // Os sprites repintados: o nome com que ficam -> { sprite, paleta }.
  const repainted = new Map();

  const jobs = [
    ...numbers.map((number) => ({ from: number, to: number, palette: null })),
    ...recolors,
  ];

  for (const { from, to, palette } of jobs) {
    const action = air.get(from);
    if (!action || action.frames.length === 0) continue;

    actions[to] = {
      loopStart: action.loopStart || undefined,
      frames: action.frames.map((frame) => {
        // O grupo -1 (ou um sprite que nao existe) e um frame vazio.
        const exists = sff.byId.has(spriteId(frame));
        const name = palette ? `${spriteId(frame)}@${palette}` : spriteId(frame);
        if (exists && palette) repainted.set(name, { id: spriteId(frame), palette });
        else if (exists) usedSprites.add(name);

        // Os campos a zero ou vazios ficam de fora para o ficheiro nao inchar.
        return {
          s: exists ? name : undefined,
          x: frame.x || undefined,
          y: frame.y || undefined,
          t: frame.time,
          flip: frame.flip || undefined,
          blend: frame.blend || undefined,
          scale: frame.scale ?? undefined,
          angle: frame.angle || undefined,
          hit: frame.clsn1.length ? frame.clsn1 : undefined,
          body: frame.clsn2.length ? frame.clsn2 : undefined,
        };
      }),
    };
  }

  // Arrumacao por prateleiras: os sprites vao por altura, do mais alto para o
  // mais baixo, lado a lado ate a linha encher; depois abre-se outra por baixo.
  const toPack = [
    ...[...usedSprites].map((id) => ({ id, sprite: sff.byId.get(id), palette: null })),
    ...[...repainted].map(([id, { id: source, palette }]) => (
      { id, sprite: sff.byId.get(source), palette }
    )),
  ].sort((a, b) => b.sprite.height - a.sprite.height);

  const pages = [];
  const sprites = {};
  let page = null;
  let cursorX = 0;
  let cursorY = 0;
  let shelfHeight = 0;

  for (const { id, sprite, palette } of toPack) {
    const { width, height } = sprite;
    if (width > ATLAS_SIZE || height > ATLAS_SIZE) {
      throw new Error(`sprite ${id} (${width}x${height}) nao cabe num atlas`);
    }

    if (page && cursorX + width > ATLAS_SIZE) {
      cursorX = 0;
      cursorY += shelfHeight + PADDING;
      shelfHeight = 0;
    }
    if (!page || cursorY + height > ATLAS_SIZE) {
      page = { placed: [], height: 0 };
      pages.push(page);
      cursorX = 0;
      cursorY = 0;
      shelfHeight = 0;
    }

    page.placed.push({ sprite, palette, x: cursorX, y: cursorY });
    page.height = Math.max(page.height, cursorY + height);
    sprites[id] = [
      pages.length - 1, cursorX, cursorY, width, height, sprite.axisX, sprite.axisY,
    ];

    cursorX += width + PADDING;
    shelfHeight = Math.max(shelfHeight, height);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const atlases = pages.map((current, index) => {
    const rgba = new Uint8Array(ATLAS_SIZE * current.height * 4);

    for (const { sprite, palette, x, y } of current.placed) {
      const pixels = sff.render(sprite, palette);
      for (let row = 0; row < sprite.height; row++) {
        const from = row * sprite.width * 4;
        rgba.set(
          pixels.subarray(from, from + sprite.width * 4),
          ((y + row) * ATLAS_SIZE + x) * 4,
        );
      }
    }

    const name = `atlas-${index}.png`;
    fs.writeFileSync(path.join(outDir, name), encodePng(ATLAS_SIZE, current.height, rgba));
    return name;
  });

  return {
    atlases,
    sprites,
    actions,
    pages: pages.map((current, index) => ({
      name: atlases[index],
      width: ATLAS_SIZE,
      height: current.height,
    })),
  };
}
