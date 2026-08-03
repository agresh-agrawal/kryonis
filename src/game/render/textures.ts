/**
 * Procedurally generated textures.
 *
 * The project ships no image assets, so every map here is drawn into a canvas
 * at runtime from periodic value noise. Periodicity matters: these textures are
 * tiled dozens of times across the terrain, and non-tiling noise would show
 * obvious seams.
 */

import * as THREE from 'three';
import { mulberry32 } from '../core/rng';

/**
 * Value noise on a wrapping lattice. Because lattice coordinates are taken
 * modulo `period`, the result tiles exactly every `period` units.
 */
function periodicValueNoise(seed: number) {
  const rand = mulberry32(seed);
  const table = new Float32Array(1024);
  for (let i = 0; i < table.length; i++) table[i] = rand();

  const hash = (x: number, y: number, period: number) => {
    const xi = ((x % period) + period) % period;
    const yi = ((y % period) + period) % period;
    return table[(xi * 73856093 + yi * 19349663) & 1023];
  };

  const fade = (t: number) => t * t * (3 - 2 * t);

  return (x: number, y: number, period: number): number => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = fade(x - x0);
    const fy = fade(y - y0);

    const v00 = hash(x0, y0, period);
    const v10 = hash(x0 + 1, y0, period);
    const v01 = hash(x0, y0 + 1, period);
    const v11 = hash(x0 + 1, y0 + 1, period);

    const a = v00 + (v10 - v00) * fx;
    const b = v01 + (v11 - v01) * fx;
    return a + (b - a) * fy;
  };
}

/** Multi-octave periodic noise sampled over a [0,1] square. */
function periodicFbm(
  noise: (x: number, y: number, period: number) => number,
  u: number,
  v: number,
  basePeriod: number,
  octaves: number,
): number {
  let sum = 0;
  let norm = 0;
  let amplitude = 1;
  let period = basePeriod;
  for (let o = 0; o < octaves; o++) {
    sum += amplitude * noise(u * period, v * period, period);
    norm += amplitude;
    amplitude *= 0.5;
    period *= 2;
  }
  return sum / norm;
}

/**
 * A tiling normal map of fine regolith grain and pebbles. Applied at a high
 * repeat count it gives the ground surface detail that geometry alone would be
 * far too expensive to provide.
 */
export function createRegolithNormalMap(size = 512, seed = 1337, strength = 2.2): THREE.Texture {
  const noise = periodicValueNoise(seed);
  const heights = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      // Broad drifts plus a sharp high-frequency grain.
      const drift = periodicFbm(noise, u, v, 4, 4);
      const grain = periodicFbm(noise, u, v, 32, 3);
      heights[y * size + x] = drift * 0.55 + grain * 0.45;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(size, size);
  const data = image.data;

  const at = (x: number, y: number) => heights[(((y % size) + size) % size) * size + (((x % size) + size) % size)];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Sobel-style central difference gives the surface gradient.
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;

      let nx = -dx;
      let ny = -dy;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;

      const i = (y * size + x) * 4;
      data[i] = (nx * 0.5 + 0.5) * 255;
      data[i + 1] = (ny * 0.5 + 0.5) * 255;
      data[i + 2] = (nz / len) * 255;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * A tiling greyscale roughness/AO-ish map. Slight variation in roughness stops
 * large flat areas from reading as a single plastic sheet under the sun.
 */
export function createRegolithRoughnessMap(size = 256, seed = 4242): THREE.Texture {
  const noise = periodicValueNoise(seed);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(size, size);
  const data = image.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = periodicFbm(noise, x / size, y / size, 8, 4);
      // Keep it in a narrow band near "very rough" - Mars dust is not shiny.
      const value = Math.round((0.78 + n * 0.22) * 255);
      const i = (y * size + x) * 4;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Photovoltaic cell array.
 *
 * A grid of dark cells separated by bright busbars, with a faint blue sheen
 * that varies per cell. Solar panels are one of the most recognisable objects
 * in the colony and read as a flat blue slab without this.
 */
export function createSolarTexture(size = 512): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const rand = mulberry32(90210);

  ctx.fillStyle = '#0d1526';
  ctx.fillRect(0, 0, size, size);

  const cells = 8;
  const cell = size / cells;
  const gap = Math.max(2, cell * 0.055);

  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      // Slight per-cell variation stops the array reading as a printed pattern.
      const tint = 0.82 + rand() * 0.28;
      const r = Math.round(20 * tint);
      const g = Math.round(38 * tint);
      const b = Math.round(74 * tint);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x * cell + gap, y * cell + gap, cell - gap * 2, cell - gap * 2);

      // Fine busbar lines running down each cell.
      ctx.strokeStyle = 'rgba(150,175,210,0.32)';
      ctx.lineWidth = Math.max(1, cell * 0.018);
      for (let bar = 1; bar < 3; bar++) {
        const bx = x * cell + (cell / 3) * bar;
        ctx.beginPath();
        ctx.moveTo(bx, y * cell + gap);
        ctx.lineTo(bx, (y + 1) * cell - gap);
        ctx.stroke();
      }
    }
  }

  // Frame grid between cells.
  ctx.strokeStyle = 'rgba(190,200,215,0.5)';
  ctx.lineWidth = Math.max(1.5, cell * 0.04);
  for (let i = 0; i <= cells; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cell, 0);
    ctx.lineTo(i * cell, size);
    ctx.moveTo(0, i * cell);
    ctx.lineTo(size, i * cell);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Painted hull plating: seams, rivet lines and settled dust.
 *
 * Applied to every white pressure shell. The seams are what give a dome a
 * sense of scale - without them a habitat is an untextured sphere and the eye
 * has nothing to measure it against.
 */
