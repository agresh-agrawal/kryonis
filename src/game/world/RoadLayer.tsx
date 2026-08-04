'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { REGION_TILES, TILE_SIZE, WORLD_HALF } from '../core/constants';
import { useRoadStore } from '../state/useRoadStore';
import { hasRoad, networkAt, roadGrid, tileUtilities } from './roads';
import type { TerrainData } from './terrain';

/**
 * The road network, drawn.
 *
 * Three merged meshes rebuilt whenever the grid changes: the running surface,
 * the power conduit and the water main. Merging rather than instancing is the
 * right call here because each tile's geometry depends on its neighbours - a
 * straight and a junction are different shapes - so there is no single
 * instanceable primitive to begin with.
 *
 * The two conduits are the point of the whole system. Yellow carries power,
 * blue carries water, and they run down opposite shoulders of every road so a
 * player can trace a line from a reactor to the building that is not working.
 * A dead conduit is dark; a live one glows. That colour is the only feedback
 * needed to answer "why is my greenhouse offline".
 */

const SURFACE_HEIGHT = 0.06;
const CONDUIT_HEIGHT = 0.1;
/** How far the conduits sit from the tile centre line. */
const CONDUIT_OFFSET = 0.62;
const CONDUIT_RADIUS = 0.075;

export function RoadLayer({ terrain }: { terrain: TerrainData }) {
  const version = useRoadStore((state) => state.version);
  const showUtilities = useRoadStore((state) => state.showUtilities);

  const powerMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const waterMaterial = useRef<THREE.MeshStandardMaterial>(null);

  /*
   * Geometry is rebuilt on every road change rather than incrementally patched.
   *
   * A colony tops out around a few hundred road tiles, so a full rebuild is a
   * couple of milliseconds and happens only when the player lays or removes a
   * piece. Incremental patching would be faster and would be the wrong trade:
   * far more state to keep correct, for time nobody was spending.
   */
  const geometry = useMemo(() => {
    const surfaces: THREE.BufferGeometry[] = [];
    const powered: THREE.BufferGeometry[] = [];
    const unpowered: THREE.BufferGeometry[] = [];
    const watered: THREE.BufferGeometry[] = [];
    const unwatered: THREE.BufferGeometry[] = [];

    for (let index = 0; index < roadGrid.length; index++) {
      if (roadGrid[index] !== 1) continue;

      const tx = index % REGION_TILES;
      const tz = (index / REGION_TILES) | 0;
      const x = (tx + 0.5) * TILE_SIZE - WORLD_HALF;
      const z = (tz + 0.5) * TILE_SIZE - WORLD_HALF;
      const y = terrain.generator.heightAt(x, z);

      // --- Running surface ------------------------------------------------
      // Slightly oversized so adjacent tiles overlap and no hairline of
      // regolith shows through a straight run.
      const slab = new THREE.BoxGeometry(TILE_SIZE * 1.02, SURFACE_HEIGHT, TILE_SIZE * 1.02);
      slab.translate(x, y + SURFACE_HEIGHT / 2, z);
      surfaces.push(slab);

      const { power, water } = tileUtilities(tx, tz);

      /*
       * Conduits run along whichever axis the road runs.
       *
       * A tile with a neighbour to the east and west lays its conduits
       * east-west; one with neighbours north and south lays them north-south.
       * A junction gets both, which is what makes corners and crossroads look
       * continuous instead of like a pile of disconnected sticks.
       */
      const east = hasRoad(tx + 1, tz);
      const west = hasRoad(tx - 1, tz);
      const north = hasRoad(tx, tz - 1);
      const south = hasRoad(tx, tz + 1);

      const runsX = east || west;
      const runsZ = north || south;
      // An isolated tile still shows its conduits, or a single road piece
      // would look like a blank slab.
      const axes: ('x' | 'z')[] = runsX || runsZ ? [] : ['x'];
      if (runsX) axes.push('x');
      if (runsZ) axes.push('z');

      for (const axis of axes) {
        for (const [offset, bucketLive, bucketDead] of [
          [-CONDUIT_OFFSET, powered, unpowered] as const,
          [CONDUIT_OFFSET, watered, unwatered] as const,
        ]) {
          const tube = new THREE.CylinderGeometry(
            CONDUIT_RADIUS,
            CONDUIT_RADIUS,
            TILE_SIZE * 1.02,
            6,
          );

          if (axis === 'x') {
            tube.rotateZ(Math.PI / 2);
            tube.translate(x, y + CONDUIT_HEIGHT, z + offset);
          } else {
            tube.rotateX(Math.PI / 2);
            tube.translate(x + offset, y + CONDUIT_HEIGHT, z);
          }

          const live = offset < 0 ? power : water;
          (live ? bucketLive : bucketDead).push(tube);
        }
      }
    }

    const merge = (list: THREE.BufferGeometry[]) => {
      if (list.length === 0) return null;
      const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (merged && list.length > 1) for (const g of list) g.dispose();
      return merged;
    };

    return {
      surface: merge(surfaces),
      powered: merge(powered),
      unpowered: merge(unpowered),
      watered: merge(watered),
      unwatered: merge(unwatered),
    };
    // `version` is the signal that the grid changed; the grid itself is not
    // reactive, so it cannot be a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, terrain]);

  useEffect(() => {
    return () => {
      for (const geo of Object.values(geometry)) geo?.dispose();
    };
  }, [geometry]);

  // Live conduits pulse gently. Movement is what separates "this cable is
  // carrying something" from "this cable is painted yellow".
  useFrame(({ clock }) => {
    const pulse = 0.75 + Math.sin(clock.elapsedTime * 1.6) * 0.25;
    const boost = showUtilities ? 1.9 : 1;
    if (powerMaterial.current) powerMaterial.current.emissiveIntensity = pulse * boost;
    if (waterMaterial.current) waterMaterial.current.emissiveIntensity = pulse * 0.85 * boost;
  });

  if (!geometry.surface) return null;

  return (
    <group name="roads">
      <mesh geometry={geometry.surface} receiveShadow>
        {/*
          Compacted regolith, not asphalt. There is no bitumen on Mars - a road
          here is graded, rolled and sintered dust, so it reads a shade darker
          and smoother than the ground either side of it rather than black.
        */}
        <meshStandardMaterial color="#4e4038" roughness={0.95} metalness={0.02} />
      </mesh>

      {/* --- Power conduit, yellow ------------------------------------- */}
      {geometry.powered ? (
        <mesh geometry={geometry.powered}>
          <meshStandardMaterial
            ref={powerMaterial}
            color="#f0c657"
            emissive="#f0c657"
            emissiveIntensity={1}
            roughness={0.4}
            metalness={0.3}
          />
        </mesh>
      ) : null}
      {geometry.unpowered ? (
        <mesh geometry={geometry.unpowered}>
          <meshStandardMaterial color="#5d5238" roughness={0.8} metalness={0.2} />
        </mesh>
      ) : null}

      {/* --- Water main, blue ------------------------------------------ */}
      {geometry.watered ? (
        <mesh geometry={geometry.watered}>
          <meshStandardMaterial
            ref={waterMaterial}
            color="#4fa8e0"
            emissive="#4fa8e0"
            emissiveIntensity={0.85}
            roughness={0.35}
            metalness={0.3}
          />
        </mesh>
      ) : null}
      {geometry.unwatered ? (
        <mesh geometry={geometry.unwatered}>
          <meshStandardMaterial color="#37505e" roughness={0.8} metalness={0.2} />
        </mesh>
      ) : null}
    </group>
  );
}

/** Which network a world position sits on, for click-to-inspect. */
export function networkAtWorld(x: number, z: number): number {
  const tx = Math.floor((x + WORLD_HALF) / TILE_SIZE);
  const tz = Math.floor((z + WORLD_HALF) / TILE_SIZE);
  return networkAt(tx, tz);
}
