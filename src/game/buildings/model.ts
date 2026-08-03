/**
 * The structural kit that every KRYONIS building is assembled from.
 *
 * Buildings are described as a flat list of transformed primitives tagged with
 * a material. `buildModel` then merges everything sharing a material into a
 * single BufferGeometry, which is what lets the renderer draw the whole colony
 * with instancing: one InstancedMesh per (building type x material), regardless
 * of how many parts the building is made of or how many copies exist.
 *
 * Models are authored in world units with their footprint centred on the origin
 * and their base sitting at y = 0.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import type { MaterialKey } from './materials';

export interface Part {
  geo: THREE.BufferGeometry;
  mat: MaterialKey;
  pos?: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number] | number;
}

export type BuildingModel = Partial<Record<MaterialKey, THREE.BufferGeometry>>;

/**
 * Bakes a part list into one merged geometry per material.
 *
 * Transforms are applied to geometry rather than kept as a scene graph - a
 * baked model has no per-part matrix updates and no per-part draw calls.
 */
export function buildModel(parts: Part[]): BuildingModel {
  const byMaterial = new Map<MaterialKey, THREE.BufferGeometry[]>();
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();

  for (const part of parts) {
    const geo = part.geo.clone();

    position.set(...(part.pos ?? [0, 0, 0]));
    euler.set(...(part.rot ?? [0, 0, 0]));
    quaternion.setFromEuler(euler);
    if (typeof part.scale === 'number') scale.setScalar(part.scale);
    else scale.set(...(part.scale ?? [1, 1, 1]));

    matrix.compose(position, quaternion, scale);
    geo.applyMatrix4(matrix);

    // Merging requires matching attribute sets; drop anything exotic that a
    // primitive might carry so every geometry has exactly position/normal/uv.
    for (const name of Object.keys(geo.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') {
        geo.deleteAttribute(name);
      }
    }

    const list = byMaterial.get(part.mat);
    if (list) list.push(geo);
    else byMaterial.set(part.mat, [geo]);
  }

  const model: BuildingModel = {};
  for (const [mat, geometries] of byMaterial) {
    const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
    if (!merged) continue;
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    model[mat] = merged;
    // Clones were consumed by the merge; release the intermediates.
    if (geometries.length > 1) for (const geo of geometries) geo.dispose();
  }

  return model;
}

export function disposeModel(model: BuildingModel): void {
  for (const geo of Object.values(model)) geo?.dispose();
}

/** Overall bounding box of a baked model, used to frame ghosts and selection. */
export function modelBounds(model: BuildingModel): THREE.Box3 {
  const box = new THREE.Box3();
  for (const geo of Object.values(model)) {
    if (geo?.boundingBox) box.union(geo.boundingBox);
  }
  return box;
}

// ---------------------------------------------------------------------------
// Shared primitives
//
// Created once and reused across every model. `buildModel` clones before
// transforming, so these are never mutated.
// ---------------------------------------------------------------------------

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_SPHERE = new THREE.SphereGeometry(1, 24, 14);
const UNIT_CONE = new THREE.ConeGeometry(1, 1, 18);

export function box(w: number, h: number, d: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d);
}

export function cylinder(radius: number, height: number, segments = 20): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(radius, radius, height, segments);
}

export function taperedCylinder(
  rTop: number,
  rBottom: number,
  height: number,
  segments = 20,
): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(rTop, rBottom, height, segments);
}

/** Hemisphere sitting on the XZ plane - the classic pressurised habitat shell. */
export function dome(radius: number, segments = 24): THREE.BufferGeometry {
  return new THREE.SphereGeometry(radius, segments, Math.max(6, segments / 2), 0, Math.PI * 2, 0, Math.PI / 2);
}

/** Horizontal pressurised module: a cylinder with domed end caps. */
export function capsule(radius: number, length: number, segments = 18): THREE.BufferGeometry {
  const geo = new THREE.CapsuleGeometry(radius, length, 6, segments);
  // CapsuleGeometry runs along Y; lay it down along X.
  geo.rotateZ(Math.PI / 2);
  return geo;
}

export function torus(radius: number, tube: number, segments = 20): THREE.BufferGeometry {
  return new THREE.TorusGeometry(radius, tube, 8, segments);
}

/**
 * Half-cylinder arch running along X with the opening downward - the shape of
 * an inflatable greenhouse or a covered walkway.
 *
 * Built from the half of a Y-axis cylinder where x <= 0, then rotated so the
 * cylinder axis lies along X; that particular half is the one that ends up
 * above the ground rather than below it.
 */
export function vault(radius: number, length: number, segments = 20): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(radius, radius, length, segments, 1, true, Math.PI, Math.PI);
  geo.rotateZ(-Math.PI / 2);
  return geo;
}

export function unitBox(): THREE.BufferGeometry {
  return UNIT_BOX;
}
export function unitSphere(): THREE.BufferGeometry {
  return UNIT_SPHERE;
}
export function unitCone(): THREE.BufferGeometry {
  return UNIT_CONE;
}