export function createHullTexture(size = 512, seed = 4711): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = mulberry32(seed);
  const noise = periodicValueNoise(seed + 5);

  ctx.fillStyle = '#e8e5de';
  ctx.fillRect(0, 0, size, size);

  // Dust settled from the bottom of every panel upward.
  const grime = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = periodicFbm(noise, x / size, y / size, 6, 4);
      const settle = Math.pow(y / size, 1.6) * 0.55;
      const amount = Math.min(1, n * 0.5 + settle);
      const i = (y * size + x) * 4;
      grime.data[i] = 176;
      grime.data[i + 1] = 132;
      grime.data[i + 2] = 96;
      grime.data[i + 3] = Math.round(amount * 120);
    }
  }
  const layer = document.createElement('canvas');
  layer.width = size;
  layer.height = size;
  layer.getContext('2d')!.putImageData(grime, 0, 0);
  ctx.drawImage(layer, 0, 0);

  // Panel seams.
  const panels = 6;
  const step = size / panels;
  ctx.strokeStyle = 'rgba(120,112,102,0.5)';
  ctx.lineWidth = Math.max(1, size * 0.004);
  for (let i = 1; i < panels; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, size);
    ctx.moveTo(0, i * step);
    ctx.lineTo(size, i * step);
    ctx.stroke();
  }

  // Rivets along the seams.
  ctx.fillStyle = 'rgba(105,98,90,0.55)';
  const rivet = Math.max(1, size * 0.005);
  for (let i = 1; i < panels; i++) {
    for (let t = 0; t < size; t += step / 6) {
      ctx.beginPath();
      ctx.arc(i * step, t + rand() * 3, rivet, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(t + rand() * 3, i * step, rivet, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Cast-regolith concrete: coarse aggregate speckle over a dusty base. */
export function createConcreteTexture(size = 256, seed = 8123): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const noise = periodicValueNoise(seed);

  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const coarse = periodicFbm(noise, x / size, y / size, 4, 3);
      const grain = periodicFbm(noise, x / size, y / size, 26, 2);
      const value = 0.62 + coarse * 0.24 + grain * 0.26;

      const i = (y * size + x) * 4;
      image.data[i] = Math.min(255, 150 * value);
      image.data[i + 1] = Math.min(255, 128 * value);
      image.data[i + 2] = Math.min(255, 108 * value);
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Brushed metal: fine directional streaks for trusses and tanks. */
export function createMetalTexture(size = 256, seed = 3311): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const noise = periodicValueNoise(seed);

  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Stretched sampling gives the streaked look of machined aluminium.
      const streak = periodicFbm(noise, x / size, (y / size) * 0.06, 32, 3);
      const value = 0.78 + streak * 0.3;

      const i = (y * size + x) * 4;
      image.data[i] = Math.min(255, 178 * value);
      image.data[i + 1] = Math.min(255, 184 * value);
      image.data[i + 2] = Math.min(255, 192 * value);
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Soft radial falloff sprite, reused for dust motes and light glows. */
export function createGlowSprite(size = 128): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
