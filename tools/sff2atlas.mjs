/**
 * Exporta sprites soltos de um .sff (sem animacoes): os de um HUD, por
 * exemplo. Escreve atlas-N.png e character.json, no formato do personagem.
 *
 *   node tools/sff2atlas.mjs <ficheiro.sff> <pasta de saida> <grupo> [<grupo> ...]
 *
 * Saem todos os sprites dos grupos pedidos.
 */
import fs from 'node:fs';
import path from 'node:path';
import { exportActions } from './atlas.mjs';
import { parseSff } from './mugen.mjs';

const [sffPath, outDir, ...groupArgs] = process.argv.slice(2);
if (groupArgs.length === 0) {
  console.error('uso: node tools/sff2atlas.mjs <ficheiro.sff> <pasta de saida> <grupo> [<grupo> ...]');
  process.exit(1);
}

const sff = parseSff(fs.readFileSync(sffPath));
const groups = new Set(groupArgs.map(Number));
const wanted = sff.sprites
  .filter((sprite) => groups.has(sprite.group))
  .map((sprite) => `${sprite.group},${sprite.item}`);

const { atlases, sprites, pages } = exportActions({
  sff, air: new Map(), numbers: [], outDir, extraSprites: wanted,
});

fs.writeFileSync(
  path.join(outDir, 'character.json'),
  JSON.stringify({ atlases, sprites, actions: {}, sounds: [] }),
);

console.log(`sprites: ${Object.keys(sprites).length} em ${atlases.length} atlas`);
for (const page of pages) console.log(`  ${page.name}: ${page.width}x${page.height} px`);
