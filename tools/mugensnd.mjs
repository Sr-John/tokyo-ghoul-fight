/**
 * Exporta alguns sons de um .snd do MUGEN, um .wav por som, e regista-os no
 * character.json da pasta de saida (que tem de existir).
 *
 *   node tools/mugensnd.mjs <ficheiro.snd> <pasta do personagem> <grupo,numero> [...]
 *
 * Serve para os personagens com dezenas de megabytes de som, de que o jogo
 * so usa uma parte. O mugen2game exporta-os todos.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseSnd } from './mugen.mjs';

const [sndPath, outDir, ...wanted] = process.argv.slice(2);
if (wanted.length === 0) {
  console.error('uso: node tools/mugensnd.mjs <ficheiro.snd> <pasta do personagem> <grupo,numero> [...]');
  process.exit(1);
}

const manifestPath = path.join(outDir, 'character.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const sounds = new Set(manifest.sounds ?? []);
const want = new Set(wanted.map((id) => id.replace(',', '_')));

fs.mkdirSync(path.join(outDir, 'snd'), { recursive: true });

let bytes = 0;
const found = new Set();
for (const sound of parseSnd(fs.readFileSync(sndPath))) {
  const id = `${sound.group}_${sound.item}`;
  // Numeros repetidos: fica o primeiro, como no MUGEN.
  if (!want.has(id) || found.has(id)) continue;
  fs.writeFileSync(path.join(outDir, 'snd', `${id}.wav`), sound.data);
  found.add(id);
  sounds.add(id);
  bytes += sound.data.length;
}

manifest.sounds = [...sounds];
fs.writeFileSync(manifestPath, JSON.stringify(manifest));

const missing = [...want].filter((id) => !found.has(id));
console.log(`sons: ${found.size} (${(bytes / 1e6).toFixed(1)} MB)`);
if (missing.length) console.log(`nao existem no .snd: ${missing.join(' ')}`);
