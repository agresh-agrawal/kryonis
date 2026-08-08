'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { activityOf } from '../sim/simulation';
import { buildingTransform, useColonyStore, type PlacedBuilding } from '../state/useColonyStore';
import type { TerrainData } from '../world/terrain';
import { getBuildingModel, type BuildingId } from './catalog';

/**
 * Warning markers over structures that are standing but not running.
 *
 * A dark building is invisible feedback. The colony can be half-built and
 * producing nothing, and from a camera fifty metres up every structure looks
 * exactly like every other one - the player only finds out by clicking each in
 * turn, which nobody does, or by noticing an oxygen bar falling for reasons
 * they cannot see.
 *
 * So the building says it itself. One badge, floating over the roof, in the
 * colour of the thing that is missing: no road, no power, no water. It is drawn
 * with depth testing off and a high render order, because a warning that is
 * hidden behind the very structure it is warning about is not a warning.
 *
 * Three instanced meshes, one per kind, so the whole system is three draw calls
 * no matter how many structures are in trouble. The badge textures are drawn
 * into canvases at runtime - the project ships no binary art assets, and this is
 * not the place to start.
 */

const KINDS = ['road', 'power', 'water'] as const;
type MarkerKind = (typeof KINDS)[number];

/** How the three kinds read at a glance. Colour carries the meaning; the glyph confirms it. */
const KIND_COLOUR: Record<MarkerKind, string> = {
  road: '#c65a41',
  power: '#d6a765',
  water: '#7fb3bd',
};

/** Ceiling on badges drawn at once. A colony in worse shape than this has one problem, not sixty. */
const MAX_MARKERS = 96;

/**
 * Draws one badge into a canvas.
 *
 * A filled disc with a dark rim and a white glyph, plus a slash through it:
 * the slash is what turns "power" into "no power" without any text, and it is
 * legible at the thirty-odd pixels these actually occupy on screen.
 */
