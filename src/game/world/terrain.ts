/**
 * Martian terrain generation.
 *
 * Two layers live here:
 *
 *  1. `TerrainGenerator` - a continuous height/material function of world
 *     coordinates. The renderer samples it at whatever resolution the current
 *     quality tier asks for, so terrain detail scales without regenerating
 *     gameplay data.
 *
 *  2. `TerrainData` - the discrete per-tile grid the simulation actually plays
 *     on: height, slope, surface type, buildability and mineral deposits,
 *     stored in typed arrays so a whole region costs a few hundred kilobytes.
 *
 * Terrain is permanent - the player cannot reshape it, so the layout of cliffs,
 * ice and deposits is the core spatial puzzle of every colony.
 */

import { Noise2D, clamp01, smoothstep } from '../core/noise';
import { Random, deriveSeed } from '../core/rng';
import {
  MAX_BUILDABLE_SLOPE,
  REGION_TILES,
  TILE_SIZE,
  VALLEY_CREST_RADIUS,
  VALLEY_FLOOR_RADIUS,
  VALLEY_RIM_HEIGHT,
  WORLD_HALF,
} from '../core/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export enum TerrainKind {
  /** Flat regolith - the default, ideal building ground. */
  Plain = 0,
  /** Fine wind-blown dust drifts. Buildable but slightly slower to build on. */
  Dust = 1,
  /** Broken rocky ground and boulder fields. Buildable, costs extra concrete. */
  Rock = 2,
  /** Steep slopes and escarpment walls. Never buildable. */
  Cliff = 3,
  /** Subsurface water ice exposed at the surface. Water extractors go here. */
  Ice = 4,
  /** Ancient basalt flows. Never buildable, but rich in metals nearby. */
  Lava = 5,
}

export enum DepositKind {
  None = 0,
  Iron = 1,
  Aluminium = 2,
  Silicon = 3,
  Carbon = 4,
  RareMinerals = 5,
}

export const TERRAIN_LABELS: Record<TerrainKind, string> = {
  [TerrainKind.Plain]: 'Regolith Plain',
  [TerrainKind.Dust]: 'Dust Drift',
  [TerrainKind.Rock]: 'Rocky Ground',
  [TerrainKind.Cliff]: 'Cliff Face',
  [TerrainKind.Ice]: 'Ice Field',
  [TerrainKind.Lava]: 'Basalt Flow',
};

export const DEPOSIT_LABELS: Record<DepositKind, string> = {
  [DepositKind.None]: 'None',
  [DepositKind.Iron]: 'Iron Oxide',
  [DepositKind.Aluminium]: 'Aluminium Clay',
  [DepositKind.Silicon]: 'Silica Sand',
  [DepositKind.Carbon]: 'Carbonate',
  [DepositKind.RareMinerals]: 'Rare Minerals',
};

/** Smoothly varying surface-material weights, consumed by the terrain shader. */
export interface SurfaceBlend {
  dust: number;
  rock: number;
  ice: number;
  lava: number;
  /** How much of the rock weight comes from steepness rather than noise. */
  slopeRock: number;
  /** Fine-grain variation in [0, 1] to break up flat colour. */
  mottle: number;
}

export interface TerrainConfig {
  seed: number;
  /** Tiles per side. */
  size: number;
  /** 0..1 - how mountainous and cliff-riven the site is. */
  ruggedness: number;
  /** 0..1 - how much exposed surface ice. */
  iceAbundance: number;
  /** 0..1 - density and richness of mineral deposits. */
  mineralAbundance: number;
  /** 0..1 - how much of the surface is fine dust rather than firm regolith. */
  dustiness: number;
}

export const DEFAULT_TERRAIN_CONFIG: TerrainConfig = {
  seed: 1,
  size: REGION_TILES,
  ruggedness: 0.5,
  iceAbundance: 0.5,
  mineralAbundance: 0.5,
  dustiness: 0.5,
};

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

