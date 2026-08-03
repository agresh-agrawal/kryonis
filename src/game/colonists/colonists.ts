/**
 * The colony's people.
 *
 * Colonists are simulated individually - each has a name, a profession, a home
 * bunk, a workplace, and walks between them on a shift schedule - but the
 * resources they consume are still accounted for as a population total by the
 * economy simulation. That split is deliberate: individual agents give the
 * colony life and let the player point at someone and care about them, while
 * pooled resources keep the economy something a player can actually reason
 * about. Physically hauling every crate would be neither.
 *
 * The roster lives outside React in a plain array. It is rewritten every frame
 * and read only by the renderer and the inspector, so pushing it through a
 * store would re-render the interface sixty times a second for no benefit.
 */

import * as THREE from 'three';

import { REGION_TILES, TILE_SIZE, WORLD_HALF } from '../core/constants';
import { Random } from '../core/rng';
import { BUILDINGS } from '../buildings/catalog';
import { rotatedFootprint } from '../buildings/catalog';
import type { PlacedBuilding } from '../state/useColonyStore';
import { tileIndex, type TerrainData } from '../world/terrain';
import { findPath, nearestWalkable } from './pathfinding';

export type Profession =
  | 'Engineer'
  | 'Scientist'
  | 'Botanist'
  | 'Miner'
  | 'Medic'
  | 'Technician';

export type ColonistActivity = 'Working' | 'Resting' | 'Walking' | 'Idle';

export interface Colonist {
  id: number;
  name: string;
  profession: Profession;
  /** 0-1, raises the output of whatever they are staffing. */
  skill: number;

  /** World position. */
  x: number;
  y: number;
  z: number;
  /** Facing, radians. */
  heading: number;

  homeId: string | null;
  workId: string | null;
  activity: ColonistActivity;

  path: number[] | null;
  pathIndex: number;
  /** Seconds until this colonist next reconsiders what it is doing. */
  thinkIn: number;
  /** Small per-colonist offset so a crowd does not walk in lockstep. */
  wobble: number;
  speed: number;
  /** Multiplier on walking speed - brisk on shift, ambling off it. */
  paceScale: number;
  /**
   * Distance walked, used as the phase of the stride animation.
   *
   * Driving the bob from distance rather than from elapsed time means the
   * gait stays locked to the feet: a colonist that slows down takes slower
   * steps instead of moonwalking on the spot.
   */
  stride: number;
}

const FIRST_NAMES = [
  'Ada', 'Ravi', 'Mei', 'Tomas', 'Ines', 'Kofi', 'Yuki', 'Omar', 'Lena', 'Diego',
  'Sana', 'Piotr', 'Amara', 'Jonas', 'Nadia', 'Hugo', 'Leila', 'Marco', 'Freya', 'Kenji',
  'Rosa', 'Ivan', 'Priya', 'Noor', 'Erik', 'Chidi', 'Anya', 'Luca', 'Zara', 'Sven',
];

const LAST_NAMES = [
  'Okafor', 'Nakamura', 'Варга', 'Lindqvist', 'Moreau', 'Silva', 'Haddad', 'Novak',
  'Bergman', 'Reyes', 'Kaur', 'Duarte', 'Ferrari', 'Osei', 'Kowalski', 'Ibrahim',
  'Andersen', 'Rossi', 'Petrov', 'Fischer', 'Mensah', 'Castillo', 'Larsen', 'Yilmaz',
];

const PROFESSIONS: Profession[] = [
  'Engineer',
  'Scientist',
  'Botanist',
  'Miner',
  'Medic',
  'Technician',
];

/** Walking speed in world units per second. */
const WALK_SPEED = 2.6;

/**
 * How far a colonist will drift from its post when it has nothing to do.
 *
 * Idle agents that stand perfectly still read as props. Giving them somewhere
 * to wander - a few metres, at a stroll - is the cheapest way to make a colony
 * look staffed rather than decorated.
 */
const WANDER_RADIUS = 7;

/** How close counts as arrived at a path node. */
const ARRIVE_EPSILON = 0.35;

/** The roster. Index is not stable; look up by `id`. */
export const colonists: Colonist[] = [];

let nextColonistId = 1;
const roster = new Random(20260802);

/** Walkability grid, rebuilt whenever the colony's footprint changes. */
const walkable = new Uint8Array(REGION_TILES * REGION_TILES);
let walkableVersion = -1;

export function getWalkableGrid(): Uint8Array {
  return walkable;
}

/**
 * Recomputes where colonists may stand.
 *
 * Buildings are solid and terrain must be flat enough to cross; the crater wall
 * is therefore impassable for exactly the same reason it is unbuildable, which
 * is why a colonist can never walk out of the valley.
 */
