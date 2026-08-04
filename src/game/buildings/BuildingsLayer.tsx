'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import type { QualitySettings } from '../core/quality';
import { currentDoctrine } from '../state/useProfileStore';
import { useTimeStore } from '../state/useTimeStore';
import {
  buildingTransform,
  constructionProgress,
  useColonyStore,
  type PlacedBuilding,
} from '../state/useColonyStore';
import type { TerrainData } from '../world/terrain';
import { currentSun } from '../world/sun';
import { BUILDINGS, getBuildingModel, upgradeTier, type BuildingId } from './catalog';
import { FoundationLayer } from './FoundationLayer';
import { MaterialLibrary, type MaterialKey } from './materials';

/** Tint applied to structures still under construction. */
const UNDER_CONSTRUCTION_TINT = new THREE.Color('#c2803f');
const COMPLETE_TINT = new THREE.Color('#ffffff');
/** Tint pulsed over the currently selected structure. */
const SELECTED_TINT = new THREE.Color('#7fe9ff');

/**
 * Renders every structure in the colony.
 *
 * Buildings are grouped by type and then by material, and each group is drawn
 * as one InstancedMesh. A colony of two hundred structures therefore costs
 * roughly (types present) x (materials used) draw calls - a few dozen - instead
 * of two hundred times however many parts each model has.
 *
 * Instance matrices are rewritten every frame rather than only on change. That
 * sounds wasteful, but it is a handful of matrix compositions per building and
 * it is what lets construction animate, selection pulse, and buildings settle
 * onto terrain without any invalidation bookkeeping.
 */
export function BuildingsLayer({
  terrain,
  quality,
}: {
  terrain: TerrainData;
  quality: QualitySettings;
}) {
  const buildings = useColonyStore((state) => state.buildings);
  const selectedId = useColonyStore((state) => state.selectedId);
  const completeConstruction = useColonyStore((state) => state.completeConstruction);
  const paused = useTimeStore((state) => state.paused);
  const speed = useTimeStore((state) => state.speed);

  const materials = useMemo(() => new MaterialLibrary(), []);
  const completionFlash = useRef(new Map<string, number>());
  useEffect(() => () => materials.dispose(), [materials]);

  // Group by type so each type can be instanced independently.
  const byType = useMemo(() => {
    const groups = new Map<BuildingId, PlacedBuilding[]>();
    for (const building of buildings) {
      const list = groups.get(building.type);
      if (list) list.push(building);
      else groups.set(building.type, [building]);
    }
    return [...groups.entries()];
  }, [buildings]);

  const utilityLinks = useMemo(() => {
    const anchors = buildings.filter(
      (building) => building.progress >= 1 && building.enabled && (building.type === 'road' || building.type === 'lander'),
    );

    return buildings.flatMap((building) => {
      if (building.progress < 1 || !building.enabled || building.type === 'road' || building.type === 'lander') {
        return [];
      }

      const from = buildingTransform(terrain, building);
      let bestAnchor: PlacedBuilding | null = null;
      let bestDistance = Infinity;

      for (const anchor of anchors) {
        const to = buildingTransform(terrain, anchor);
        const distance = Math.hypot(from.x - to.x, from.z - to.z);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestAnchor = anchor;
        }
      }

      if (!bestAnchor || bestDistance > 10) return [];

      const to = buildingTransform(terrain, bestAnchor);
      return [
        {
          id: building.id,
          points: [
            [from.x, from.y + 1.35, from.z],
            [to.x, to.y + 0.45, to.z],
          ] as [number, number, number][],
          color: building.type === 'solar' || building.type === 'battery' ? '#f4cf5c' : '#5fd3ff',
        },
      ];
    });
  }, [buildings, terrain]);

  // Advance construction and drive time-of-day surfaces.
  useFrame(({ clock }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.25);
    materials.update(delta, currentSun.nightFactor);

    if (paused) return;
    for (const building of buildings) {
      if (building.progress >= 1) continue;

      // A structure at level 1 is being built; anything higher is being
      // retrofitted, and a retrofit is quicker than the original build.
      // An industrial programme pours concrete faster than a research one.
      const duration =
        (building.level > 1
          ? upgradeTier(building.level).buildTime
          : BUILDINGS[building.type].buildTime) * currentDoctrine().buildTimeScale;

      const current = constructionProgress.get(building.id) ?? 0;
      const next = current + (delta * speed) / Math.max(0.001, duration);
      if (next >= 1) {
        completionFlash.current.set(building.id, clock.elapsedTime);
        completeConstruction(building.id);
      } else {
        constructionProgress.set(building.id, next);
      }
    }
  });

  return (
    <group name="colony">
      {/* Pads first: they are what the structures above are standing on. */}
      <FoundationLayer terrain={terrain} quality={quality} materials={materials} />

      {utilityLinks.map((link) => (
        <Line
          key={link.id}
          points={link.points}
          color={link.color}
          lineWidth={1.2}
          transparent
          opacity={0.55}
          depthTest={false}
        />
      ))}

      {byType.map(([type, list]) => (
        <BuildingTypeInstances
          key={type}
          type={type}
          buildings={list}
          terrain={terrain}
          materials={materials}
          quality={quality}
          selectedId={selectedId}
        />
      ))}
    </group>
  );
}