/** World-space X/Z of the centre of a tile. */
export function tileToWorld(tx: number, tz: number): [number, number] {
  return [(tx + 0.5) * TILE_SIZE - WORLD_HALF, (tz + 0.5) * TILE_SIZE - WORLD_HALF];
}

/** Tile containing a world-space point (may be outside the region). */
export function worldToTile(x: number, z: number): [number, number] {
  return [Math.floor((x + WORLD_HALF) / TILE_SIZE), Math.floor((z + WORLD_HALF) / TILE_SIZE)];
}

// ---------------------------------------------------------------------------
// Continuous generator
// ---------------------------------------------------------------------------

export class TerrainGenerator {
  readonly config: TerrainConfig;

  private base: Noise2D;
  private warp: Noise2D;
  private mountain: Noise2D;
  private mesa: Noise2D;
  private detail: Noise2D;
  private iceField: Noise2D;
  private lavaField: Noise2D;
  private dustField: Noise2D;
  private rockField: Noise2D;
  private oreField: Noise2D;
  private oreType: Noise2D;

  /** Seeded crater, placed off-centre so the starting plot is never inside it. */
  private crater: { x: number; z: number; radius: number; depth: number };

  constructor(config: Partial<TerrainConfig> = {}) {
    this.config = { ...DEFAULT_TERRAIN_CONFIG, ...config };
    const s = this.config.seed;

    this.base = new Noise2D(deriveSeed(s, 'base'));
    this.warp = new Noise2D(deriveSeed(s, 'warp'));
    this.mountain = new Noise2D(deriveSeed(s, 'mountain'));
    this.mesa = new Noise2D(deriveSeed(s, 'mesa'));
    this.detail = new Noise2D(deriveSeed(s, 'detail'));
    this.iceField = new Noise2D(deriveSeed(s, 'ice'));
    this.lavaField = new Noise2D(deriveSeed(s, 'lava'));
    this.dustField = new Noise2D(deriveSeed(s, 'dust'));
    this.rockField = new Noise2D(deriveSeed(s, 'rock'));
    this.oreField = new Noise2D(deriveSeed(s, 'ore'));
    this.oreType = new Noise2D(deriveSeed(s, 'oreType'));

    const rand = new Random(deriveSeed(s, 'crater'));
    const angle = rand.range(0, Math.PI * 2);
    const dist = rand.range(WORLD_HALF * 0.45, WORLD_HALF * 0.8);
    this.crater = {
      x: Math.cos(angle) * dist,
      z: Math.sin(angle) * dist,
      radius: rand.range(WORLD_HALF * 0.18, WORLD_HALF * 0.3),
      depth: rand.range(4, 9),
    };
  }

  /**
   * The radius of the crater floor and crest at a given bearing.
   *
   * Both are modulated by noise sampled on the unit circle, which is periodic
   * in the angle by construction - so the rim is irregular like a real impact
   * structure, with no seam where the bearing wraps past pi.
   */
  private rimProfile(angle: number): { floorRadius: number; crestRadius: number } {
    const variation = this.mountain.noise(Math.cos(angle) * 1.8, Math.sin(angle) * 1.8);
    const secondary = this.mesa.noise(Math.cos(angle) * 3.4 + 9.1, Math.sin(angle) * 3.4 - 4.3);
    return {
      floorRadius: VALLEY_FLOOR_RADIUS + variation * 5 + secondary * 2.5,
      crestRadius: VALLEY_CREST_RADIUS + variation * 11 + secondary * 4,
    };
  }

