/**
 * Roads, and the utilities they carry.
 *
 * A road here is not decoration and it is not a pathfinding hint. It is the
 * distribution network: every road tile carries a power conduit and a water
 * main, and a structure that is not touching a road is not connected to
 * anything, so it does not run.
 *
 * The model is deliberately the one every city builder has taught players
 * already:
 *
 *   - Roads form a graph. Tiles that touch orthogonally are the same network.
 *   - A generator touching a network energises **that whole network**.
 *   - An extractor touching a network pressurises **that whole network**.
 *   - A consumer touching a network draws whatever that network carries.
 *
 * Two separate road runs that never meet are two separate grids, and a reactor
 * on one of them does nothing for the other. That is the entire rule, and it is
 * why laying out the colony is a decision rather than a formality.
 *
 * A tile also carries a **grade** - see `roadGrades.ts`. Grade changes nothing
 * about what the network delivers, deliberately: a player must never have to
 * work out whether a dark building is dark because of the topology or because
 * of the surface. Grade buys quality of life, and only that.
 *
 * All of this lives outside React in flat typed arrays, like the occupancy grid,
 * because it is rebuilt whenever the colony changes and read every simulation
 * tick. A store would re-render the interface for something the interface only
 * needs a summary of.
 */

import { REGION_TILES, TILE_SIZE, WORLD_HALF } from '../core/constants';
import { BUILDINGS, rotatedFootprint, type BuildingId } from '../buildings/catalog';
import type { PlacedBuilding } from '../state/useColonyStore';
import { NO_ROAD, type RoadGrade } from './roadGrades';

/**
 * Road grade per tile: 0 for none, otherwise the `RoadGrade`.
 *
 * Indexed `tz * REGION_TILES + tx`. This used to be a plain 0/1 presence flag;
 * every read of it goes through `hasRoad` or `gradeAt` so that widening it did
 * not mean auditing every `=== 1` in the codebase.
 */
export const roadGrid = new Uint8Array(REGION_TILES * REGION_TILES);

/** Which network each tile belongs to, or -1. Rebuilt by `solveNetworks`. */
const componentOf = new Int32Array(REGION_TILES * REGION_TILES).fill(-1);

/** Scratch queue for the flood fill, allocated once. */
const floodQueue = new Int32Array(REGION_TILES * REGION_TILES);

export interface RoadNetworks {
  /** Number of distinct road networks. */
  count: number;
  /** Per network: is a generator attached anywhere on it. */
  powered: boolean[];
  /** Per network: is a water source attached anywhere on it. */
  watered: boolean[];
  /** Per network: how many tiles it spans, for the readout. */
  size: number[];
  /** Per network: how many of those tiles are sealed transit way. */
  sealed: number[];
  /** Total road tiles laid. */
  tiles: number;
  /** How many of those are sealed, colony-wide. */
  sealedTiles: number;
}

let networks: RoadNetworks = {
  count: 0,
  powered: [],
  watered: [],
  size: [],
  sealed: [],
  tiles: 0,
  sealedTiles: 0,
};

/**
 * Service state for one structure.
 *
 * `connected` is about geometry - is it touching a road at all. The other two
 * are about what that road is carrying. Keeping them separate is what lets the
 * interface say *which* thing is wrong instead of a generic "not working".
 */
export interface ServiceState {
  connected: boolean;
  hasPower: boolean;
  hasWater: boolean;
  /** False when anything the structure needs is missing. */
  operational: boolean;
  /** The network it is attached to, or -1. */
  network: number;
  /** Best grade of road touching it, or 0. Cosmetic; nothing depends on it. */
  grade: number;
}

const serviceByBuilding = new Map<string, ServiceState>();

export function tileIndexOf(tx: number, tz: number): number {
  if (tx < 0 || tz < 0 || tx >= REGION_TILES || tz >= REGION_TILES) return -1;
  return tz * REGION_TILES + tx;
}

export function hasRoad(tx: number, tz: number): boolean {
  const index = tileIndexOf(tx, tz);
  return index >= 0 && roadGrid[index] !== NO_ROAD;
}

