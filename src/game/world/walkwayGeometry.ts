/**
 * Walkway geometry.
 *
 * Two things make a tube network look built rather than assembled out of parts,
 * and both are about the joins.
 *
 * **Seams.** Every tile used to sample the terrain at its own centre, so two
 * neighbouring tiles on a slope sat at different heights and the run stepped.
 * The fix is that a tile never decides the height of its own ends: those are
 * sampled at the *shared edge midpoints*, which the neighbour samples too and
 * therefore agrees with exactly. A tile only owns the height of its centre,
 * which is interior and nobody else's business.
 *
 * **Junctions.** A tile used to emit one full-length arch per axis, so a corner
 * or a T got two overlapping tubes crossing in mid-air. Now a tile emits a
 * half-length *stub* toward each neighbour it actually connects to, plus a
 * collar at the centre where they meet. Straights, corners, T-junctions and
 * crossroads all fall out of that one rule with no special cases.
 */

import * as THREE from 'three';

import { REGION_TILES, TILE_SIZE, WORLD_HALF } from '../core/constants';
import { hasRoad } from './roads';
import type { TerrainData } from './terrain';

/** Height of the walking deck above the ground. */
export const DECK_LIFT = 0.09;
/** Inner radius of the pressurised arch. */
export const ARCH_RADIUS = 0.82;

export type Direction = 'nx' | 'px' | 'nz' | 'pz';

const STEP: Record<Direction, [number, number]> = {
  nx: [-1, 0],
  px: [1, 0],
  nz: [0, -1],
  pz: [0, 1],
};

export function tileWorld(tx: number, tz: number): [number, number] {
  return [(tx + 0.5) * TILE_SIZE - WORLD_HALF, (tz + 0.5) * TILE_SIZE - WORLD_HALF];
}

/**
 * The shared point where a tile hands over to its neighbour.
 *
 * Both tiles compute the identical world position here, so both sample the
 * identical terrain height, so the tubes meet with no step. This is the whole
 * seam fix in one function.
 */
export function edgePoint(tx: number, tz: number, dir: Direction): [number, number] {
  const [cx, cz] = tileWorld(tx, tz);
  const [dx, dz] = STEP[dir];
  return [cx + (dx * TILE_SIZE) / 2, cz + (dz * TILE_SIZE) / 2];
}

/** Which directions this tile connects to. */
export function connectionsOf(tx: number, tz: number): Direction[] {
  const found: Direction[] = [];
  for (const dir of ['nx', 'px', 'nz', 'pz'] as Direction[]) {
    const [dx, dz] = STEP[dir];
    if (hasRoad(tx + dx, tz + dz)) found.push(dir);
  }
  return found;
}

/** True when exactly two connections run straight through, rather than turning. */
export function isStraightThrough(connections: Direction[]): boolean {
  if (connections.length !== 2) return false;
  const set = new Set(connections);
  return (set.has('nx') && set.has('px')) || (set.has('nz') && set.has('pz'));
}

/**
 * A half-tile arch stub, from the tile centre out to one shared edge.
 *
 * Built as a straight tube tilted to match the slope between the two ends. Over
 * half a tile - one metre - a linear tilt is indistinguishable from following
 * the terrain, and it has the property that matters: the ends land *exactly* on
 * the two sampled heights, so the neighbour's stub meets it precisely.
 */
export function archStub(
  terrain: TerrainData,
  tx: number,
  tz: number,
  dir: Direction,
  radius: number,
  thickness: number,
  openTop = true,
): THREE.BufferGeometry {
  const [cx, cz] = tileWorld(tx, tz);
  const [ex, ez] = edgePoint(tx, tz, dir);

  const cy = terrain.generator.heightAt(cx, cz) + DECK_LIFT;
  const ey = terrain.generator.heightAt(ex, ez) + DECK_LIFT;

  const dx = ex - cx;
  const dy = ey - cy;
  const dz = ez - cz;
  const length = Math.hypot(dx, dy, dz);

  // A half cylinder, open along the bottom so the camera sees into the tube.
  const geo = new THREE.CylinderGeometry(
    radius,
    radius,
    // Slight overlap into the neighbour so no hairline shows at the join.
    length * 1.04,
    12,
    1,
    openTop,
    0,
    Math.PI,
  );

  // Lay the cylinder along +X, then yaw it onto the run direction and pitch it
  // onto the slope.
  geo.rotateZ(Math.PI / 2);

  const yaw = Math.atan2(dz, dx);
  const pitch = Math.asin(Math.max(-1, Math.min(1, dy / Math.max(length, 1e-6))));

  geo.rotateZ(pitch);
  geo.rotateY(-yaw);
  geo.translate(cx + dx / 2, cy + dy / 2, cz + dz / 2);

  if (thickness !== 0) {
    // Nothing to do: thickness is expressed by drawing the shell double-sided.
  }

  return geo;
}