  /** Height in world units at a world-space X/Z. */
  heightAt(x: number, z: number): number {
    const { ruggedness } = this.config;

    const radius = Math.hypot(x, z);
    const angle = Math.atan2(z, x);
    const { floorRadius, crestRadius } = this.rimProfile(angle);

    const nx = x * 0.01;
    const nz = z * 0.01;

    // Domain warp breaks up the grid-aligned look of raw fBm.
    const wx = nx + 0.35 * this.warp.noise(nx * 0.6 + 11.3, nz * 0.6 - 4.1);
    const wz = nz + 0.35 * this.warp.noise(nx * 0.6 - 7.7, nz * 0.6 + 2.9);

    // --- Crater floor -----------------------------------------------------
    // Gently rolling, and the buildable majority of the playable area.
    let h = this.base.fbm(wx, wz, 4) * (1.5 + ruggedness * 0.9);

    // Low mesas and benches for visual interest, kept shallow enough that they
    // rarely cost the player buildable ground.
    const mesaField = this.mesa.fbm(wx * 0.75 + 31.2, wz * 0.75 - 17.5, 3);
    h += smoothstep(0.19, 0.36, mesaField) * (2.6 + ruggedness * 2.4);

    // Real craters are dished. A gentle bowl toward the middle also draws the
    // eye to the colony and makes the rim read as taller than it is.
    h -= smoothstep(crestRadius, 0, radius) * 2.2;

    // A small secondary impact somewhere on the floor, for character.
    const cd = Math.hypot(x - this.crater.x, z - this.crater.z) / this.crater.radius;
    if (cd < 1.6) {
      const bowl = -this.crater.depth * 0.45 * (1 - smoothstep(0, 1, cd));
      const rim = this.crater.depth * 0.28 * Math.exp(-((cd - 1.02) ** 2) / 0.02);
      h += bowl + rim;
    }

    // --- Crater wall ------------------------------------------------------
    // The boundary of the playable world. Deliberately far too steep to build
    // on or drive up.
    const wall = smoothstep(floorRadius, crestRadius, radius);
    const craggy = this.mountain.ridged(wx * 2.4, wz * 2.4, 3);
    h += wall * (VALLEY_RIM_HEIGHT + craggy * (6 + ruggedness * 10));
    // Buttresses and gullies, strongest halfway up the slope.
    h += wall * (1 - wall) * 4 * this.mountain.noise(wx * 3.1 - 12.4, wz * 3.1 + 6.8);

    // --- Outer highlands --------------------------------------------------
    // Terrain continues past the rim to the horizon. None of it is reachable,
    // but without it the world reads as a floating tile rather than a planet.
    const outer = smoothstep(crestRadius, crestRadius + 70, radius);
    h -= outer * 13;
    const distantRidge = this.mountain.ridged(wx * 0.85 - 3.3, wz * 0.85 + 7.1, 3);
    h += outer * distantRidge * distantRidge * (26 + ruggedness * 34);
    // Far mountains on the skyline.
    const far = smoothstep(crestRadius + 140, crestRadius + 520, radius);
    h += far * this.mountain.ridged(wx * 0.22 + 44.1, wz * 0.22 - 21.6, 3) * 150;

    // --- Surface detail ---------------------------------------------------
    // Applied everywhere so no part of the ground is ever visually bare.
    h += this.detail.fbm(x * 0.09, z * 0.09, 3) * 0.28;
    h += this.detail.billow(x * 0.035 + 4.4, z * 0.035 - 2.1, 2) * this.config.dustiness * 0.5;
    // Wind-blown ripples - the corrugated texture that covers most of Mars.
    h += Math.sin(x * 0.55 + this.detail.noise(x * 0.02, z * 0.02) * 6) * 0.06 * this.config.dustiness;

    return h;
  }

  /**
   * Approximate surface gradient magnitude, where ~1 is a 45-degree wall.
   *
   * Sampled a full tile either side on purpose. Buildability is a question
   * about whether a structure's footprint can sit here, so the gradient that
   * matters is the one across a tile - measuring finer would reject ground that
   * is merely gravelly.
   */
  slopeAt(x: number, z: number, epsilon = TILE_SIZE): number {
    const hL = this.heightAt(x - epsilon, z);
    const hR = this.heightAt(x + epsilon, z);
    const hD = this.heightAt(x, z - epsilon);
    const hU = this.heightAt(x, z + epsilon);
    const dx = (hR - hL) / (2 * epsilon);
    const dz = (hU - hD) / (2 * epsilon);
    return Math.hypot(dx, dz);
  }

