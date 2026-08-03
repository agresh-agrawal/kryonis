'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { PALETTE, VALLEY_CREST_RADIUS } from '../core/constants';
import { Random, deriveSeed } from '../core/rng';
import type { QualitySettings } from '../core/quality';
import { createRegolithNormalMap } from '../render/textures';
import { buildRockVariants, disposeRockVariants, type RockCharacter } from './rockShapes';
import { TerrainKind, type TerrainData, tileIndex, worldToTile } from './terrain';

/** Rocks are scattered out to just past the crater rim; beyond that, fog. */
const SCATTER_RADIUS = VALLEY_CREST_RADIUS + 30;

interface ScatterLayer {
  /** Fraction of the total instance budget this layer receives. */
  share: number;
  minSize: number;
  maxSize: number;
  /** Rocks per unit area relative to the base distribution. */
  biasToSlopes: number;
  /** Which rock characters can appear in this layer. */
  characters: RockCharacter[];
}

/**
 * Three size classes rather than two, each drawn from different stone.
 *
 * The size classes are not just the same rock scaled: big weathered boulders,
 * mid-size broken shards and a carpet of small chips are genuinely different
 * shapes, because that is how a real debris field grades. The small layer is
 * what stops the ground reading as a bare shaded surface.
 */
const LAYERS: ScatterLayer[] = [
  {
    share: 0.14,
    minSize: 0.9,
    maxSize: 2.1,
    biasToSlopes: 1,
    characters: ['weathered', 'slab'],
  },
  {
    share: 0.3,
    minSize: 0.35,
    maxSize: 0.9,
    biasToSlopes: 0.8,
    characters: ['angular', 'weathered', 'slab'],
  },
  {
    share: 0.56,
    minSize: 0.09,
    maxSize: 0.34,
    biasToSlopes: 0.35,
    characters: ['angular', 'slab'],
  },
];

interface Placement {
  matrix: THREE.Matrix4;
  color: THREE.Color;
}

/**
 * Scattered rocks and boulders.
 *
 * Rejection-sampled across the crater floor and walls, then drawn as one
 * instanced mesh per distinct shape - a handful of draw calls for thousands of
 * stones. They exist purely for scale and surface texture; nothing in the
 * simulation reads them.
 */
export function Boulders({
  terrain,
  quality,
}: {
  terrain: TerrainData;
  quality: QualitySettings;
}) {
  const variants = useMemo(
    () => buildRockVariants(deriveSeed(terrain.seed, 'rockShapes')),
    [terrain.seed],
  );
  useEffect(() => () => disposeRockVariants(variants), [variants]);

  /*
   * One shared surface for every rock.
   *
   * The scatter used to have no map at all - a flat-shaded solid colour, which
   * is most of why the stones looked like plastic. A single tiling normal map
   * gives the facets grain without a colour texture and without a second
   * sampler beyond it.
   */
  const normalMap = useMemo(() => {
    const map = createRegolithNormalMap(256, deriveSeed(terrain.seed, 'rockNormal'), 1.9);
    map.repeat.set(1.6, 1.6);
    return map;
  }, [terrain.seed]);
  useEffect(() => () => normalMap.dispose(), [normalMap]);

  // Placements, bucketed by which shape they use.
  const buckets = useMemo(() => {
    const rand = new Random(deriveSeed(terrain.seed, 'boulderScatter'));
    const result = variants.map<Placement[]>(() => []);

    const base = new THREE.Color(PALETTE.regolithDark);
    const dark = new THREE.Color(PALETTE.basalt);
    const light = new THREE.Color(PALETTE.regolithMid);

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();

    for (const layer of LAYERS) {
      const target = Math.round(quality.boulderCount * layer.share);
      const eligible = variants
        .map((variant, index) => ({ variant, index }))
        .filter((entry) => layer.characters.includes(entry.variant.character));
      if (eligible.length === 0) continue;

      // Rejection sampling: try a bounded number of candidates and keep the
      // ones that land on terrain where rocks belong.
      const maxAttempts = target * 12;
      let placed = 0;

      for (let attempt = 0; attempt < maxAttempts && placed < target; attempt++) {
        // Uniform over a disc: sqrt keeps density even rather than clustering
        // everything around the origin.
        const radius = Math.sqrt(rand.float()) * SCATTER_RADIUS;
        const angle = rand.range(0, Math.PI * 2);
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        // Terrain classification only exists inside the tile grid. Beyond it -
        // on the crater walls - treat the ground as rocky, which it is.
        const [tx, tz] = worldToTile(x, z);
        const idx = tileIndex(terrain, tx, tz);
        const kind = idx >= 0 ? (terrain.kind[idx] as TerrainKind) : TerrainKind.Rock;

        let chance: number;
        switch (kind) {
          case TerrainKind.Rock:
          case TerrainKind.Cliff:
            chance = 1;
            break;
          case TerrainKind.Lava:
            chance = 0.55;
            break;
          case TerrainKind.Ice:
            chance = 0.08;
            break;
          case TerrainKind.Dust:
            chance = 0.25;
            break;
          default:
            chance = 0.35;
        }
        chance = Math.min(1, chance * layer.biasToSlopes + (1 - layer.biasToSlopes) * 0.55);
        if (!rand.bool(chance)) continue;

        const y = terrain.generator.heightAt(x, z);
        const size = rand.range(layer.minSize, layer.maxSize);

        // Sink each rock partway into the ground so none appear to float.
        position.set(x, y - size * 0.28, z);

        /*
         * Resting orientation, not random orientation.
         *
         * Rocks were previously tumbled through a full random rotation on all
         * three axes, which is what made a field of them read as debris frozen
         * mid-air: a stone that has been lying on Mars for an age has settled
         * onto a face. Free rotation about Y, and only a slight tilt off
         * vertical, is what "resting" looks like.
         */
        euler.set(
          rand.range(-0.22, 0.22),
          rand.range(0, Math.PI * 2),
          rand.range(-0.22, 0.22),
        );
        quaternion.setFromEuler(euler);

        scale.set(
          size * rand.range(0.85, 1.2),
          size * rand.range(0.75, 1.1),
          size * rand.range(0.85, 1.2),
        );

        matrix.compose(position, quaternion, scale);

        const tint = rand.float();
        const color = base.clone().lerp(tint > 0.5 ? light : dark, Math.abs(tint - 0.5) * 1.6);

        const chosen = eligible[Math.floor(rand.float() * eligible.length)];
        result[chosen.index].push({ matrix: matrix.clone(), color });
        placed++;
      }
    }

    return result;
  }, [terrain, quality.boulderCount, variants]);

  return (
    <group name="boulders">
      {variants.map((variant, index) =>
        buckets[index].length > 0 ? (
          <RockInstances
            key={index}
            geometry={variant.geometry}
            placements={buckets[index]}
            normalMap={normalMap}
            quality={quality}
          />
        ) : null,
      )}
    </group>
  );
}

function RockInstances({
  geometry,
  placements,
  normalMap,
  quality,
}: {
  geometry: THREE.BufferGeometry;
  placements: Placement[];
  normalMap: THREE.Texture;
  quality: QualitySettings;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    placements.forEach((placement, i) => {
      mesh.setMatrixAt(i, placement.matrix);
      mesh.setColorAt(i, placement.color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [placements]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, placements.length]}
      castShadow={quality.shadows}
      receiveShadow
      frustumCulled={false}
    >
      <meshStandardMaterial
        roughness={0.92}
        metalness={0.02}
        normalMap={normalMap}
        normalScale={new THREE.Vector2(0.8, 0.8)}
        flatShading
      />
    </instancedMesh>
  );
}
