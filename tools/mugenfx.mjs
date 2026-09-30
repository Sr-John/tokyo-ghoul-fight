/**
 * Exporta um conjunto de efeitos de um personagem do MUGEN: as animacoes
 * grandes (auras, cortes de ecra, cenarios) que o mugen2game deixa de fora.
 *
 *   node tools/mugenfx.mjs <ficheiro.sff> <ficheiro.air> <pasta de saida> <accao> [<accao> ...]
 *
 * Um argumento da forma s:grupo,numero junta um sprite solto (um retrato,
 * por exemplo), que nao pertence a nenhuma accao. E um da forma
 * c:accao:grupo,numero:nova junta uma copia da accao pintada com outra
 * paleta do .sff, com o numero `nova`.
 *
 * Escreve atlas-N.png e character.json, no mesmo formato do personagem, so
 * com as accoes pedidas. Sao sprites grandes: convem pedir apenas os que um
 * golpe usa, e guarda-los numa pasta propria por golpe.
 */
import fs from 'node:fs';
import path from 'node:path';
import { exportActions } from './atlas.mjs';
import { parseAir, parseSff } from './mugen.mjs';

const [sffPath, airPath, outDir, ...actionArgs] = process.argv.slice(2);
if (actionArgs.length === 0) {
  console.error('uso: node tools/mugenfx.mjs <ficheiro.sff> <ficheiro.air> <pasta de saida> <accao> [<accao> ...]');
  process.exit(1);
}

const sff = parseSff(fs.readFileSync(sffPath));
const air = parseAir(fs.readFileSync(airPath, 'latin1'));

const extraSprites = actionArgs.filter((arg) => arg.startsWith('s:')).map((arg) => arg.slice(2));
const recolors = actionArgs.filter((arg) => arg.startsWith('c:')).map((arg) => {
  const [, from, palette, to] = arg.split(':');
  return { from: Number(from), palette, to: Number(to) };
});
const numbers = actionArgs.filter((arg) => !/^[sc]:/.test(arg)).map(Number);
const missing = numbers.filter((number) => !air.has(number));
if (missing.length) throw new Error(`accoes que nao existem no .air: ${missing.join(', ')}`);

const { atlases, sprites, actions, pages } = exportActions({
  sff, air, numbers, outDir, extraSprites, recolors,
});

fs.writeFileSync(
  path.join(outDir, 'character.json'),
  JSON.stringify({ atlases, sprites, actions, sounds: [] }),
);

console.log(`accoes: ${Object.keys(actions).length}`);
console.log(`sprites: ${Object.keys(sprites).length} em ${atlases.length} atlas`);
for (const page of pages) console.log(`  ${page.name}: ${page.width}x${page.height} px`);
