/**
 * Leitura dos ficheiros de um personagem do MUGEN: sprites (.sff v2),
 * animacoes (.air) e sons (.snd). Partilhado pelos conversores desta pasta.
 */
import { decodePng } from './png.mjs';

// ---------------------------------------------------------------- SFF

function rle8Decode(src, size) {
  const out = new Uint8Array(size);
  let i = 0;
  let j = 0;
  while (j < size && i < src.length) {
    let value = src[i++];
    let run = 1;
    if ((value & 0xc0) === 0x40) {
      run = value & 0x3f;
      value = src[i++];
    }
    while (run-- > 0 && j < size) out[j++] = value;
  }
  return out;
}

function lz5Decode(src, size) {
  const out = new Uint8Array(size);
  const last = src.length - 1;
  let i = 0;
  let j = 0;
  const next = () => { const v = src[i]; if (i < last) i++; return v; };

  let control = next();
  let controlBit = 0;
  // Os 2 bits de cima dos pacotes de copia curta vao-se juntando aqui ate
  // formarem um byte, que serve de distancia ao quarto pacote.
  let recycled = 0;
  let recycledBits = 0;

  while (j < size) {
    let d = next();
    let n;

    if (control & (1 << controlBit)) {
      // Pacote de copia: repete pixels que ja sairam.
      if ((d & 0x3f) === 0) {
        d = ((d << 2) | next()) + 1;
        n = next() + 2;
      } else {
        recycled |= (d & 0xc0) >> recycledBits;
        recycledBits += 2;
        n = d & 0x3f;
        if (recycledBits < 8) {
          d = next() + 1;
        } else {
          d = recycled + 1;
          recycled = 0;
          recycledBits = 0;
        }
      }
      for (; n >= 0 && j < size; n--, j++) out[j] = out[j - d];
    } else {
      // Pacote RLE: uma cor repetida.
      if ((d & 0xe0) === 0) {
        n = next() + 8;
      } else {
        n = d >> 5;
        d &= 0x1f;
      }
      for (; n > 0 && j < size; n--) out[j++] = d;
    }

    if (++controlBit >= 8) {
      control = next();
      controlBit = 0;
    }
  }

  return out;
}

export function parseSff(buf) {
  if (buf.toString('ascii', 0, 11) !== 'ElecbyteSpr') throw new Error('nao e um SFF');
  if (buf[15] !== 2) {
    throw new Error(`SFF v${buf[15]} nao suportado: este conversor so le SFF v2`);
  }

  const spriteOffset = buf.readUInt32LE(36);
  const spriteCount = buf.readUInt32LE(40);
  const paletteOffset = buf.readUInt32LE(44);
  const paletteCount = buf.readUInt32LE(48);
  const ldataOffset = buf.readUInt32LE(52);
  const tdataOffset = buf.readUInt32LE(60);

  const palettes = [];
  // O "grupo,numero" de cada paleta, para as poder pedir pelo nome.
  const paletteIds = new Map();
  for (let i = 0; i < paletteCount; i++) {
    const o = paletteOffset + i * 16;
    const paletteId = `${buf.readUInt16LE(o)},${buf.readUInt16LE(o + 2)}`;
    if (!paletteIds.has(paletteId)) paletteIds.set(paletteId, i);
    const link = buf.readUInt16LE(o + 6);
    const offset = buf.readUInt32LE(o + 8);
    const length = buf.readUInt32LE(o + 12);
    // Paleta sem dados = copia de outra que veio antes.
    palettes.push(length === 0
      ? palettes[link]
      : buf.subarray(ldataOffset + offset, ldataOffset + offset + length));
  }

  const sprites = [];
  const byId = new Map();
  for (let i = 0; i < spriteCount; i++) {
    const o = spriteOffset + i * 28;
    const sprite = {
      group: buf.readUInt16LE(o),
      item: buf.readUInt16LE(o + 2),
      width: buf.readUInt16LE(o + 4),
      height: buf.readUInt16LE(o + 6),
      axisX: buf.readInt16LE(o + 8),
      axisY: buf.readInt16LE(o + 10),
      link: buf.readUInt16LE(o + 12),
      format: buf[o + 14],
      length: buf.readUInt32LE(o + 20),
      palette: buf.readUInt16LE(o + 24),
      start: (buf.readUInt16LE(o + 26) ? tdataOffset : ldataOffset)
        + buf.readUInt32LE(o + 16),
    };
    sprites.push(sprite);
    // Se houver repetidos, o MUGEN fica com o primeiro.
    const id = `${sprite.group},${sprite.item}`;
    if (!byId.has(id)) byId.set(id, sprite);
  }

  /**
   * Pixels do sprite em RGBA. `paletteId` ("grupo,numero") pinta-o com
   * outra paleta do ficheiro em vez da dele: e como o MUGEN muda a cor de um
   * efeito sem ter outro sprite.
   */
  function render(sprite, paletteId = null) {
    let source = sprite;
    // Sprite sem dados = copia de outro; a geometria e a do proprio.
    while (source.length === 0) source = sprites[source.link];

    const { width, height } = sprite;
    const size = width * height;
    // Os primeiros 4 bytes sao o tamanho depois de descomprimido.
    const data = buf.subarray(source.start + 4, source.start + source.length);
    const rgba = new Uint8Array(size * 4);

    let indices;
    switch (source.format) {
      case 0: indices = buf.subarray(source.start, source.start + size); break;
      case 2: indices = rle8Decode(data, size); break;
      case 4: indices = lz5Decode(data, size); break;
      case 10: case 11: case 12: {
        const png = decodePng(data);
        if (png.colorType === 3) { indices = png.data; break; }
        if (png.channels < 3) throw new Error('PNG em tons de cinzento nao suportado');
        for (let p = 0; p < size; p++) {
          rgba[p * 4] = png.data[p * png.channels];
          rgba[p * 4 + 1] = png.data[p * png.channels + 1];
          rgba[p * 4 + 2] = png.data[p * png.channels + 2];
          rgba[p * 4 + 3] = png.channels === 4 ? png.data[p * 4 + 3] : 255;
        }
        return rgba;
      }
      default:
        throw new Error(
          `sprite ${sprite.group},${sprite.item}: formato ${source.format} nao suportado`,
        );
    }

    if (paletteId !== null && !paletteIds.has(paletteId)) {
      throw new Error(`paleta ${paletteId} nao existe no .sff`);
    }
    const palette = palettes[paletteId === null ? source.palette : paletteIds.get(paletteId)];
    for (let p = 0; p < size; p++) {
      const index = indices[p];
      // A cor 0 da paleta e sempre a transparente.
      if (index === 0) continue;
      rgba[p * 4] = palette[index * 4];
      rgba[p * 4 + 1] = palette[index * 4 + 1];
      rgba[p * 4 + 2] = palette[index * 4 + 2];
      rgba[p * 4 + 3] = 255;
    }
    return rgba;
  }

  return { sprites, byId, render };
}