/** Grade laid on a tile, or 0 for bare ground. */
export function gradeAt(tx: number, tz: number): number {
  const index = tileIndexOf(tx, tz);
  return index < 0 ? NO_ROAD : roadGrid[index];
}

/** Writes a grade to a tile. Pass `NO_ROAD` to lift the road. */
export function setRoad(tx: number, tz: number, grade: number): boolean {
  const index = tileIndexOf(tx, tz);
  if (index < 0) return false;
  const next = grade === NO_ROAD ? NO_ROAD : (grade as RoadGrade);
  if (roadGrid[index] === next) return false;
  roadGrid[index] = next;
  return true;
}

export function clearRoads(): void {
  roadGrid.fill(NO_ROAD);
  componentOf.fill(-1);
  serviceByBuilding.clear();
  networks = {
    count: 0,
    powered: [],
    watered: [],
    size: [],
    sealed: [],
    tiles: 0,
    sealedTiles: 0,
  };
}

/** Every road tile as a flat grid index. Used by the renderer and by saves. */
export function listRoadTiles(): number[] {
  const tiles: number[] = [];
  for (let i = 0; i < roadGrid.length; i++) {
    if (roadGrid[i] !== NO_ROAD) tiles.push(i);
  }
  return tiles;
}

/** Grades for those tiles, in the same order. */
export function listRoadGrades(): number[] {
  const grades: number[] = [];
  for (let i = 0; i < roadGrid.length; i++) {
    if (roadGrid[i] !== NO_ROAD) grades.push(roadGrid[i]);
  }
  return grades;
}

/**
 * Restores a saved network.
 *
 * `grades` is optional because saves written before grades existed have only
 * the tile list. Those load as service road, which is what they were.
 */
export function restoreRoads(indices: number[], grades?: number[]): void {
  roadGrid.fill(NO_ROAD);
  indices.forEach((index, order) => {
    if (index < 0 || index >= roadGrid.length) return;
    const grade = grades?.[order];
    roadGrid[index] = grade === 2 ? 2 : 1;
  });
}

/** Share of the laid network that is sealed, 0-1. */
export function sealedShare(): number {
  return networks.tiles > 0 ? networks.sealedTiles / networks.tiles : 0;
}

// ---------------------------------------------------------------------------
// What a structure needs, and what it supplies
// ---------------------------------------------------------------------------

/**
 * Structures that feed the grid rather than draw from it.
 *
 * Power is straightforward - anything with positive net generation. Water is
 * the ice extractor: it is the only thing on Mars that turns buried ice into
 * something a pipe can carry, which is exactly why it has to be plumbed into
 * the network rather than helping wherever it happens to stand.
 */
export function suppliesPower(id: BuildingId): boolean {
  return BUILDINGS[id].power > 0;
}

export function suppliesWater(id: BuildingId): boolean {
  return (BUILDINGS[id].output.water ?? 0) > 0;
}

export function needsPower(id: BuildingId): boolean {
  return BUILDINGS[id].power < 0;
}

export function needsWater(id: BuildingId): boolean {
  return (BUILDINGS[id].input.water ?? 0) > 0;
}

/**
 * Structures exempt from needing a road at all.
 *
 * The hub is where the colony starts; requiring it to be connected to a road
 * that does not exist yet would mean the game opens in a failed state. Roads
 * themselves obviously do not need roads.
 */
function isExempt(id: BuildingId): boolean {
  // `road` is no longer placeable - roads are laid with the road tool straight
  // into the grid above - but a colony saved before that change can still be
  // carrying road *structures*, and asking a road whether it is connected to a
  // road produces both a nonsense warning and a gate tunnel drawn between two
  // adjacent road tiles.
  return id === 'lander' || id === 'road';
}

// ---------------------------------------------------------------------------
// Solver
// ---------------------------------------------------------------------------

