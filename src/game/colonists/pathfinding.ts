/**
 * Grid pathfinding for colonists.
 *
 * A* over the tile grid with an eight-way neighbourhood. The crater floor is
 * mostly open, so most searches resolve in a few dozen nodes; the node budget
 * exists for the pathological case where a colonist is asked to route around a
 * dense block of structures and would otherwise flood the whole region.
 *
 * The open set is a binary heap rather than a sorted array. With a 96x96 grid a
 * linear scan for the cheapest node is the difference between pathfinding being
 * free and it being the most expensive thing in the frame.
 */

import { REGION_TILES } from '../core/constants';

/** Ceiling on nodes expanded per search before giving up. */
const NODE_BUDGET = 2200;

const SQRT2 = Math.SQRT2;

/** Minimal binary min-heap keyed by f-score. */
class NodeHeap {
  private items: number[] = [];
  private scores: Float32Array;

  constructor(capacity: number) {
    this.scores = new Float32Array(capacity);
  }

  clear(): void {
    this.items.length = 0;
  }

  get size(): number {
    return this.items.length;
  }

  push(node: number, score: number): void {
    this.scores[node] = score;
    this.items.push(node);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.scores[this.items[parent]] <= this.scores[this.items[i]]) break;
      const tmp = this.items[parent];
      this.items[parent] = this.items[i];
      this.items[i] = tmp;
      i = parent;
    }
  }

  pop(): number {
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        if (left < this.items.length && this.scores[this.items[left]] < this.scores[this.items[smallest]]) {
          smallest = left;
        }
        if (right < this.items.length && this.scores[this.items[right]] < this.scores[this.items[smallest]]) {
          smallest = right;
        }
        if (smallest === i) break;
        const tmp = this.items[smallest];
        this.items[smallest] = this.items[i];
        this.items[i] = tmp;
        i = smallest;
      }
    }
    return top;
  }
}

const TILE_COUNT = REGION_TILES * REGION_TILES;

// Scratch buffers reused across every search. Pathfinding runs many times per
// second across the whole colony; allocating these per call would churn.
const gScore = new Float32Array(TILE_COUNT);
const fScore = new Float32Array(TILE_COUNT);
const cameFrom = new Int32Array(TILE_COUNT);
const visitStamp = new Int32Array(TILE_COUNT);
const closed = new Uint8Array(TILE_COUNT);
const heap = new NodeHeap(TILE_COUNT);

let currentStamp = 0;

function heuristic(ax: number, az: number, bx: number, bz: number): number {
  // Octile distance - the exact cost of an unobstructed eight-way path.
  const dx = Math.abs(ax - bx);
  const dz = Math.abs(az - bz);
  return dx + dz + (SQRT2 - 2) * Math.min(dx, dz);
}

/**
 * Finds a walkable route between two tiles.
 *
 * @param walkable  1 where a colonist may stand
 * @returns tile indices from start to goal inclusive, or null if unreachable
 */
export function findPath(
  walkable: Uint8Array,
  startTile: number,
  goalTile: number,
): number[] | null {
  if (startTile === goalTile) return [startTile];
  if (startTile < 0 || goalTile < 0) return null;
  if (!walkable[goalTile]) return null;

  currentStamp++;
  heap.clear();

  const sx = startTile % REGION_TILES;
  const sz = (startTile / REGION_TILES) | 0;
  const gx = goalTile % REGION_TILES;
  const gz = (goalTile / REGION_TILES) | 0;

  gScore[startTile] = 0;
  fScore[startTile] = heuristic(sx, sz, gx, gz);
  cameFrom[startTile] = -1;
  visitStamp[startTile] = currentStamp;
  closed[startTile] = 0;
  heap.push(startTile, fScore[startTile]);

  let expanded = 0;

  while (heap.size > 0 && expanded < NODE_BUDGET) {
    const current = heap.pop();
    if (closed[current] === 1 && visitStamp[current] === currentStamp) continue;
    closed[current] = 1;
    visitStamp[current] = currentStamp;
    expanded++;

    if (current === goalTile) {
      const path: number[] = [];
      let node = current;
      while (node !== -1) {
        path.push(node);
        node = cameFrom[node];
      }
      path.reverse();
      return path;
    }

    const cx = current % REGION_TILES;
    const cz = (current / REGION_TILES) | 0;

    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dz === 0) continue;

        const nx = cx + dx;
        const nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= REGION_TILES || nz >= REGION_TILES) continue;

        const neighbour = nz * REGION_TILES + nx;
        if (!walkable[neighbour]) continue;

        // Do not let a colonist squeeze through the corner gap between two
        // diagonally-touching structures.
        if (dx !== 0 && dz !== 0) {
          if (!walkable[cz * REGION_TILES + nx] || !walkable[nz * REGION_TILES + cx]) continue;
        }

        const step = dx !== 0 && dz !== 0 ? SQRT2 : 1;
        const tentative = gScore[current] + step;

        const seen = visitStamp[neighbour] === currentStamp;
        if (seen && tentative >= gScore[neighbour]) continue;

        cameFrom[neighbour] = current;
        gScore[neighbour] = tentative;
        fScore[neighbour] = tentative + heuristic(nx, nz, gx, gz);
        visitStamp[neighbour] = currentStamp;
        closed[neighbour] = 0;
        heap.push(neighbour, fScore[neighbour]);
      }
    }
  }

  return null;
}

/**
 * Nearest walkable tile to a target, searched outward in rings.
 *
 * Colonists path *to the edge of* a building rather than into it, so a
 * workplace's own tiles are never walkable and the destination has to be
 * relocated to something adjacent.
 */
export function nearestWalkable(
  walkable: Uint8Array,
  tx: number,
  tz: number,
  maxRadius = 6,
): number {
  if (tx >= 0 && tz >= 0 && tx < REGION_TILES && tz < REGION_TILES) {
    const index = tz * REGION_TILES + tx;
    if (walkable[index]) return index;
  }

  for (let radius = 1; radius <= maxRadius; radius++) {
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        // Only the perimeter of this ring.
        if (Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue;

        const nx = tx + dx;
        const nz = tz + dz;
        if (nx < 0 || nz < 0 || nx >= REGION_TILES || nz >= REGION_TILES) continue;

        const index = nz * REGION_TILES + nx;
        if (walkable[index]) return index;
      }
    }
  }

  return -1;
}
