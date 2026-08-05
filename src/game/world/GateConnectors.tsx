'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { useColonyStore } from '../state/useColonyStore';
import { useRoadStore } from '../state/useRoadStore';
import { gateConnection } from './roads';
import { DECK_LIFT } from './walkwayGeometry';
import type { TerrainData } from './terrain';

/**
 * The tunnel from each structure's gate to the walkway.
 *
 * Every structure has one gate, and it should be visibly plumbed into the
 * network rather than merely standing beside it. Without this, a serviced
 * building and an unserviced one look identical from the air - both are just a
 * box near a tube - and the player has to click each one to find out which is
 * which.
 *
 * The tunnel only exists when the connection does, which makes it the clearest
 * possible readout: if you can see the gate joined to the walkway, that sector
 * is on the network. If you cannot, it is not.
 */
export function GateConnectors({ terrain }: { terrain: TerrainData }) {
  const buildings = useColonyStore((state) => state.buildings);
  const version = useRoadStore((state) => state.version);

  const geometry = useMemo(() => {
    const shells: THREE.BufferGeometry[] = [];
    const collars: THREE.BufferGeometry[] = [];

    for (const building of buildings) {
      if (building.progress < 1) continue;

      const link = gateConnection(building);
      if (!link) continue;

      const [fx, fz] = link.from;
      const [tox, toz] = link.to;

      const fy = terrain.generator.heightAt(fx, fz) + DECK_LIFT;
      const ty = terrain.generator.heightAt(tox, toz) + DECK_LIFT;

      const dx = tox - fx;
      const dy = ty - fy;
      const dz = toz - fz;
      const length = Math.hypot(dx, dy, dz);
      if (length < 0.05) continue;

      // A short pressurised tube, slightly narrower than the walkway itself so
      // the join reads as a branch rather than a continuation.
      const tube = new THREE.CylinderGeometry(0.55, 0.55, length * 1.1, 12, 1, true, 0, Math.PI);
      tube.rotateZ(Math.PI / 2);

      const yaw = Math.atan2(dz, dx);
      const pitch = Math.asin(Math.max(-1, Math.min(1, dy / Math.max(length, 1e-6))));
      tube.rotateZ(pitch);
      tube.rotateY(-yaw);
      tube.translate(fx + dx / 2, fy + dy / 2, fz + dz / 2);
      shells.push(tube);

      // A collar at each end: the hatch on the building, the tap into the run.
      for (const [px, py, pz] of [
        [fx, fy, fz],
        [tox, ty, toz],
      ] as const) {
        const collar = new THREE.TorusGeometry(0.57, 0.055, 6, 14, Math.PI);
        collar.rotateZ(Math.PI);
        collar.rotateY(-yaw + Math.PI / 2);
        collar.translate(px, py, pz);
        collars.push(collar);
      }
    }

    const merge = (list: THREE.BufferGeometry[]) => {
      if (list.length === 0) return null;
      const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (merged && list.length > 1) for (const g of list) g.dispose();
      return merged;
    };

    return { shell: merge(shells), collars: merge(collars) };
    // `version` signals a road change; the grid itself is not reactive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildings, version, terrain]);

  useEffect(() => {
    return () => {
      for (const geo of Object.values(geometry)) geo?.dispose();
    };
  }, [geometry]);

  if (!geometry.shell) return null;

  return (
    <group name="gate-connectors">
      <mesh geometry={geometry.shell}>
        <meshStandardMaterial
          color="#cfd6dc"
          roughness={0.5}
          metalness={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>
      {geometry.collars ? (
        <mesh geometry={geometry.collars} castShadow>
          <meshStandardMaterial color="#b9c3cc" roughness={0.42} metalness={0.72} />
        </mesh>
      ) : null}
    </group>
  );
}
