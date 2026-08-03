'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import type { QualitySettings } from '../core/quality';
import { buildModel, capsule, cylinder, unitSphere, type Part } from '../buildings/model';
import { useColonyStore } from '../state/useColonyStore';
import { dayFraction, useTimeStore } from '../state/useTimeStore';
import type { TerrainData } from '../world/terrain';
import { currentSun } from '../world/sun';
import {
  assignRoles,
  colonists,
  rebuildWalkable,
  syncColonists,
  updateColonists,
} from './colonists';

/** Metres of ground covered per full stride cycle. */
const STRIDE_LENGTH = 1.45;

/**
 * A colonist in a pressure suit, built from the same kit as the buildings.
 *
 * Deliberately geometry-only: no imported model, no textures, no skeleton. At
 * the zoom this game is played at a colonist is a few dozen pixels tall, and
 * silhouette plus a lit visor is the entire read.
 */
function suitParts(): Part[] {
  return [
    { geo: capsule(0.17, 0.28), mat: 'hull', pos: [0, 0.55, 0], rot: [0, 0, Math.PI / 2] },
    { geo: cylinder(0.08, 0.44, 6), mat: 'hull', pos: [-0.075, 0.22, 0] },
    { geo: cylinder(0.08, 0.44, 6), mat: 'hull', pos: [0.075, 0.22, 0] },
    { geo: cylinder(0.06, 0.36, 6), mat: 'hull', pos: [-0.22, 0.57, 0], rot: [0, 0, 0.24] },
    { geo: cylinder(0.06, 0.36, 6), mat: 'hull', pos: [0.22, 0.57, 0], rot: [0, 0, -0.24] },
    // Life-support backpack.
    { geo: capsule(0.115, 0.13), mat: 'metal', pos: [0, 0.59, -0.18], rot: [0, 0, Math.PI / 2] },
    // Helmet and visor - the only part that has to read at distance.
    { geo: unitSphere(), mat: 'hull', pos: [0, 0.84, 0], scale: 0.14 },
    { geo: unitSphere(), mat: 'window', pos: [0, 0.84, 0.06], scale: 0.108 },
    { geo: cylinder(0.172, 0.045, 8), mat: 'accent', pos: [0, 0.66, 0] },
  ];
}

/**
 * Renders and drives the colony's people.
 *
 * Colonists are drawn as instanced geometry - one draw call per material for
 * the entire population, however large it grows. An authored rigged character
 * was tried here and removed: skinning cannot be instanced, so every colonist
 * became its own draw call with its own bone matrices, which capped the crew an
 * order of magnitude lower and pulled in imported materials that overflowed the
 * fragment sampler budget on a 16-unit GPU.
 *
 * Gait is synthesised from *distance walked* rather than elapsed time, so a
 * colonist that slows down takes slower steps instead of skating; standing
 * colonists breathe and glance around so they never read as scenery.
 */