/**
 * The walking deck for one tile, as a quad on its four corner heights.
 *
 * Corners are shared with the four diagonal neighbours as well as the four
 * orthogonal ones, so sampling there rather than at the centre means every
 * abutting deck agrees on the height of the ground they meet at.
 */
export function deckQuad(terrain: TerrainData, tx: number, tz: number): THREE.BufferGeometry {
  const x0 = tx * TILE_SIZE - WORLD_HALF;
  const z0 = tz * TILE_SIZE - WORLD_HALF;
  const x1 = x0 + TILE_SIZE;
  const z1 = z0 + TILE_SIZE;

  const h = (x: number, z: number) => terrain.generator.heightAt(x, z) + DECK_LIFT;

  const corners: [number, number, number][] = [
    [x0, h(x0, z0), z0],
    [x1, h(x1, z0), z0],
    [x1, h(x1, z1), z1],
    [x0, h(x0, z1), z1],
  ];

  const positions: number[] = [];
  const push = (i: number) => positions.push(...corners[i]);

  // Top face, two triangles.
  push(0); push(2); push(1);
  push(0); push(3); push(2);

  // A shallow skirt so the deck reads as a slab rather than a sheet of paper.
  const drop = 0.16;
  for (const [a, b] of [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
  ]) {
    const [ax, ay, az] = corners[a];
    const [bx, by, bz] = corners[b];
    positions.push(ax, ay, az, bx, by, bz, ax, ay - drop, az);
    positions.push(bx, by, bz, bx, by - drop, bz, ax, ay - drop, az);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * A service duct running under one stub.
 *
 * Offset to one side of the centre line and below the deck, where a real
 * installation puts its runs - reachable from the walkway by lifting a floor
 * panel, not buried under two metres of regolith.
 */
export function ductStub(
  terrain: TerrainData,
  tx: number,
  tz: number,
  dir: Direction,
  sideOffset: number,
  radius: number,
): THREE.BufferGeometry {
  const [cx, cz] = tileWorld(tx, tz);
  const [ex, ez] = edgePoint(tx, tz, dir);

  const cy = terrain.generator.heightAt(cx, cz) + DECK_LIFT - 0.06;
  const ey = terrain.generator.heightAt(ex, ez) + DECK_LIFT - 0.06;

  const dx = ex - cx;
  const dy = ey - cy;
  const dz = ez - cz;
  const length = Math.hypot(dx, dy, dz);

  // Perpendicular in the ground plane, so the duct sits beside the centre line
  // whichever way the stub runs.
  const nx = -dz / Math.max(length, 1e-6);
  const nz = dx / Math.max(length, 1e-6);

  const geo = new THREE.CylinderGeometry(radius, radius, length * 1.05, 6);
  geo.rotateZ(Math.PI / 2);

  const yaw = Math.atan2(dz, dx);
  const pitch = Math.asin(Math.max(-1, Math.min(1, dy / Math.max(length, 1e-6))));
  geo.rotateZ(pitch);
  geo.rotateY(-yaw);
  geo.translate(
    cx + dx / 2 + nx * sideOffset,
    cy + dy / 2,
    cz + dz / 2 + nz * sideOffset,
  );

  return geo;
}

/** Every laid tile, as `[tx, tz]`. */
export function forEachRoadTile(
  grid: Uint8Array,
  visit: (tx: number, tz: number) => void,
): void {
  for (let index = 0; index < grid.length; index++) {
    if (grid[index] !== 1) continue;
    visit(index % REGION_TILES, (index / REGION_TILES) | 0);
  }
}
