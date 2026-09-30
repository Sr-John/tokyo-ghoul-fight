/**
 * Como o mugenfx, mas para efeitos grandes de mais para irem inteiros: os
 * sprites saem a metade da resolucao (cada frame leva ampliacao 2 para o
 * jogo os desenhar do mesmo tamanho) e, se pedido, com menos frames.
 *
 *   node tools/mugenfxsmall.mjs <ficheiro.sff> <ficheiro.air> <pasta de saida> <accao>[/passo] [...]
 *
 * `accao/3` fica com um frame em cada tres, cada um a durar o tempo dos tres
 * (as caixas de ataque dos que saem juntam-se as do que fica). Sem passo,
 * ficam todos. Serve para chamas, clarões e cenarios: perdem pouco com isto
 * e passam a pesar um oitavo ou menos.
 */
import fs from 'node:fs';
import path from 'node:path';
import { exportActions } from './atlas.mjs';
import { parseAir, parseSff } from './mugen.mjs';

/** Quanto encolhe cada lado dos sprites. */
const SHRINK = 2;

const [sffPath, airPath, outDir, ...actionArgs] = process.argv.slice(2);
if (actionArgs.length === 0) {
  console.error('uso: node tools/mugenfxsmall.mjs <ficheiro.sff> <ficheiro.air> <pasta de saida> <accao>[/passo] [...]');
  process.exit(1);
}

const sff = parseSff(fs.readFileSync(sffPath));
const air = parseAir(fs.readFileSync(airPath, 'latin1'));

const requests = actionArgs.map((arg) => {
  const [number, step = '1'] = arg.split('/');
  return { number: Number(number), step: Math.max(1, Number(step)) };
});
const missing = requests.filter(({ number }) => !air.has(number));
if (missing.length) {
  throw new Error(`accoes que nao existem no .air: ${missing.map((r) => r.number).join(', ')}`);
}

/** Um frame em cada `step`: dura o tempo do grupo e fica com as caixas todas. */
function thin(action, step) {
  const frames = [];
  for (let i = 0; i < action.frames.length; i += step) {
    const group = action.frames.slice(i, i + step);
    const time = group.some((frame) => frame.time < 0)
      ? -1
      : group.reduce((sum, frame) => sum + frame.time, 0);
    const [first] = group;
    frames.push({
      ...first,
      time,
      scale: [(first.scale?.[0] ?? 1) * SHRINK, (first.scale?.[1] ?? 1) * SHRINK],
      clsn1: group.flatMap((frame) => frame.clsn1),
    });
  }
  return { frames, loopStart: Math.floor(action.loopStart / step) };
}

const smallAir = new Map(requests.map(({ number, step }) => [number, thin(air.get(number), step)]));

// Os sprites a metade: a geometria encolhe ja aqui, os pixels ao desenhar.
const smallById = new Map();
for (const [id, sprite] of sff.byId) {
  smallById.set(id, {
    source: sprite,
    width: Math.max(1, Math.ceil(sprite.width / SHRINK)),
    height: Math.max(1, Math.ceil(sprite.height / SHRINK)),
    axisX: Math.round(sprite.axisX / SHRINK),
    axisY: Math.round(sprite.axisY / SHRINK),
  });
}

/**
 * Cada pixel novo e a media do quadrado que substitui, pesada pela
 * opacidade: as bordas das chamas ficam macias em vez de escurecerem.
 */
function renderSmall(small, palette) {
  const { source, width, height } = small;
  const big = sff.render(source, palette);
  const out = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0; let g = 0; let b = 0; let a = 0;
      for (let dy = 0; dy < SHRINK; dy++) {
        for (let dx = 0; dx < SHRINK; dx++) {
          const sx = x * SHRINK + dx;
          const sy = y * SHRINK + dy;
          if (sx >= source.width || sy >= source.height) continue;
          const p = (sy * source.width + sx) * 4;
          const alpha = big[p + 3];
          r += big[p] * alpha;
          g += big[p + 1] * alpha;
          b += big[p + 2] * alpha;
          a += alpha;
        }
      }
      if (a === 0) continue;
      const q = (y * width + x) * 4;
      out[q] = Math.round(r / a);
      out[q + 1] = Math.round(g / a);
      out[q + 2] = Math.round(b / a);
      out[q + 3] = Math.round(a / (SHRINK * SHRINK));
    }
  }
  return out;
}

const { atlases, sprites, actions, pages } = exportActions({
  sff: { byId: smallById, render: renderSmall },
  air: smallAir,
  numbers: requests.map(({ number }) => number),
  outDir,
});

fs.writeFileSync(
  path.join(outDir, 'character.json'),
  JSON.stringify({ atlases, sprites, actions, sounds: [] }),
);

console.log(`accoes: ${Object.keys(actions).length}`);
console.log(`sprites: ${Object.keys(sprites).length} em ${atlases.length} atlas`);
for (const page of pages) console.log(`  ${page.name}: ${page.width}x${page.height} px`);