  /** Upward surface normal, used for aligning scattered props to the ground. */
  normalAt(x: number, z: number, epsilon = TILE_SIZE * 0.5): [number, number, number] {
    const hL = this.heightAt(x - epsilon, z);
    const hR = this.heightAt(x + epsilon, z);
    const hD = this.heightAt(x, z - epsilon);
    const hU = this.heightAt(x, z + epsilon);
    const nx = hL - hR;
    const nz = hD - hU;
    const ny = 2 * epsilon;
    const len = Math.hypot(nx, ny, nz) || 1;
    return [nx / len, ny / len, nz / len];
  }

  /** Surface classification at a point, independent of the tile grid. */
  kindAt(x: number, z: number, height: number, slope: number): TerrainKind {
    if (slope > MAX_BUILDABLE_SLOPE) return TerrainKind.Cliff;

    const lava = this.lavaField.noise01(x * 0.012 - 21.7, z * 0.012 + 13.4);
    if (lava > 0.86) return TerrainKind.Lava;

    // Ice survives in shaded lows, so bias it toward depressions. The bias is
    // gentle: the crater floor is by definition the lowest ground for
    // kilometres, and a stronger weighting buried the entire colony site in
    // ice, which removed the whole problem of having to go and find water.
    const iceRaw = this.iceField.noise01(x * 0.016 + 5.1, z * 0.016 - 9.6);
    const lowland = smoothstep(2.5, -3.5, height);
    const iceScore = iceRaw * (0.62 + lowland * 0.3) + this.config.iceAbundance * 0.16;
    if (iceScore > 0.78) return TerrainKind.Ice;

    const rock = this.rockField.noise01(x * 0.03 + 44.2, z * 0.03 - 31.8);
    if (rock > 0.70 || slope > MAX_BUILDABLE_SLOPE * 0.62) return TerrainKind.Rock;

    const dust = this.dustField.noise01(x * 0.014 - 3.3, z * 0.014 + 7.7);
    if (dust > 0.74 - this.config.dustiness * 0.24) return TerrainKind.Dust;

    return TerrainKind.Plain;
  }

  /**
   * Continuous surface-material weights at a point.
   *
   * `kindAt` returns one discrete class per tile, which is what the simulation
   * needs but would paint the ground in hard blocks. The renderer instead asks
   * for smoothly varying weights and blends colours between them, so an ice
   * field fades into regolith the way it would in an orbital photo.
   */
  surfaceBlendAt(x: number, z: number, height: number, slope: number): SurfaceBlend {
    const lava = smoothstep(0.78, 0.92, this.lavaField.noise01(x * 0.012 - 21.7, z * 0.012 + 13.4));

    const iceRaw = this.iceField.noise01(x * 0.016 + 5.1, z * 0.016 - 9.6);
    const lowland = smoothstep(2.5, -3.5, height);
    const iceScore = iceRaw * (0.62 + lowland * 0.3) + this.config.iceAbundance * 0.16;
    const ice = smoothstep(0.70, 0.84, iceScore);

    const rockField = smoothstep(0.6, 0.78, this.rockField.noise01(x * 0.03 + 44.2, z * 0.03 - 31.8));
    const slopeRock = smoothstep(MAX_BUILDABLE_SLOPE * 0.5, MAX_BUILDABLE_SLOPE * 1.3, slope);
    const rock = clamp01(Math.max(rockField, slopeRock));

    const dustRaw = this.dustField.noise01(x * 0.014 - 3.3, z * 0.014 + 7.7);
    const dustEdge = 0.68 - this.config.dustiness * 0.22;
    const dust = smoothstep(dustEdge, dustEdge + 0.14, dustRaw) * (1 - slopeRock);

    // Fine grain so flat ground is never a single flat colour.
    const mottle = this.detail.fbm(x * 0.22, z * 0.22, 3) * 0.5 + 0.5;

    return { dust, rock, ice, lava, slopeRock, mottle };
  }