function BuildingTypeInstances({
  type,
  buildings,
  terrain,
  materials,
  quality,
  selectedId,
}: {
  type: BuildingId;
  buildings: PlacedBuilding[];
  terrain: TerrainData;
  materials: MaterialLibrary;
  quality: QualitySettings;
  selectedId: string | null;
}) {
  const model = useMemo(() => getBuildingModel(type), [type]);
  const materialKeys = useMemo(() => Object.keys(model) as MaterialKey[], [model]);
  const meshRefs = useRef(new Map<MaterialKey, THREE.InstancedMesh>());
  const completionFlash = useRef(new Map<string, number>());

  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      euler: new THREE.Euler(),
      scale: new THREE.Vector3(),
      color: new THREE.Color(),
    }),
    [],
  );

  useFrame(({ clock }) => {
    const meshes = meshRefs.current;
    if (meshes.size === 0) return;

    const pulse = Math.sin(clock.elapsedTime * 4) * 0.5 + 0.5;
    const flashMap = completionFlash.current;

    for (let i = 0; i < buildings.length; i++) {
      const building = buildings[i];
      const transform = buildingTransform(terrain, building);

      const progress =
        building.progress >= 1 ? 1 : (constructionProgress.get(building.id) ?? 0);
      const isConnected = building.enabled;
      const flashStart = flashMap.get(building.id) ?? -Infinity;
      const flashAge = flashStart >= 0 ? clock.elapsedTime - flashStart : Infinity;
      const flash = flashAge < 0.8 ? 1 - flashAge / 0.8 : 0;

      // Structures rise out of the ground as they are built. Starting at a
      // fraction rather than zero keeps the foundation pad visible from the
      // moment ground is broken.
      const grow = 0.08 + 0.92 * progress;

      scratch.position.set(transform.x, transform.y, transform.z);
      scratch.euler.set(0, transform.rotationY, 0);
      scratch.quaternion.setFromEuler(scratch.euler);
      scratch.scale.set(1 + flash * 0.06, grow * (1 + flash * 0.04), 1 + flash * 0.06);
      scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale);

      if (progress < 1) {
        scratch.color.copy(UNDER_CONSTRUCTION_TINT);
      } else if (!isConnected) {
        scratch.color.set('#7a6c4f');
      } else if (building.id === selectedId) {
        scratch.color.copy(COMPLETE_TINT).lerp(SELECTED_TINT, 0.35 + pulse * 0.35 + flash * 0.2);
      } else {
        scratch.color.copy(COMPLETE_TINT).lerp(COMPLETE_TINT, 1 - flash * 0.12);
      }

      for (const mesh of meshes.values()) {
        mesh.setMatrixAt(i, scratch.matrix);
        mesh.setColorAt(i, scratch.color);
      }
    }

    for (const mesh of meshes.values()) {
      mesh.count = buildings.length;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });

  if (buildings.length === 0) return null;

  return (
    <>
      {materialKeys.map((key) => {
        const geometry = model[key];
        if (!geometry) return null;
        return (
          <instancedMesh
            key={key}
            ref={(instance) => {
              if (instance) meshRefs.current.set(key, instance);
              else meshRefs.current.delete(key);
            }}
            args={[geometry, materials.get(key), Math.max(1, buildings.length)]}
            castShadow={quality.shadows && key !== 'glass'}
            receiveShadow
            frustumCulled={false}
            name={`building-${type}-${key}`}
          />
        );
      })}
    </>
  );
}
