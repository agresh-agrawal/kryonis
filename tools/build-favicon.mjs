/**
 * Generates src/app/favicon.ico.
 *
 * Every other icon in this project is produced at request time by next/og, and
 * for anything declared in <link rel="icon"> that is the right answer. favicon.ico
 * is the exception: it is requested blind, at a fixed path, by clients that never
 * read the document head - link unfurlers, feed readers, crawler fallbacks - so it
 * has to exist as a real file. Next's App Router only serves it from app/favicon.ico
 * as a static asset, which means it must be committed rather than rendered.
 *
 * The mark is rasterised here rather than traced from icon.svg because at 16px a
 * faithful reduction of the logo is mud: the rim stroke lands under a pixel and the
 * three domes merge into one smear. Each size therefore drops detail deliberately -
 * see DETAIL below - which is a judgement a generic SVG rasteriser cannot make.
 *
 * No dependencies: the PNGs are encoded with Node's own zlib and wrapped in an ICO
 * container by hand.
 *
 *   node tools/build-favicon.mjs
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/** Palette shared with icon.svg and src/app/brand.tsx. */
const VOID = [0x12, 0x10, 0x0e];
const RIM = [0xc9, 0x8a, 0x52];
const FLOOR_INNER = [0x8a, 0x5a, 0x38];
const FLOOR_MID = [0x5d, 0x3a, 0x26];
const FLOOR_OUTER = [0x3a, 0x24, 0x1a];
const BONE = [0xe8, 0xe2, 0xd9];
const DOME = [0xcf, 0xc8, 0xbd];

/**
 * Which features survive at which size.
 *
 * At 16px the flanking domes are two pixels across and read as noise next to the
 * lander, so only the lander is kept. The rim also has to be proportionally
 * thicker at small sizes or it disappears into the floor.
 */
const DETAIL = {
  16: { rim: 0.075, domes: false },
  32: { rim: 0.062, domes: true },
  48: { rim: 0.058, domes: true },
};

const SIZES = [16, 32, 48];

/** 4x4 supersampling, which is enough to keep a 16px circle from looking chewed. */
const SUB = 4;

const lerp = (a, b, t) => a + (b - a) * t;

function mixColor(from, to, t) {
  return [lerp(from[0], to[0], t), lerp(from[1], to[1], t), lerp(from[2], to[2], t)];
}

/** The crater floor's radial gradient, matching brand.tsx's `radial-gradient`. */
function floorColor(d) {
  return d < 0.7 ? mixColor(FLOOR_INNER, FLOOR_MID, d / 0.7) : mixColor(FLOOR_MID, FLOOR_OUTER, (d - 0.7) / 0.3);
}

/**
 * Colour of one sub-sample, in icon-relative coordinates where the icon spans
 * 0..1 on both axes. Returns null for "background".
 */
function sample(x, y, detail) {
  const cx = 0.5;
  const cy = 0.5;
  const dist = Math.hypot(x - cx, y - cy);

  const rimOuter = 0.43;
  const rimInner = rimOuter - detail.rim;

  // The lander, offset above centre so the mark has a horizon.
  if (Math.hypot(x - cx, y - (cy - 0.055)) < 0.072) return BONE;

  if (detail.domes) {
    const domeY = cy + 0.075;
    if (Math.hypot(x - (cx - 0.135), y - domeY) < 0.046) return DOME;
    if (Math.hypot(x - (cx + 0.135), y - domeY) < 0.046) return DOME;
  }

  if (dist > rimOuter) return null;
  if (dist > rimInner) return RIM;

  // Gradient origin sits above centre, as it does in the SVG.
  return floorColor(Math.min(1, Math.hypot(x - cx, y - (cy - 0.08)) / rimInner));
}

/**
 * Renders one size to a raw RGBA buffer, supersampled and composited over VOID.
 *
 * The mark is fully opaque - it has its own dark backdrop rather than a
 * transparent one, so it stays legible on a light browser tab - but the buffer
 * still carries an alpha channel. Turbopack decodes app/favicon.ico at build
 * time with a decoder that rejects PNG-in-ICO payloads that are not RGBA, and
 * a build error is a worse outcome than four wasted bytes per pixel on a 4 kB
 * file.
 */
function render(size) {
  const detail = DETAIL[size];
  const rgba = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;

      for (let sy = 0; sy < SUB; sy++) {
        for (let sx = 0; sx < SUB; sx++) {
          const x = (px + (sx + 0.5) / SUB) / size;
          const y = (py + (sy + 0.5) / SUB) / size;
          const c = sample(x, y, detail) ?? VOID;
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }

      const n = SUB * SUB;
      const i = (py * size + px) * 4;
      rgba[i] = Math.round(r / n);
      rgba[i + 1] = Math.round(g / n);
      rgba[i + 2] = Math.round(b / n);
      rgba[i + 3] = 0xff;
    }
  }

  return rgba;
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Encodes a raw RGBA buffer as an 8-bit truecolour-with-alpha PNG. */
function encodePng(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: truecolour with alpha
  // 10..12 stay zero: deflate, adaptive filtering, no interlace.

  // Each scanline is prefixed with its filter type. Filter 0 (none) is fine here
  // because the image is tiny and smooth; deflate does the real work.
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Packs the PNGs into an ICO.
 *
 * ICO entries may hold either a BMP or, since Windows Vista, a PNG. PNG is used
 * because it is a fraction of the size and is understood by every browser and
 * crawler that still asks for this file.
 */
function encodeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = [];

  for (const { size, png } of images) {
    const entry = Buffer.alloc(16);
    entry[0] = size; // 0 would mean 256
    entry[1] = size;
    entry[2] = 0; // palette size: not paletted
    entry[3] = 0; // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

const images = SIZES.map((size) => ({ size, png: encodePng(render(size), size) }));
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'app', 'favicon.ico');

writeFileSync(out, encodeIco(images));

console.log(
  `favicon.ico  ${SIZES.map((s) => `${s}x${s}`).join(' ')}  ` +
    `${(encodeIco(images).length / 1024).toFixed(1)} kB  ->  ${out}`,
);