  /**
   * Very low-frequency regional tint, -1 (basaltic grey) to +1 (ochre dust).
   *
   * Orbital imagery of Mars shows enormous fields of dark basaltic sand sitting
   * against bright iron-oxide dust, on a scale of hundreds of kilometres. A
   * single uniform rust colour is the main thing that makes a rendered Mars
   * read as fake, so the shading samples this and pushes the hue either way.
   */
  regionTintAt(x: number, z: number): number {
    return this.mesa.noise(x * 0.0035 - 61.2, z * 0.0035 + 27.8);
  }

  /** Mineral deposit at a point, or `None`. */
  depositAt(x: number, z: number, kind: TerrainKind): { kind: DepositKind; richness: number } {
    if (kind === TerrainKind.Cliff) return { kind: DepositKind.None, richness: 0 };

    const field = this.oreField.noise01(x * 0.022 + 61.5, z * 0.022 - 47.3);
    const threshold = 0.78 - this.config.mineralAbundance * 0.14;
    if (field < threshold) return { kind: DepositKind.None, richness: 0 };

    const richness = clamp01((field - threshold) / (1 - threshold));

    // A second field decides which mineral a deposit contains, so ores form
    // coherent bands rather than salt-and-pepper noise.
    const t = this.oreType.noise01(x * 0.01 - 88.1, z * 0.01 + 52.9);
    let deposit: DepositKind;
    if (kind === TerrainKind.Lava) {
      deposit = t > 0.5 ? DepositKind.Iron : DepositKind.Aluminium;
    } else if (t < 0.34) {
      deposit = DepositKind.Iron;
    } else if (t < 0.58) {
      deposit = DepositKind.Silicon;
    } else if (t < 0.78) {
      deposit = DepositKind.Aluminium;
    } else if (t < 0.93) {
      deposit = DepositKind.Carbon;
    } else {
      deposit = DepositKind.RareMinerals;
    }

    return { kind: deposit, richness };
  }
}

// ---------------------------------------------------------------------------
// Discrete tile grid
// ---------------------------------------------------------------------------

export interface TerrainData {
  size: number;
  seed: number;
  config: TerrainConfig;
  generator: TerrainGenerator;
  /** Height at each tile centre. */
  height: Float32Array;
  /** Gradient magnitude at each tile centre. */
  slope: Float32Array;
  kind: Uint8Array;
  deposit: Uint8Array;
  depositRichness: Float32Array;
  /** 1 if terrain permits construction (before checking occupancy). */
  buildable: Uint8Array;
  /** Cached extents, useful for framing the camera. */
  minHeight: number;
  maxHeight: number;
}

export function generateTerrain(config: Partial<TerrainConfig> = {}): TerrainData {
  const generator = new TerrainGenerator(config);
  const { size } = generator.config;
  const count = size * size;

  const height = new Float32Array(count);
  const slope = new Float32Array(count);
  const kind = new Uint8Array(count);
  const deposit = new Uint8Array(count);
  const depositRichness = new Float32Array(count);
  const buildable = new Uint8Array(count);

  let minHeight = Infinity;
  let maxHeight = -Infinity;

  for (let tz = 0; tz < size; tz++) {
    for (let tx = 0; tx < size; tx++) {
      const i = tz * size + tx;
      const [wx, wz] = tileToWorld(tx, tz);

      const h = generator.heightAt(wx, wz);
      const s = generator.slopeAt(wx, wz);
      const k = generator.kindAt(wx, wz, h, s);
      const d = generator.depositAt(wx, wz, k);

      height[i] = h;
      slope[i] = s;
      kind[i] = k;
      deposit[i] = d.kind;
      depositRichness[i] = d.richness;
      buildable[i] = k === TerrainKind.Cliff || k === TerrainKind.Lava ? 0 : 1;

      if (h < minHeight) minHeight = h;
      if (h > maxHeight) maxHeight = h;
    }
  }

  return {
    size,
    seed: generator.config.seed,
    config: generator.config,
    generator,
    height,
    slope,
    kind,
    deposit,
    depositRichness,
    buildable,
    minHeight,
    maxHeight,
  };
}

