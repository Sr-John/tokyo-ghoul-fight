/**
 * Tira uma animacao de um personagem do MUGEN e escreve-a como spritesheet
 * PNG, com os frames lado a lado, pronta para o jogo.
 *
 *   node tools/sff2sheet.mjs <ficheiro.sff> <ficheiro.air> <accao> <saida.png>
 *
 * O .sff guarda os sprites e o .air diz que sprites formam cada animacao
 * ("accao") e quanto tempo dura cada um. Accoes habituais: 0 parado, 20 andar,
 * 41 salto, 200 em diante ataques.
 *
 * So le SFF v2 (MUGEN 1.0/1.1). Sem dependencias.
 */
import fs from 'node:fs';
import { parseAir, parseSff } from './mugen.mjs';
import { encodePng } from './png.mjs';

/** Quantos pixels da arte ficam abaixo da linha do chao (a do idle tem 2). */
const BASELINE = 2;

// ---------------------------------------------------------------- main

const [sffPath, airPath, actionArg, output] = process.argv.slice(2);
if (!output) {
  console.error('uso: node tools/sff2sheet.mjs <ficheiro.sff> <ficheiro.air> <accao> <saida.png>');
  process.exit(1);
}

const sff = parseSff(fs.readFileSync(sffPath));
const { frames = [], loopStart = 0 } =
  parseAir(fs.readFileSync(airPath, 'latin1')).get(Number(actionArg)) ?? {};
if (frames.length === 0) throw new Error(`accao ${actionArg} nao existe no .air`);

// Posiciona cada frame em relacao ao eixo do MUGEN: x = 0 e o centro do
// personagem, y = 0 e o chao.
const placed = frames.map((frame) => {
  // Tempo -1 quer dizer "fica neste frame"; aqui vale o minimo.
  const time = frame.time > 0 ? frame.time : 1;
  const sprite = sff.byId.get(`${frame.group},${frame.item}`);
  // O grupo -1 (ou um sprite em falta) e um frame vazio.
  if (!sprite) return { time, width: 0, height: 0, left: 0, top: 0 };

  const flipH = frame.flip.includes('H');
  const axisX = flipH ? sprite.width - sprite.axisX : sprite.axisX;
  return {
    time,
    flipH,
    width: sprite.width,
    height: sprite.height,
    left: frame.x - axisX,
    top: frame.y - sprite.axisY,
    rgba: sff.render(sprite),
  };
});

// Todos os frames ficam do mesmo tamanho, com o eixo ao centro da largura e
// o chao a BASELINE pixels do fundo — e o que o jogo espera de uma folha.
const halfWidth = Math.max(...placed.map((f) => Math.max(-f.left, f.left + f.width)));
const top = Math.min(...placed.map((f) => f.top));
const below = Math.max(BASELINE, ...placed.map((f) => f.top + f.height));
const cellWidth = halfWidth * 2;
const cellHeight = below - top;

const cells = placed;
const frameTicks = placed.map((f) => f.time);
const uniform = frameTicks.every((time) => time === frameTicks[0]);

const sheetWidth = cellWidth * cells.length;
const sheet = new Uint8Array(sheetWidth * cellHeight * 4);

cells.forEach((frame, index) => {
  const originX = index * cellWidth + halfWidth + frame.left;
  const originY = frame.top - top;

  for (let y = 0; y < frame.height; y++) {
    for (let x = 0; x < frame.width; x++) {
      const from = (y * frame.width + (frame.flipH ? frame.width - 1 - x : x)) * 4;
      if (frame.rgba[from + 3] === 0) continue;
      const to = ((originY + y) * sheetWidth + originX + x) * 4;
      sheet.set(frame.rgba.subarray(from, from + 4), to);
    }
  }
});

fs.writeFileSync(output, encodePng(sheetWidth, cellHeight, sheet));

console.log(`accao ${actionArg}: ${frames.length} sprites`);
console.log(`folha: ${sheetWidth}x${cellHeight} px, frames de ${cellWidth}x${cellHeight}`);
console.log(`frameCount: ${cells.length}`);
// Quando os frames nao duram todos o mesmo, o jogo recebe a lista inteira.
console.log(uniform
  ? `ticksPerFrame: ${frameTicks[0]}`
  : `frameTicks: [${frameTicks.join(', ')}]`);
if (loopStart > 0) console.log(`loopStart: ${loopStart}`);
if (below > BASELINE) {
  console.log(`aviso: a arte desce ${below - BASELINE} px abaixo do chao; `
    + `compensa com offsetY = ${below - BASELINE} x a escala`);
}