/**
 * Rebuilds the networks and every structure's service state.
 *
 * Called whenever roads or buildings change - not per tick. The flood fill is
 * O(tiles) and the building pass is O(buildings x footprint perimeter), so even
 * a full crater of roads is well under a millisecond.
 */
export function solveNetworks(buildings: PlacedBuilding[]): RoadNetworks {
  componentOf.fill(-1);

  let count = 0;
  let tiles = 0;
  let sealedTiles = 0;
  const size: number[] = [];
  const sealed: number[] = [];

  // --- 1. Flood fill road tiles into connected networks -------------------
  for (let start = 0; start < roadGrid.length; start++) {
    if (roadGrid[start] === NO_ROAD || componentOf[start] !== -1) continue;

    const id = count++;
    let head = 0;
    let tail = 0;
    floodQueue[tail++] = start;
    componentOf[start] = id;
    let spans = 0;
    let spansSealed = 0;

    while (head < tail) {
      const index = floodQueue[head++];
      spans++;
      tiles++;
      if (roadGrid[index] === 2) {
        spansSealed++;
        sealedTiles++;
      }

      const tx = index % REGION_TILES;
      const tz = (index / REGION_TILES) | 0;

      // Orthogonal only. Diagonal touching is not a junction you could drive
      // a rover through, and treating it as one makes networks join in ways
      // the player cannot see.
      const neighbours = [
        tx > 0 ? index - 1 : -1,
        tx < REGION_TILES - 1 ? index + 1 : -1,
        tz > 0 ? index - REGION_TILES : -1,
        tz < REGION_TILES - 1 ? index + REGION_TILES : -1,
      ];

      for (const next of neighbours) {
        if (next < 0) continue;
        if (roadGrid[next] === NO_ROAD || componentOf[next] !== -1) continue;
        componentOf[next] = id;
        floodQueue[tail++] = next;
      }
    }

    size.push(spans);
    sealed.push(spansSealed);
  }

  const powered = new Array<boolean>(count).fill(false);
  const watered = new Array<boolean>(count).fill(false);

  // --- 2. Suppliers energise the network they touch -----------------------
  for (const building of buildings) {
    if (building.progress < 1 || !building.enabled) continue;

    const { networks: attached } = networksTouching(building);
    if (attached.length === 0) continue;

    for (const network of attached) {
      if (suppliesPower(building.type)) powered[network] = true;
      if (suppliesWater(building.type)) watered[network] = true;
    }
  }

  networks = { count, powered, watered, size, sealed, tiles, sealedTiles };

  // --- 3. Consumers read back what their network carries ------------------
  serviceByBuilding.clear();
  for (const building of buildings) {
    serviceByBuilding.set(building.id, computeService(building));
  }

  return networks;
}

/**
 * Networks touched by a structure's footprint perimeter, and the best grade of
 * road among them.
 *
 * Returned together because both come from the same walk of the ring and the
 * callers that want one usually want the other.
 */
function networksTouching(building: PlacedBuilding): { networks: number[]; grade: number } {
  const [w, d] = rotatedFootprint(building.type, building.rotation);
  const found = new Set<number>();
  let grade = NO_ROAD;

  // Walk the ring of tiles immediately outside the footprint.
  for (let dx = -1; dx <= w; dx++) {
    for (let dz = -1; dz <= d; dz++) {
      const inside = dx >= 0 && dx < w && dz >= 0 && dz < d;
      if (inside) continue;
      // Corners do not count: a road diagonally off the corner of a building
      // is not touching it in any sense the player would accept.
      const isCorner = (dx === -1 || dx === w) && (dz === -1 || dz === d);
      if (isCorner) continue;

      const index = tileIndexOf(building.tx + dx, building.tz + dz);
      if (index < 0 || roadGrid[index] === NO_ROAD) continue;
      if (roadGrid[index] > grade) grade = roadGrid[index];
      const component = componentOf[index];
      if (component >= 0) found.add(component);
    }
  }

  return { networks: [...found], grade };
}

