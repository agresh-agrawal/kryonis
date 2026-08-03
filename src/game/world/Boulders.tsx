'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { PALETTE, VALLEY_CREST_RADIUS } from '../core/constants';
import { Random, deriveSeed } from '../core/rng';
import type { QualitySettings } from '../core/quality';
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
}

/**
 * Two size classes drawn from one instanced mesh: a sparse population of real
 * boulders, and a dense carpet of small stones. The small layer is what stops
 * the ground reading as a bare shaded surface - real regolith is covered in
 * debris at every scale.
 */
const LAYERS: ScatterLayer[] = [
  { share: 0.3, minSize: 0.45, maxSize: 1.5, biasToSlopes: 1 },
  { share: 0.7, minSize: 0.1, maxSize: 0.4, biasToSlopes: 0.35 },
];

/**
 * Scattered rocks and boulders.
 *
 * Rejection-sampled across the crater floor and walls and drawn as a single
 * instanced mesh, so thousands of them cost one draw call. They exist purely
 * for scale and surface texture - nothing in the simulation reads them.
 */
export function Boulders({
  terrain,
  quality,
}: {
  terrain: TerrainData;
  quality: QualitySettings;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const rand = new Random(deriveSeed(terrain.seed, 'boulderShape'));
    const pos = geo.attributes.position as THREE.BufferAttribute;
    // Push vertices around so rocks read as chipped stone, not spheres.
    for (let i = 0; i < pos.count; i++) {
      const scale = rand.range(0.7, 1.3);
      pos.setXYZ(i, pos.getX(i) * scale, pos.getY(i) * scale, pos.getZ(i) * scale);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, [terrain.seed]);

  const instances = useMemo(() => {
    const rand = new Random(deriveSeed(terrain.seed, 'boulderScatter'));

    const matrices: THREE.Matrix4[] = [];
    const colors: THREE.Color[] = [];

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
        position.set(x, y - size * 0.32, z);
        euler.set(rand.range(0, Math.PI), rand.range(0, Math.PI * 2), rand.range(0, Math.PI));
        quaternion.setFromEuler(euler);
        scale.set(
          size * rand.range(0.8, 1.3),
          size * rand.range(0.55, 1.0),
          size * rand.range(0.8, 1.3),
        );

        matrix.compose(position, quaternion, scale);
        matrices.push(matrix.clone());

        const tint = rand.float();
        const color = base.clone().lerp(tint > 0.5 ? light : dark, Math.abs(tint - 0.5) * 1.6);
        colors.push(color);
        placed++;
      }
    }

    return { matrices, colors };
  }, [terrain, quality.boulderCount]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    instances.matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    instances.colors.forEach((color, i) => mesh.setColorAt(i, color));

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [instances]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  if (instances.matrices.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, instances.matrices.length]}
      castShadow={quality.shadows}
      receiveShadow
      frustumCulled={false}
      name="boulders"
    >
      <meshStandardMaterial roughness={0.95} metalness={0} flatShading />
    </instancedMesh>
  );
}