export function ColonistsLayer({
  terrain,
  quality,
}: {
  terrain: TerrainData;
  quality: QualitySettings;
}) {
  const buildings = useColonyStore((state) => state.buildings);
  const population = useColonyStore((state) => state.stats.population);
  const paused = useTimeStore((state) => state.paused);
  const speed = useTimeStore((state) => state.speed);

  const model = useMemo(() => buildModel(suitParts()), []);

  // Four flat materials, no textures at all: two fragment samplers total once
  // the shadow map is counted, which no GPU is going to object to.
  const materials = useMemo(
    () => ({
      hull: new THREE.MeshStandardMaterial({
        color: '#e6e2da',
        roughness: 0.58,
        metalness: 0.05,
      }),
      metal: new THREE.MeshStandardMaterial({
        color: '#9aa3ad',
        roughness: 0.4,
        metalness: 0.8,
      }),
      window: new THREE.MeshStandardMaterial({
        color: '#2b3f57',
        roughness: 0.15,
        metalness: 0.5,
        emissive: new THREE.Color('#7fd6ff'),
        emissiveIntensity: 0.5,
      }),
      accent: new THREE.MeshStandardMaterial({
        color: '#c98a52',
        roughness: 0.45,
        emissive: new THREE.Color('#a8763f'),
        emissiveIntensity: 0.4,
      }),
    }),
    [],
  );

  useEffect(
    () => () => {
      for (const material of Object.values(materials)) material.dispose();
      for (const geometry of Object.values(model)) geometry?.dispose();
    },
    [materials, model],
  );

  const meshRefs = useRef(new Map<string, THREE.InstancedMesh>());

  const footprintKey = useMemo(
    () => buildings.map((b) => `${b.id}:${b.progress >= 1 ? 1 : 0}`).join(','),
    [buildings],
  );

  useEffect(() => {
    rebuildWalkable(terrain, buildings);
    assignRoles(buildings);
  }, [terrain, footprintKey, buildings]);

  const buildingsById = useMemo(() => {
    const map = new Map<string, (typeof buildings)[number]>();
    for (const building of buildings) map.set(building.id, building);
    return map;
  }, [buildings]);

  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      euler: new THREE.Euler(),
      scale: new THREE.Vector3(1, 1, 1),
    }),
    [],
  );

  useFrame(({ clock }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1) * (paused ? 0 : speed);

    syncColonists(terrain, buildings, population, quality.maxVisibleAgents);
    if (delta > 0) updateColonists(delta, terrain, buildingsById, dayFraction());

    const meshes = meshRefs.current;
    if (meshes.size === 0) return;

    const time = clock.elapsedTime;

    for (let i = 0; i < colonists.length; i++) {
      const colonist = colonists[i];
      const walking = colonist.path !== null;

      let bob = 0;
      let roll = 0;
      let lean = 0;
      let yaw = colonist.heading;

      if (walking) {
        const phase = (colonist.stride / STRIDE_LENGTH) * Math.PI * 2;
        bob = Math.abs(Math.sin(phase)) * 0.08;
        roll = Math.sin(phase * 0.5) * 0.05;
        lean = 0.07;
      } else {
        // Standing: a slow breath and a periodic glance, offset per colonist so
        // a group never moves in unison.
        const idle = time * 0.9 + colonist.wobble * 9;
        bob = Math.sin(idle) * 0.012;
        roll = Math.sin(idle * 0.55) * 0.018;
        yaw += Math.sin(time * 0.28 + colonist.wobble * 7) * 0.32;
      }

      scratch.position.set(colonist.x, colonist.y + bob, colonist.z);
      scratch.euler.set(lean, yaw, roll);
      scratch.quaternion.setFromEuler(scratch.euler);
      scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale);

      for (const mesh of meshes.values()) mesh.setMatrixAt(i, scratch.matrix);
    }

    for (const mesh of meshes.values()) {
      mesh.count = colonists.length;
      mesh.instanceMatrix.needsUpdate = true;
    }

    // Visors and suit stripes glow after dark.
    const night = currentSun.nightFactor;
    materials.window.emissiveIntensity = 0.35 + night * 1.6;
    materials.accent.emissiveIntensity = 0.3 + night * 1;
  });

  const capacity = Math.max(1, quality.maxVisibleAgents);

  return (
    <group name="colonists">
      {(Object.keys(model) as (keyof typeof materials)[]).map((key) => {
        const geometry = model[key];
        const material = materials[key];
        if (!geometry || !material) return null;
        return (
          <instancedMesh
            key={key}
            ref={(instance) => {
              if (instance) meshRefs.current.set(key, instance);
              else meshRefs.current.delete(key);
            }}
            args={[geometry, material, capacity]}
            castShadow={quality.shadows}
            receiveShadow
            frustumCulled={false}
            name={`colonist-${key}`}
          />
        );
      })}
    </group>
  );
}