export function rebuildWalkable(terrain: TerrainData, buildings: PlacedBuilding[]): void {
  walkable.set(terrain.buildable);

  for (const building of buildings) {
    const [w, d] = rotatedFootprint(building.type, building.rotation);
    for (let dz = 0; dz < d; dz++) {
      for (let dx = 0; dx < w; dx++) {
        const index = tileIndex(terrain, building.tx + dx, building.tz + dz);
        if (index >= 0) walkable[index] = 0;
      }
    }
  }
}

function tileCentreWorld(index: number): [number, number] {
  const tx = index % REGION_TILES;
  const tz = (index / REGION_TILES) | 0;
  return [(tx + 0.5) * TILE_SIZE - WORLD_HALF, (tz + 0.5) * TILE_SIZE - WORLD_HALF];
}

function worldToTileIndex(x: number, z: number): number {
  const tx = Math.floor((x + WORLD_HALF) / TILE_SIZE);
  const tz = Math.floor((z + WORLD_HALF) / TILE_SIZE);
  if (tx < 0 || tz < 0 || tx >= REGION_TILES || tz >= REGION_TILES) return -1;
  return tz * REGION_TILES + tx;
}

/** A tile just outside a building, where a colonist stands to enter it. */
function entranceTile(building: PlacedBuilding): number {
  const [w, d] = rotatedFootprint(building.type, building.rotation);
  const cx = building.tx + Math.floor(w / 2);
  const cz = building.tz + d;
  return nearestWalkable(walkable, cx, cz, 8);
}

function createColonist(terrain: TerrainData, spawn: { x: number; z: number }): Colonist {
  const first = roster.pick(FIRST_NAMES);
  const last = roster.pick(LAST_NAMES);
  const angle = roster.range(0, Math.PI * 2);
  const radius = roster.range(1.5, 5);

  const x = spawn.x + Math.cos(angle) * radius;
  const z = spawn.z + Math.sin(angle) * radius;

  return {
    id: nextColonistId++,
    name: `${first} ${last}`,
    profession: roster.pick(PROFESSIONS),
    skill: roster.range(0.45, 1),
    x,
    y: terrain.generator.heightAt(x, z),
    z,
    heading: angle,
    homeId: null,
    workId: null,
    activity: 'Idle',
    path: null,
    pathIndex: 0,
    thinkIn: roster.range(0, 3),
    wobble: roster.range(-0.5, 0.5),
    speed: WALK_SPEED * roster.range(0.85, 1.15),
    paceScale: 1,
    stride: roster.range(0, 10),
  };
}

/**
 * Reconciles the roster against the simulated population.
 *
 * The economy owns how many people there are; this just makes the world agree
 * with it, spawning arrivals near the lander and removing the last colonist
 * when the population falls.
 */
export function syncColonists(
  terrain: TerrainData,
  buildings: PlacedBuilding[],
  population: number,
  maxVisible: number,
): void {
  const target = Math.min(Math.floor(population), maxVisible);

  if (target > colonists.length) {
    const lander = buildings.find((building) => building.type === 'lander') ?? buildings[0];
    const spawn = lander
      ? {
          x: (lander.tx + 1.5) * TILE_SIZE - WORLD_HALF,
          z: (lander.tz + 1.5) * TILE_SIZE - WORLD_HALF,
        }
      : { x: 0, z: 0 };

    while (colonists.length < target) colonists.push(createColonist(terrain, spawn));
  } else if (target < colonists.length) {
    colonists.length = Math.max(0, target);
  }
}

/**
 * Assigns homes and jobs.
 *
 * Run only when the set of buildings changes rather than every frame - it walks
 * the whole roster and the whole colony, and neither changes often.
 */
export function assignRoles(buildings: PlacedBuilding[]): void {
  const homes: { id: string; slots: number }[] = [];
  const jobs: { id: string; slots: number }[] = [];

  for (const building of buildings) {
    if (building.progress < 1 || !building.enabled) continue;
    const def = BUILDINGS[building.type];
    if (def.housing > 0) homes.push({ id: building.id, slots: def.housing });
    if (def.workers > 0) jobs.push({ id: building.id, slots: def.workers });
  }

  let homeIndex = 0;
  let jobIndex = 0;

  for (const colonist of colonists) {
    colonist.homeId = null;
    colonist.workId = null;

    while (homeIndex < homes.length && homes[homeIndex].slots <= 0) homeIndex++;
    if (homeIndex < homes.length) {
      colonist.homeId = homes[homeIndex].id;
      homes[homeIndex].slots--;
    }

    while (jobIndex < jobs.length && jobs[jobIndex].slots <= 0) jobIndex++;
    if (jobIndex < jobs.length) {
      colonist.workId = jobs[jobIndex].id;
      jobs[jobIndex].slots--;
    }
  }
}

