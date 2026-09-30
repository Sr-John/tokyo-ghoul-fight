/**
 * Leitura e escrita de PNG sem dependencias, so com o zlib do Node.
 * Partilhado pelos conversores desta pasta.
 */
import zlib from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bits por canal
  ihdr[9] = 6;   // RGBA
  ihdr[10] = 0;  // compressao
  ihdr[11] = 0;  // filtro
  ihdr[12] = 0;  // sem entrelacamento

  // Cada linha leva um byte de filtro a zero (sem filtro).
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4)
      .copy(raw, y * (width * 4 + 1) + 1);
  }

  return Buffer.concat([
    SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Canais por pixel para cada tipo de cor do PNG. */
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/**
 * Descodifica um PNG sem o converter para RGBA: devolve os canais tal como
 * estao no ficheiro, um byte por amostra. Num PNG de paleta (colorType 3)
 * isso sao os indices, que e o que os sprites do MUGEN precisam.
 */
export function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('nao e um PNG');

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];

  for (let i = 8; i < buf.length;) {
    const length = buf.readUInt32BE(i);
    const type = buf.toString('ascii', i + 4, i + 8);
    const data = buf.subarray(i + 8, i + 8 + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error('PNG entrelacado nao suportado');
      if (bitDepth > 8) throw new Error('PNG de 16 bits nao suportado');
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }

    i += 12 + length;
  }

  const channels = CHANNELS[colorType];
  const bpp = Math.max(1, (channels * bitDepth) >> 3);
  const stride = Math.ceil((width * channels * bitDepth) / 8);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const lines = new Uint8Array(stride * height);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;

    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? lines[dst + x - bpp] : 0;
      const b = y > 0 ? lines[dst + x - stride] : 0;
      const c = x >= bpp && y > 0 ? lines[dst + x - stride - bpp] : 0;

      let value = raw[src + x];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) value += paeth(a, b, c);

      lines[dst + x] = value;
    }
  }

  if (bitDepth === 8) return { width, height, colorType, channels, data: lines };

  // Menos de 8 bits por amostra: desempacota para um byte por amostra.
  const data = new Uint8Array(width * height * channels);
  const perLine = width * channels;
  const mask = (1 << bitDepth) - 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < perLine; x++) {
      const bit = x * bitDepth;
      const byte = lines[y * stride + (bit >> 3)];
      data[y * perLine + x] = (byte >> (8 - bitDepth - (bit & 7))) & mask;
    }
  }

  return { width, height, colorType, channels, data };
}
