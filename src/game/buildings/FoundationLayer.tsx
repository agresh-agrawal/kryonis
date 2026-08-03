'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import type { QualitySettings } from '../core/quality';
import { buildingFooting, constructionProgress, useColonyStore } from '../state/useColonyStore';
import type { TerrainData } from '../world/terrain';
import { MaterialLibrary } from './materials';

/**
 * The prepared pad under every structure.
 *
 * Buildings are seated at the highest corner of their footprint so that no part
 * of one is ever swallowed by the ground. The cost of that choice is that on
 * sloping tiles the downhill corners have nothing beneath them, and a colony of
 * structures hovering a foot above Mars is the single most obviously wrong thing
 * in the render.
 *
 * The fix is not to move the buildings - it is to build the pad that should
 * always have been there. Every real installation on uneven ground sits on a
 * levelled plinth, so the honest fix and the good-looking one are the same.
 *
 * One InstancedMesh covers the entire colony regardless of type, because every
 * pad is the same box at a different scale. That is one extra draw call for the
 * whole game.
 */
export function FoundationLayer({
  terrain,
  quality,
  materials,
}: {
  terrain: TerrainData;
  quality: QualitySettings;
  materials: MaterialLibrary;
}) {
  const buildings = useColonyStore((state) => state.buildings);
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // A unit box with its origin at the *top* face, so scaling it downwards
  // extends it into the ground without moving the surface the building sits on.
  const geometry = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, -0.5, 0);
    return box;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      scale: new THREE.Vector3(),
    }),
    [],
  );

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let i = 0; i < buildings.length; i++) {
      const building = buildings[i];
      const footing = buildingFooting(terrain, building);

      // The pad is poured before the structure rises, so it reaches full size
      // early in construction rather than growing with the building.
      const progress =
        building.progress >= 1 ? 1 : (constructionProgress.get(building.id) ?? 0);
      const poured = Math.min(1, progress / 0.25);

      scratch.position.set(footing.x, footing.top + 0.02, footing.z);
      scratch.scale.set(
        footing.width * poured,
        Math.max(0.12, footing.drop),
        footing.depth * poured,
      );
      scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale);
      mesh.setMatrixAt(i, scratch.matrix);
    }

    mesh.count = buildings.length;
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (buildings.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, materials.get('concrete'), Math.max(1, buildings.length)]}
      receiveShadow
      castShadow={quality.shadows}
      frustumCulled={false}
      name="colony-foundations"
    />
  );
}