/** True when the colony's shape has changed and derived data must be rebuilt. */
export function colonyFootprintChanged(version: number): boolean {
  return version !== walkableVersion;
}

export function markFootprintVersion(version: number): void {
  walkableVersion = version;
}

const scratchTarget = new THREE.Vector2();

/**
 * Advances every colonist by `dt` seconds.
 *
 * Path replanning is staggered through `thinkIn` so the whole colony never
 * re-plans on the same frame, which is what keeps a few hundred agents cheap.
 */
export function updateColonists(
  dt: number,
  terrain: TerrainData,
  buildingsById: Map<string, PlacedBuilding>,
  dayFraction: number,
): void {
  // Day shift runs from mid-morning to early evening.
  const onShift = dayFraction > 0.3 && dayFraction < 0.78;

  for (const colonist of colonists) {
    colonist.thinkIn -= dt;

    if (colonist.thinkIn <= 0) {
      // Short intervals keep the colony visibly busy; the jitter stops the
      // whole population re-planning on the same frame.
      colonist.thinkIn = 1.4 + Math.random() * 2.6;

      const destinationId = onShift ? colonist.workId ?? colonist.homeId : colonist.homeId;
      const destination = destinationId ? buildingsById.get(destinationId) : undefined;

      const currentTile = worldToTileIndex(colonist.x, colonist.z);
      const start = nearestWalkable(
        walkable,
        Math.floor((colonist.x + WORLD_HALF) / TILE_SIZE),
        Math.floor((colonist.z + WORLD_HALF) / TILE_SIZE),
        4,
      );

      let goal = -1;
      let arrivingActivity: ColonistActivity = 'Idle';

      if (destination) {
        goal = entranceTile(destination);
        arrivingActivity = onShift && colonist.workId ? 'Working' : 'Resting';
      }

      // Already where they were going, or nowhere to be: pick a nearby spot and
      // stroll to it rather than standing frozen on the same tile forever.
      if (goal < 0 || goal === currentTile) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 2 + Math.random() * WANDER_RADIUS;
        const wanderX = colonist.x + Math.cos(angle) * distance;
        const wanderZ = colonist.z + Math.sin(angle) * distance;
        goal = nearestWalkable(
          walkable,
          Math.floor((wanderX + WORLD_HALF) / TILE_SIZE),
          Math.floor((wanderZ + WORLD_HALF) / TILE_SIZE),
          3,
        );
        arrivingActivity = destination ? arrivingActivity : 'Idle';
      }

      if (goal >= 0 && start >= 0 && goal !== currentTile) {
        const path = findPath(walkable, start, goal);
        if (path && path.length > 1) {
          colonist.path = path;
          colonist.pathIndex = 1;
          colonist.activity = 'Walking';
          // Crews move with purpose on shift and amble off it.
          colonist.paceScale = onShift ? 1 : 0.72;
        } else {
          colonist.path = null;
          colonist.activity = arrivingActivity;
        }
      } else {
        colonist.path = null;
        colonist.activity = arrivingActivity;
      }
    }

    if (colonist.path && colonist.pathIndex < colonist.path.length) {
      const [tx, tz] = tileCentreWorld(colonist.path[colonist.pathIndex]);
      // Offset within the tile so colonists do not walk single file down its centre.
      scratchTarget.set(tx + colonist.wobble, tz + colonist.wobble);

      const dx = scratchTarget.x - colonist.x;
      const dz = scratchTarget.y - colonist.z;
      const distance = Math.hypot(dx, dz);

      if (distance < ARRIVE_EPSILON) {
        colonist.pathIndex++;
        if (colonist.pathIndex >= colonist.path.length) {
          colonist.path = null;
          colonist.activity = onShift && colonist.workId ? 'Working' : 'Resting';
        }
      } else {
        const step = Math.min(distance, colonist.speed * colonist.paceScale * dt);
        colonist.x += (dx / distance) * step;
        colonist.z += (dz / distance) * step;
        colonist.stride += step;

        // Turn toward travel rather than snapping, so corners read as a person
        // pivoting instead of a sprite flipping.
        const desired = Math.atan2(dx, dz);
        let turn = desired - colonist.heading;
        while (turn > Math.PI) turn -= Math.PI * 2;
        while (turn < -Math.PI) turn += Math.PI * 2;
        colonist.heading += turn * Math.min(1, dt * 9);
      }
    }

    colonist.y = terrain.generator.heightAt(colonist.x, colonist.z);
  }
}

/** Look up a colonist by id, for the inspector. */
export function findColonist(id: number): Colonist | undefined {
  return colonists.find((colonist) => colonist.id === id);
}

export function resetColonists(): void {
  colonists.length = 0;
  nextColonistId = 1;
  walkableVersion = -1;
}