function badgeTexture(kind: MarkerKind): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  const centre = size / 2;

  // Disc.
  ctx.beginPath();
  ctx.arc(centre, centre, size * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = KIND_COLOUR[kind];
  ctx.fill();
  ctx.lineWidth = size * 0.055;
  ctx.strokeStyle = 'rgba(12, 10, 9, 0.85)';
  ctx.stroke();

  ctx.fillStyle = '#0c0a09';
  ctx.strokeStyle = '#0c0a09';
  ctx.lineWidth = size * 0.07;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (kind === 'road') {
    // A road running to the horizon, with its centre line: the same glyph the
    // road tool uses, so the badge and the fix share a symbol.
    ctx.beginPath();
    ctx.moveTo(centre - size * 0.17, centre + size * 0.2);
    ctx.lineTo(centre - size * 0.06, centre - size * 0.2);
    ctx.lineTo(centre + size * 0.06, centre - size * 0.2);
    ctx.lineTo(centre + size * 0.17, centre + size * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = KIND_COLOUR[kind];
    ctx.lineWidth = size * 0.035;
    ctx.beginPath();
    ctx.moveTo(centre, centre - size * 0.13);
    ctx.lineTo(centre, centre + size * 0.13);
    ctx.stroke();
  } else if (kind === 'power') {
    // A bolt.
    ctx.beginPath();
    ctx.moveTo(centre + size * 0.08, centre - size * 0.21);
    ctx.lineTo(centre - size * 0.14, centre + size * 0.03);
    ctx.lineTo(centre - size * 0.01, centre + size * 0.03);
    ctx.lineTo(centre - size * 0.07, centre + size * 0.21);
    ctx.lineTo(centre + size * 0.15, centre - size * 0.03);
    ctx.lineTo(centre + size * 0.02, centre - size * 0.03);
    ctx.closePath();
    ctx.fill();
  } else {
    // A droplet.
    ctx.beginPath();
    ctx.moveTo(centre, centre - size * 0.22);
    ctx.bezierCurveTo(
      centre + size * 0.2,
      centre + size * 0.02,
      centre + size * 0.13,
      centre + size * 0.21,
      centre,
      centre + size * 0.21,
    );
    ctx.bezierCurveTo(
      centre - size * 0.13,
      centre + size * 0.21,
      centre - size * 0.2,
      centre + size * 0.02,
      centre,
      centre - size * 0.22,
    );
    ctx.closePath();
    ctx.fill();
  }

  // The slash. Drawn last, in the badge colour with a dark outline, so it reads
  // as struck through rather than as part of the glyph.
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#0c0a09';
  ctx.lineWidth = size * 0.13;
  ctx.beginPath();
  ctx.moveTo(centre - size * 0.24, centre + size * 0.24);
  ctx.lineTo(centre + size * 0.24, centre - size * 0.24);
  ctx.stroke();
  ctx.strokeStyle = '#ece6dd';
  ctx.lineWidth = size * 0.07;
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * How tall a structure of each type is.
 *
 * Measured from the model's own geometry rather than guessed from the
 * footprint, so a badge floats just clear of a spaceport's masts and just clear
 * of a corridor's roof without either being tuned by hand. Cached per type; the
 * models are cached too, so this costs one bounding box each.
 */
const heightCache = new Map<BuildingId, number>();

function modelHeight(type: BuildingId): number {
  const cached = heightCache.get(type);
  if (cached !== undefined) return cached;

  const model = getBuildingModel(type);
  let top = 0;
  for (const geometry of Object.values(model)) {
    if (!geometry) continue;
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (box && box.max.y > top) top = box.max.y;
  }

  const height = top > 0 ? top : 2;
  heightCache.set(type, height);
  return height;
}

export function StatusMarkers({ terrain }: { terrain: TerrainData }) {
  const buildings = useColonyStore((state) => state.buildings);

  const textures = useMemo(() => {
    const map = {} as Record<MarkerKind, THREE.Texture>;
    for (const kind of KINDS) map[kind] = badgeTexture(kind);
    return map;
  }, []);

  useEffect(() => {
    return () => {
      for (const texture of Object.values(textures)) texture.dispose();
    };
  }, [textures]);

  const meshes = useRef(new Map<MarkerKind, THREE.InstancedMesh>());

  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      scale: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      buckets: { road: [], power: [], water: [] } as Record<MarkerKind, PlacedBuilding[]>,
    }),
    [],
  );

  /*
   * Rebuilt every frame rather than memoised on a store value.
   *
   * The activity record the badges read lives outside React - the simulation
   * rewrites it four times a second without notifying anything - so there is no
   * dependency to memoise against. Sorting a few dozen buildings into three
   * arrays is cheaper than the bookkeeping that would let us skip it.
   */
  useFrame(({ camera, clock }) => {
    const { buckets } = scratch;
    buckets.road.length = 0;
    buckets.power.length = 0;
    buckets.water.length = 0;

    for (const building of buildings) {
      if (building.progress < 1 || !building.enabled) continue;
      const limit = activityOf(building.id).limit;
      if (limit !== 'road' && limit !== 'power' && limit !== 'water') continue;
      const bucket = buckets[limit];
      if (bucket.length < MAX_MARKERS) bucket.push(building);
    }

    // Badges always face the camera and never tilt with it, so a run of them
    // reads as a row of signs rather than as a scattering of quads.
    scratch.quaternion.copy(camera.quaternion);

    const bob = Math.sin(clock.elapsedTime * 2.2) * 0.09;
    const pulse = 0.72 + Math.sin(clock.elapsedTime * 3.4) * 0.28;

    for (const kind of KINDS) {
      const mesh = meshes.current.get(kind);
      if (!mesh) continue;

      const list = buckets[kind];
      for (let i = 0; i < list.length; i++) {
        const building = list[i];
        const transform = buildingTransform(terrain, building);
        scratch.position.set(
          transform.x,
          transform.y + modelHeight(building.type) + 1.15 + bob,
          transform.z,
        );
        scratch.scale.setScalar(1.35);
        scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale);
        mesh.setMatrixAt(i, scratch.matrix);
      }

      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.visible = list.length > 0;

      const material = mesh.material as THREE.MeshBasicMaterial;
      material.opacity = 0.55 + pulse * 0.45;
    }
  });

  return (
    <group name="status-markers" renderOrder={20}>
      {KINDS.map((kind) => (
        <instancedMesh
          key={kind}
          ref={(instance) => {
            if (instance) meshes.current.set(kind, instance);
            else meshes.current.delete(kind);
          }}
          args={[undefined, undefined, MAX_MARKERS]}
          frustumCulled={false}
          renderOrder={20}
          visible={false}
          name={`status-marker-${kind}`}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={textures[kind]}
            transparent
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </instancedMesh>
      ))}
    </group>
  );
}