// ---------------------------------------------------------------------------
// Composite fittings
//
// Recurring hardware that shows up on many structures. Returning Part[] lets a
// building splice a whole fitting into its list with one spread.
// ---------------------------------------------------------------------------

/** Cast regolith foundation pad, slightly inset from the building footprint. */
export function foundation(width: number, depth: number, height = 0.18): Part[] {
  return [
    { geo: box(width, height, depth), mat: 'concrete', pos: [0, height / 2, 0] },
  ];
}

/** Ring of vertical support legs with footpads. */
export function legs(count: number, radius: number, height: number, thickness = 0.09): Part[] {
  const parts: Part[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.PI / count;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    parts.push({ geo: cylinder(thickness, height, 8), mat: 'metal', pos: [x, height / 2, z] });
    parts.push({
      geo: cylinder(thickness * 2.6, 0.08, 10),
      mat: 'metal',
      pos: [x, 0.04, z],
    });
  }
  return parts;
}

/** A short pressurised connecting tunnel with reinforcing ribs. */
export function airlock(
  position: [number, number, number],
  rotationY: number,
  length = 1.1,
  radius = 0.42,
): Part[] {
  const [x, y, z] = position;
  return [
    { geo: capsule(radius, length), mat: 'hull', pos: [x, y, z], rot: [0, rotationY, 0] },
    // Hatch ring on the outer face.
    {
      geo: torus(radius * 0.86, 0.07, 14),
      mat: 'metal',
      pos: [x + Math.sin(rotationY) * (length / 2 + radius * 0.5), y, z + Math.cos(rotationY) * (length / 2 + radius * 0.5)],
      rot: [0, rotationY, 0],
    },
  ];
}

/** Communications mast with a dish and a beacon at the top. */
export function antenna(
  position: [number, number, number],
  height: number,
  withDish = true,
): Part[] {
  const [x, y, z] = position;
  const parts: Part[] = [
    { geo: cylinder(0.055, height, 8), mat: 'metal', pos: [x, y + height / 2, z] },
    // Obstruction beacon.
    { geo: unitSphere(), mat: 'hazard', pos: [x, y + height + 0.08, z], scale: 0.1 },
  ];

  if (withDish) {
    parts.push({
      geo: new THREE.SphereGeometry(0.42, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.6),
      mat: 'hull',
      pos: [x, y + height * 0.78, z],
      rot: [Math.PI * 0.62, 0, 0.4],
    });
  }

  return parts;
}

/** Vertical storage tank with insulation bands. */
export function tank(
  position: [number, number, number],
  radius: number,
  height: number,
  material: MaterialKey = 'hull',
): Part[] {
  const [x, y, z] = position;
  return [
    { geo: cylinder(radius, height, 18), mat: material, pos: [x, y + height / 2, z] },
    { geo: dome(radius, 18), mat: material, pos: [x, y + height, z] },
    { geo: torus(radius * 1.02, 0.05, 18), mat: 'metal', pos: [x, y + height * 0.3, z], rot: [Math.PI / 2, 0, 0] },
    { geo: torus(radius * 1.02, 0.05, 18), mat: 'metal', pos: [x, y + height * 0.72, z], rot: [Math.PI / 2, 0, 0] },
  ];
}

/** Radiator panel bank - how a colony actually sheds waste heat. */
export function radiator(
  position: [number, number, number],
  width: number,
  height: number,
  rotationY = 0,
): Part[] {
  const [x, y, z] = position;
  const parts: Part[] = [
    { geo: box(width, height, 0.06), mat: 'metal', pos: [x, y, z], rot: [0, rotationY, 0] },
  ];
  // Fin detail across the face.
  const fins = Math.max(3, Math.round(width * 3));
  for (let i = 0; i < fins; i++) {
    const offset = (i / (fins - 1) - 0.5) * width * 0.92;
    parts.push({
      geo: box(0.04, height * 0.92, 0.1),
      mat: 'dark',
      pos: [x + Math.cos(rotationY) * offset, y, z - Math.sin(rotationY) * offset],
      rot: [0, rotationY, 0],
    });
  }
  return parts;
}

/** Row of lit viewports along a wall. */
export function viewports(
  count: number,
  start: [number, number, number],
  step: [number, number, number],
  radius = 0.17,
): Part[] {
  const parts: Part[] = [];
  for (let i = 0; i < count; i++) {
    parts.push({
      geo: unitSphere(),
      mat: 'window',
      pos: [start[0] + step[0] * i, start[1] + step[1] * i, start[2] + step[2] * i],
      scale: radius,
    });
  }
  return parts;
}

/** Painted hazard stripe / corporate accent band around a cylinder. */
export function accentBand(
  position: [number, number, number],
  radius: number,
  thickness = 0.06,
): Part[] {
  return [
    {
      geo: torus(radius, thickness, 20),
      mat: 'accent',
      pos: position,
      rot: [Math.PI / 2, 0, 0],
    },
  ];
}
