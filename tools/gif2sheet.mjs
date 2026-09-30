/**
 * Converte um GIF animado numa spritesheet PNG com os frames lado a lado.
 * Sem dependencias: descodifica o LZW do GIF e escreve o PNG com o png.mjs aqui ao lado.
 */
import fs from 'node:fs';
import { encodePng } from './png.mjs';

// ---------------------------------------------------------------- GIF

function lzwDecode(minCodeSize, data, pixelCount) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;

  let dict = [];
  let codeSize = minCodeSize + 1;

  const resetDict = () => {
    dict = [];
    for (let i = 0; i < clearCode; i++) dict.push([i]);
    dict.push(null); // clear
    dict.push(null); // end of information
    codeSize = minCodeSize + 1;
  };
  resetDict();

  const out = new Uint8Array(pixelCount);
  let outPos = 0;
  let bitPos = 0;
  let prev = null;

  const readCode = () => {
    let code = 0;
    for (let i = 0; i < codeSize; i++) {
      const byte = data[bitPos >> 3];
      if (byte === undefined) return eoiCode;
      code |= ((byte >> (bitPos & 7)) & 1) << i;
      bitPos++;
    }
    return code;
  };

  while (outPos < pixelCount) {
    const code = readCode();
    if (code === clearCode) { resetDict(); prev = null; continue; }
    if (code === eoiCode) break;

    let entry;
    if (code < dict.length && dict[code]) {
      entry = dict[code];
      if (prev) dict.push([...prev, entry[0]]);
    } else {
      if (!prev) break;
      entry = [...prev, prev[0]];
      dict.push(entry);
    }

    for (const px of entry) {
      if (outPos < pixelCount) out[outPos++] = px;
    }

    prev = entry;
    if (dict.length >= (1 << codeSize) && codeSize < 12) codeSize++;
  }

  return out;
}

function readSubBlocks(buf, offset) {
  const parts = [];
  let i = offset;
  while (buf[i] !== 0) {
    const len = buf[i];
    parts.push(buf.slice(i + 1, i + 1 + len));
    i += 1 + len;
  }
  return { data: Buffer.concat(parts), next: i + 1 };
}

function parseGif(buf) {
  if (buf.slice(0, 3).toString('ascii') !== 'GIF') throw new Error('nao e um GIF');

  const width = buf.readUInt16LE(6);
  const height = buf.readUInt16LE(8);
  const packed = buf[10];
  const gctSize = (packed & 0x80) ? 2 ** ((packed & 0x07) + 1) : 0;

  let i = 13;
  let globalPalette = null;
  if (gctSize) {
    globalPalette = buf.slice(i, i + gctSize * 3);
    i += gctSize * 3;
  }

  const frames = [];
  let gce = { transparentIndex: -1, delay: 10, disposal: 0 };

  // Tela acumulada em RGBA: os frames de um GIF podem ser parciais.
  let canvas = new Uint8Array(width * height * 4);

  while (i < buf.length) {
    const block = buf[i];

    if (block === 0x3b) break; // trailer

    if (block === 0x21) {
      const label = buf[i + 1];
      if (label === 0xf9) {
        const flags = buf[i + 3];
        gce = {
          transparentIndex: (flags & 0x01) ? buf[i + 6] : -1,
          delay: buf.readUInt16LE(i + 4),
          disposal: (flags >> 2) & 0x07,
        };
      }
      // Os blocos de extensao sao sempre seguidos de sub-blocos.
      i = readSubBlocks(buf, i + 2).next;
      continue;
    }

    if (block !== 0x2c) break; // bloco desconhecido

    const left = buf.readUInt16LE(i + 1);
    const top = buf.readUInt16LE(i + 3);
    const fw = buf.readUInt16LE(i + 5);
    const fh = buf.readUInt16LE(i + 7);
    const lf = buf[i + 9];
    const interlaced = Boolean(lf & 0x40);
    const lctSize = (lf & 0x80) ? 2 ** ((lf & 0x07) + 1) : 0;

    let j = i + 10;
    let palette = globalPalette;
    if (lctSize) {
      palette = buf.slice(j, j + lctSize * 3);
      j += lctSize * 3;
    }

    const minCodeSize = buf[j];
    const { data, next } = readSubBlocks(buf, j + 1);
    const indices = lzwDecode(minCodeSize, data, fw * fh);

    // Guarda o estado anterior para o metodo de descarte 3.
    const previous = canvas.slice();

    // Desenha o frame sobre a tela.
    const rowOrder = interlaced ? deinterlaceRows(fh) : null;
    for (let y = 0; y < fh; y++) {
      const srcRow = rowOrder ? rowOrder[y] : y;
      for (let x = 0; x < fw; x++) {
        const index = indices[y * fw + x];
        if (index === gce.transparentIndex) continue;

        const cx = left + x;
        const cy = top + srcRow;
        if (cx >= width || cy >= height) continue;

        const target = (cy * width + cx) * 4;
        canvas[target] = palette[index * 3];
        canvas[target + 1] = palette[index * 3 + 1];
        canvas[target + 2] = palette[index * 3 + 2];
        canvas[target + 3] = 255;
      }
    }

    frames.push({ rgba: canvas.slice(), delay: gce.delay });

    // Descarte: 2 = limpar a area do frame, 3 = repor o estado anterior.
    if (gce.disposal === 2) {
      for (let y = top; y < Math.min(top + fh, height); y++) {
        for (let x = left; x < Math.min(left + fw, width); x++) {
          const t = (y * width + x) * 4;
          canvas[t] = canvas[t + 1] = canvas[t + 2] = canvas[t + 3] = 0;
        }
      }
    } else if (gce.disposal === 3) {
      canvas = previous;
    }

    i = next;
  }

  return { width, height, frames };
}

/** Ordem real das linhas num GIF entrelacado. */
function deinterlaceRows(height) {
  const rows = [];
  for (let y = 0; y < height; y += 8) rows.push(y);
  for (let y = 4; y < height; y += 8) rows.push(y);
  for (let y = 2; y < height; y += 4) rows.push(y);
  for (let y = 1; y < height; y += 2) rows.push(y);
  return rows;
}

// ---------------------------------------------------------------- main

const [input, output] = process.argv.slice(2);
const gif = parseGif(fs.readFileSync(input));

const sheetWidth = gif.width * gif.frames.length;
const sheet = new Uint8Array(sheetWidth * gif.height * 4);

gif.frames.forEach((frame, index) => {
  const offsetX = index * gif.width;
  for (let y = 0; y < gif.height; y++) {
    for (let x = 0; x < gif.width; x++) {
      const from = (y * gif.width + x) * 4;
      const to = (y * sheetWidth + offsetX + x) * 4;
      sheet[to] = frame.rgba[from];
      sheet[to + 1] = frame.rgba[from + 1];
      sheet[to + 2] = frame.rgba[from + 2];
      sheet[to + 3] = frame.rgba[from + 3];
    }
  }
});

fs.writeFileSync(output, encodePng(sheetWidth, gif.height, sheet));

const opaque = sheet.filter((_, i) => i % 4 === 3 && sheet[i] > 0).length;
console.log(`frames: ${gif.frames.length}`);
console.log(`atrasos (1/100s): ${gif.frames.map((f) => f.delay).join(', ')}`);
console.log(`folha: ${sheetWidth}x${gif.height} px`);
console.log(`pixels opacos: ${opaque} de ${sheetWidth * gif.height}`);
