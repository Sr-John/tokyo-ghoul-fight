/**
 * Traz um personagem do MUGEN inteiro para o jogo, de uma vez:
 *
 *   node tools/mugen2game.mjs <ficheiro.sff> <ficheiro.air> <ficheiro.snd> <pasta de saida>
 *
 * Escreve na pasta de saida:
 *   atlas-N.png     todos os sprites do corpo, arrumados em poucas imagens
 *   character.json  onde esta cada sprite, e todas as animacoes (frames,
 *                   tempos, caixas de colisao) por numero de accao
 *   snd/G_I.wav     os sons, um ficheiro por som
 *
 * Os efeitos grandes (rastros, auras, cenarios dos supers) ficam de fora:
 * sao dezenas de megabytes. Os que um golpe precisa exportam-se a parte, com
 * o tools/mugenfx.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { exportActions } from './atlas.mjs';
import { parseAir, parseSff, parseSnd } from './mugen.mjs';

/**
 * Grupos de sprites que sao o corpo do personagem: poses e golpes (abaixo de
 * 1000), reaccoes a apanhar (5000) e as mesmas da segunda forma (15000), e o
 * retrato (9000). O resto sao efeitos.
 */
function isBodyGroup(group) {
  return group < 1000
    || (group >= 5000 && group < 6000)
    || group === 9000
    || (group >= 15000 && group < 16000);
}

const [sffPath, airPath, sndPath, outDir] = process.argv.slice(2);
if (!outDir) {
  console.error('uso: node tools/mugen2game.mjs <ficheiro.sff> <ficheiro.air> <ficheiro.snd> <pasta de saida>');
  process.exit(1);
}

const sff = parseSff(fs.readFileSync(sffPath));
const air = parseAir(fs.readFileSync(airPath, 'latin1'));

// Uma accao que toca num sprite de efeito e um efeito, e fica de fora.
const numbers = [];
let skippedActions = 0;
for (const [number, action] of air) {
  if (action.frames.length === 0) continue;

  const isBody = action.frames.every(
    (frame) => frame.group < 0 || isBodyGroup(frame.group),
  );
  if (isBody) numbers.push(number);
  else skippedActions += 1;
}

// O retrato nao entra em nenhuma accao, mas faz falta para o HUD.
const portraits = sff.sprites
  .filter((sprite) => sprite.group === 9000)
  .map((sprite) => `${sprite.group},${sprite.item}`);

const { atlases, sprites, actions, pages } = exportActions({
  sff, air, numbers, outDir, extraSprites: portraits,
});

const sounds = [];
if (sndPath && fs.existsSync(sndPath)) {
  fs.mkdirSync(path.join(outDir, 'snd'), { recursive: true });
  for (const sound of parseSnd(fs.readFileSync(sndPath))) {
    const id = `${sound.group}_${sound.item}`;
    // Numeros repetidos: fica o primeiro, como no MUGEN.
    if (sounds.includes(id)) continue;
    fs.writeFileSync(path.join(outDir, 'snd', `${id}.wav`), sound.data);
    sounds.push(id);
  }
}

fs.writeFileSync(
  path.join(outDir, 'character.json'),
  JSON.stringify({ atlases, sprites, actions, sounds }),
);

console.log(`accoes: ${Object.keys(actions).length} (mais ${skippedActions} de efeitos, de fora)`);
console.log(`sprites: ${Object.keys(sprites).length} em ${atlases.length} atlas`);
for (const page of pages) console.log(`  ${page.name}: ${page.width}x${page.height} px`);
console.log(`sons: ${sounds.length}`);