function computeService(building: PlacedBuilding): ServiceState {
  const type = building.type;

  if (isExempt(type)) {
    return {
      connected: true,
      hasPower: true,
      hasWater: true,
      operational: true,
      network: -1,
      grade: NO_ROAD,
    };
  }

  const { networks: attached, grade } = networksTouching(building);
  const connected = attached.length > 0;

  // A structure on two networks gets the best of both, which is what physically
  // happens when you wire a building into two grids.
  const hasPower = attached.some((n) => networks.powered[n]);
  const hasWater = attached.some((n) => networks.watered[n]);

  const operational =
    connected && (!needsPower(type) || hasPower) && (!needsWater(type) || hasWater);

  return { connected, hasPower, hasWater, operational, network: attached[0] ?? -1, grade };
}

/** Service state for a structure. Safe to call before the first solve. */
export function serviceOf(buildingId: string): ServiceState {
  return (
    serviceByBuilding.get(buildingId) ?? {
      connected: false,
      hasPower: false,
      hasWater: false,
      operational: false,
      network: -1,
      grade: NO_ROAD,
    }
  );
}

export function currentNetworks(): RoadNetworks {
  return networks;
}

/** Which network a tile belongs to, or -1. */
export function networkAt(tx: number, tz: number): number {
  const index = tileIndexOf(tx, tz);
  return index < 0 ? -1 : componentOf[index];
}

/** Whether a given road tile is carrying power / water, for the renderer. */
export function tileUtilities(tx: number, tz: number): { power: boolean; water: boolean } {
  const component = networkAt(tx, tz);
  if (component < 0) return { power: false, water: false };
  return {
    power: networks.powered[component] === true,
    water: networks.watered[component] === true,
  };
}

/** Centre of a tile in world space. */
export function tileCentre(tx: number, tz: number): [number, number] {
  return [(tx + 0.5) * TILE_SIZE - WORLD_HALF, (tz + 0.5) * TILE_SIZE - WORLD_HALF];
}

/*
 * `serviceProblem` used to live here: one short sentence naming whichever of
 * road, power or water was missing.
 *
 * It has moved to `buildings/status.ts` and grown into `structureStatus`, which
 * answers the same question and the two next ones - what this structure is for,
 * and how much of that it is currently managing. Keeping a second, thinner
 * answer here would have guaranteed the two drifted apart, and the thin one was
 * the one the interface no longer used.
 */

/**
 * Where a structure's gate meets the walkway.
 *
 * Every structure has one gate, and it should be visibly plumbed into the
 * network rather than merely standing next to it. This finds the road tile the
 * structure actually touches and returns the short run between the two, which
 * the renderer draws as a connecting tunnel.
 *
 * Returns null when the structure is not touching a walkway at all - in which
 * case there is nothing to draw, and the inspector is already saying so.
 */
export function gateConnection(
  building: PlacedBuilding,
): { from: [number, number]; to: [number, number] } | null {
  if (isExempt(building.type)) return null;

  const [w, d] = rotatedFootprint(building.type, building.rotation);

  // Walk the perimeter ring and take the first road tile found. Deterministic
  // order means the tunnel does not jump to a different side of the building
  // when an unrelated road is laid elsewhere.
  for (let dz = -1; dz <= d; dz++) {
    for (let dx = -1; dx <= w; dx++) {
      const inside = dx >= 0 && dx < w && dz >= 0 && dz < d;
      if (inside) continue;
      const isCorner = (dx === -1 || dx === w) && (dz === -1 || dz === d);
      if (isCorner) continue;

      const tx = building.tx + dx;
      const tz = building.tz + dz;
      if (!hasRoad(tx, tz)) continue;

      // From the footprint edge nearest that tile, to the tile centre.
      const edgeX = Math.min(Math.max(tx, building.tx), building.tx + w - 1);
      const edgeZ = Math.min(Math.max(tz, building.tz), building.tz + d - 1);

      const [fx, fz] = tileCentre(edgeX, edgeZ);
      const [tox, toz] = tileCentre(tx, tz);
      return { from: [fx, fz], to: [tox, toz] };
    }
  }

  return null;
}