/** Bounds-checked tile index, or -1 when outside the region. */
export function tileIndex(data: TerrainData, tx: number, tz: number): number {
  if (tx < 0 || tz < 0 || tx >= data.size || tz >= data.size) return -1;
  return tz * data.size + tx;
}

export function isInsideRegion(data: TerrainData, tx: number, tz: number): boolean {
  return tx >= 0 && tz >= 0 && tx < data.size && tz < data.size;
}

/**
 * Statistics for a candidate landing site, used to describe the trade-offs of
 * each option on the new-game screen.
 */
export interface SiteSurvey {
  buildableFraction: number;
  iceFraction: number;
  flatFraction: number;
  depositCounts: Record<DepositKind, number>;
  /**
   * The same measures restricted to the crater floor.
   *
   * Once the world became a valley, whole-grid percentages stopped meaning
   * anything - most of the grid's corners are crater wall by design, so a high
   * "cliff" share is the boundary doing its job rather than a balance problem.
   * These are the numbers that actually describe whether a site is playable.
   */
  valley: {
    tiles: number;
    buildableFraction: number;
    flatFraction: number;
    iceFraction: number;
    depositTiles: number;
  };
}

export function surveySite(data: TerrainData): SiteSurvey {
  const depositCounts: Record<DepositKind, number> = {
    [DepositKind.None]: 0,
    [DepositKind.Iron]: 0,
    [DepositKind.Aluminium]: 0,
    [DepositKind.Silicon]: 0,
    [DepositKind.Carbon]: 0,
    [DepositKind.RareMinerals]: 0,
  };

  let buildableTiles = 0;
  let iceTiles = 0;
  let flatTiles = 0;

  let valleyTiles = 0;
  let valleyBuildable = 0;
  let valleyFlat = 0;
  let valleyIce = 0;
  let valleyDeposits = 0;

  const total = data.size * data.size;
  for (let tz = 0; tz < data.size; tz++) {
    for (let tx = 0; tx < data.size; tx++) {
      const i = tz * data.size + tx;

      const buildable = data.buildable[i] === 1;
      const isIce = data.kind[i] === TerrainKind.Ice;
      const isFlat = data.slope[i] < MAX_BUILDABLE_SLOPE * 0.35;

      if (buildable) buildableTiles++;
      if (isIce) iceTiles++;
      if (isFlat) flatTiles++;
      depositCounts[data.deposit[i] as DepositKind]++;

      const [wx, wz] = tileToWorld(tx, tz);
      if (Math.hypot(wx, wz) <= VALLEY_FLOOR_RADIUS) {
        valleyTiles++;
        if (buildable) valleyBuildable++;
        if (isFlat) valleyFlat++;
        if (isIce) valleyIce++;
        if (data.deposit[i] !== DepositKind.None) valleyDeposits++;
      }
    }
  }

  return {
    buildableFraction: buildableTiles / total,
    iceFraction: iceTiles / total,
    flatFraction: flatTiles / total,
    depositCounts,
    valley: {
      tiles: valleyTiles,
      buildableFraction: valleyTiles > 0 ? valleyBuildable / valleyTiles : 0,
      flatFraction: valleyTiles > 0 ? valleyFlat / valleyTiles : 0,
      iceFraction: valleyTiles > 0 ? valleyIce / valleyTiles : 0,
      depositTiles: valleyDeposits,
    },
  };
}
