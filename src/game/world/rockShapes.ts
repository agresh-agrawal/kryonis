/**
 * Rock geometry.
 *
 * The previous scatter drew every rock in the world from a single icosahedron
 * that had been jittered once at load. Thousands of instances of one blob, all
 * with the same silhouette, is exactly why they read as cheap: the eye picks up
 * the repeat immediately, and a subdivided sphere with slightly wobbled
 * vertices is a potato, not a stone.
 *
 * Real rock is not lumpy - it is *fractured*. Stone breaks along flat cleavage
 * planes, which is why a broken rock has sharp edges and flat faces meeting at
 * angles. Reproducing that is what makes these read as geology instead of as
 * low-poly filler, and it costs nothing at runtime because it happens once at
 * load.
 *
 * Each shape therefore gets:
 *
 *   1. Multi-octave noise displacement, for the large-scale mass.
 *   2. A handful of random planar cuts - vertices outside a plane are pushed
 *      back onto it, which slices a genuine flat facet.
 *   3. A per-variant character (angular shard, flat slab, weathered boulder) so
 *      the population has real variety rather than one shape at many scales.
 *
 * Several distinct shapes cost several instanced draw calls instead of one.
 * That is a handful of draw calls for the entire rock population, which is a
 * price worth paying many times over.
 */

import * as THREE from 'three';

import { Random } from '../core/rng';

export type RockCharacter = 'angular' | 'slab' | 'weathered';

export interface RockVariant {
  geometry: THREE.BufferGeometry;
  character: RockCharacter;
}

/** How many distinct shapes are generated per character. */
const VARIANTS_PER_CHARACTER = 2;

interface CharacterProfile {
  /** Icosahedron subdivisions. More detail on the shapes seen largest. */
  detail: number;
  /** Number of planar cuts. More cuts, more facets, sharper stone. */
  cuts: [min: number, max: number];
  /** How far a cut plane sits from the centre; lower slices more away. */
  cutDepth: [min: number, max: number];
  /** Amplitude of the large-scale noise lumps. */
  noise: number;
  /** Non-uniform squash applied at the end, as [x, y, z] ranges. */
  squash: [[number, number], [number, number], [number, number]];
}

const PROFILES: Record<RockCharacter, CharacterProfile> = {
  // Sharp broken shards - the freshest fracture, found on slopes and scree.
  angular: {
    detail: 1,
    cuts: [5, 8],
    cutDepth: [0.5, 0.82],
    noise: 0.16,
    squash: [
      [0.8, 1.25],
      [0.7, 1.15],
      [0.8, 1.25],
    ],
  },
  // Flat plates, as bedrock splits along bedding planes.
  slab: {
    detail: 1,
    cuts: [3, 5],
    cutDepth: [0.42, 0.7],
    noise: 0.12,
    squash: [
      [1.1, 1.5],
      [0.32, 0.5],
      [1.0, 1.4],
    ],
  },
  // Rounded by a few billion years of dust abrasion. Still not spheres.
  weathered: {
    detail: 2,
    cuts: [2, 4],
    cutDepth: [0.72, 0.95],
    noise: 0.26,
    squash: [
      [0.85, 1.2],
      [0.6, 0.95],
      [0.85, 1.2],
    ],
  },
};

/** Cheap 3D value noise. Deterministic for a given seed and position. */
function noise3(x: number, y: number, z: number, seed: number): number {
  const dot = x * 12.9898 + y * 78.233 + z * 37.719 + seed * 3.14159;
  return (Math.sin(dot) * 43758.5453) % 1;
}

function fbm(x: number, y: number, z: number, seed: number, octaves = 3): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let total = 0;

  for (let octave = 0; octave < octaves; octave++) {
    value += noise3(x * frequency, y * frequency, z * frequency, seed + octave) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.1;
  }
  return value / total;
}

/**
 * Builds one rock.
 *
 * The order matters: noise first to establish the mass, then cuts, so the flat
 * faces stay genuinely flat instead of being re-lumped afterwards.
 */
function buildRock(character: RockCharacter, rand: Random): THREE.BufferGeometry {
  const profile = PROFILES[character];
  const geometry = new THREE.IcosahedronGeometry(1, profile.detail);
  const position = geometry.attributes.position as THREE.BufferAttribute;

  const noiseSeed = rand.range(0, 1000);
  const vertex = new THREE.Vector3();

  // --- 1. Large-scale mass ------------------------------------------------
  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    const lump = fbm(vertex.x * 1.5, vertex.y * 1.5, vertex.z * 1.5, noiseSeed);
    vertex.multiplyScalar(1 + (lump - 0.5) * 2 * profile.noise);
    position.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }

  // --- 2. Fracture planes -------------------------------------------------
  const cutCount = Math.round(rand.range(profile.cuts[0], profile.cuts[1]));
  const normal = new THREE.Vector3();

  for (let cut = 0; cut < cutCount; cut++) {
    // A random plane through the rock, at a random distance from centre.
    normal
      .set(rand.range(-1, 1), rand.range(-1, 1), rand.range(-1, 1))
      .normalize();
    const distance = rand.range(profile.cutDepth[0], profile.cutDepth[1]);

    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i);
      const above = vertex.dot(normal) - distance;
      // Everything past the plane is pressed back onto it. Projecting rather
      // than clamping is what leaves a flat face instead of a dented one.
      if (above > 0) {
        vertex.addScaledVector(normal, -above);
        position.setXYZ(i, vertex.x, vertex.y, vertex.z);
      }
    }
  }

  // --- 3. Character squash ------------------------------------------------
  const squash = new THREE.Vector3(
    rand.range(profile.squash[0][0], profile.squash[0][1]),
    rand.range(profile.squash[1][0], profile.squash[1][1]),
    rand.range(profile.squash[2][0], profile.squash[2][1]),
  );

  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    position.setXYZ(i, vertex.x * squash.x, vertex.y * squash.y, vertex.z * squash.z);
  }

  position.needsUpdate = true;

  /*
   * Flat normals, computed after every deformation.
   *
   * Smooth normals would round off the fracture faces in the lighting and undo
   * the entire point of cutting them - the facets have to catch the low Martian
   * sun as distinct planes.
   */
  geometry.deleteAttribute('normal');
  geometry.deleteAttribute('uv');

  // IcosahedronGeometry already arrives non-indexed; calling toNonIndexed on it
  // works but warns once per rock, which is a lot of noise for nothing.
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flat !== geometry) geometry.dispose();
  flat.computeVertexNormals();

  // Re-centre on the base so instances sit on the ground rather than through
  // it, and normalise the radius so the scatter's size ranges mean one thing.
  flat.computeBoundingBox();
  const box = flat.boundingBox!;
  const centreX = (box.min.x + box.max.x) / 2;
  const centreZ = (box.min.z + box.max.z) / 2;
  const height = box.max.y - box.min.y;
  flat.translate(-centreX, -box.min.y - height * 0.5, -centreZ);

  flat.computeBoundingSphere();
  return flat;
}

/**
 * The rock library for a world.
 *
 * Generated once per seed, so the same world always has the same stones - the
 * determinism rule that governs terrain applies here too.
 */
export function buildRockVariants(seed: number): RockVariant[] {
  const rand = new Random(seed);
  const variants: RockVariant[] = [];

  for (const character of Object.keys(PROFILES) as RockCharacter[]) {
    for (let i = 0; i < VARIANTS_PER_CHARACTER; i++) {
      variants.push({ character, geometry: buildRock(character, rand) });
    }
  }

  return variants;
}

export function disposeRockVariants(variants: RockVariant[]): void {
  for (const variant of variants) variant.geometry.dispose();
}