// ---------------------------------------------------------------- AIR

/**
 * Todas as accoes de um .air, por numero. Cada uma tem os frames (sprite,
 * deslocamento, duracao em ticks, espelhamento, mistura e caixas de colisao)
 * e o frame para onde volta ao repetir, marcado no ficheiro com "Loopstart".
 *
 * clsn1 sao as caixas de ataque, clsn2 as do corpo; cada caixa e
 * [x1, y1, x2, y2] em relacao ao eixo do personagem.
 */
export function parseAir(text) {
  const actions = new Map();
  let action = null;
  // "ClsnNDefault" vale para todos os frames que se seguem na accao;
  // "ClsnN" so para o proximo. `open` e a lista que esta a ser preenchida.
  let defaults = {};
  let pending = {};
  let open = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split(';')[0].trim();
    const header = line.match(/^\[\s*begin\s+action\s+(-?\d+)\s*\]/i);

    if (header) {
      const number = Number(header[1]);
      action = { frames: [], loopStart: 0 };
      // Se houver numeros repetidos, o MUGEN fica com a primeira.
      if (!actions.has(number)) actions.set(number, action);
      defaults = {};
      pending = {};
      open = {};
      continue;
    }
    if (!action) continue;

    if (/^loopstart/i.test(line)) {
      action.loopStart = action.frames.length;
      continue;
    }

    const declaration = line.match(/^clsn([12])(default)?\s*:/i);
    if (declaration) {
      const kind = declaration[1];
      open[kind] = [];
      if (declaration[2]) defaults[kind] = open[kind];
      else pending[kind] = open[kind];
      continue;
    }

    const box = line.match(/^clsn([12])\s*\[\s*\d+\s*\]\s*=\s*(.+)$/i);
    if (box) {
      open[box[1]]?.push(box[2].split(',').map(Number));
      continue;
    }

    const fields = line.split(',').map((field) => field.trim());
    if (fields.length < 5 || !/^-?\d+$/.test(fields[0])) continue;

    action.frames.push({
      group: Number(fields[0]),
      item: Number(fields[1]),
      x: Number(fields[2]),
      y: Number(fields[3]),
      time: Number(fields[4]),
      flip: (fields[5] ?? '').toUpperCase(),
      blend: (fields[6] ?? '').toUpperCase(),
      // Ampliacao e rotacao proprias do frame (MUGEN 1.1).
      scale: fields[7] ? [Number(fields[7]), Number(fields[8] ?? fields[7])] : null,
      angle: fields[9] ? Number(fields[9]) : 0,
      clsn1: pending[1] ?? defaults[1] ?? [],
      clsn2: pending[2] ?? defaults[2] ?? [],
    });
    pending = {};
  }

  return actions;
}

// ---------------------------------------------------------------- SND

/** Os sons de um .snd. Cada um ja e um ficheiro WAV completo la dentro. */
export function parseSnd(buf) {
  if (buf.toString('ascii', 0, 11) !== 'ElecbyteSnd') throw new Error('nao e um SND');

  const sounds = [];
  const count = buf.readUInt32LE(16);
  let offset = buf.readUInt32LE(20);

  for (let i = 0; i < count && offset > 0 && offset < buf.length; i++) {
    const next = buf.readUInt32LE(offset);
    const length = buf.readUInt32LE(offset + 4);
    sounds.push({
      group: buf.readUInt32LE(offset + 8),
      item: buf.readUInt32LE(offset + 12),
      data: buf.subarray(offset + 16, offset + 16 + length),
    });
    offset = next;
  }

  return sounds;
}
