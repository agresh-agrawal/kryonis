'use client';

import { create } from 'zustand';

import {
  REGION_TILES,
  START_UNLOCK_RADIUS,
  TILE_SIZE,
  UNLOCK_STEP,
  VALLEY_FLOOR_RADIUS,
  WORLD_HALF,
} from '../core/constants';
import {
  canAfford,
  missingResources,
  startingStock,
  type ResourceBundle,
  type ResourceStock,
} from '../core/resources';
import {
  BUILDINGS,
  MAX_UPGRADE_LEVEL,
  UPGRADE_TIERS,
  rotatedFootprint,
  upgradeCost,
  type BuildingId,
} from '../buildings/catalog';
import {
  DepositKind,
  TerrainKind,
  tileIndex,
  tileToWorld,
  type TerrainData,
} from '../world/terrain';
import { emptyStats, type ColonyStats, type StepResult } from '../sim/simulation';

export interface PlacedBuilding {
  id: string;
  type: BuildingId;
  /** Anchor tile: the minimum corner of the footprint. */
  tx: number;
  tz: number;
  /** Quarter turns clockwise, 0-3. */
  rotation: number;
  /** 0 while under construction, 1 once complete. */
  progress: number;
  /** Player can switch a finished building off without demolishing it. */
  enabled: boolean;
  /** Upgrade tier, 1 to MAX_UPGRADE_LEVEL. */
  level: number;
}

export type PlacementIssue =
  | 'ok'
  | 'outside'
  | 'locked'
  | 'unbuildable'
  | 'occupied'
  | 'relief'
  | 'terrain'
  | 'deposit'
  | 'cost';

export interface PlacementCheck {
  valid: boolean;
  issue: PlacementIssue;
  message: string;
  /** Tile indices covered by the footprint, for highlighting. */
  tiles: number[];
  /** Height the structure would sit at. */
  groundY: number;
}

/**
 * Occupancy grid.
 *
 * Held outside the store as a mutable typed array: it is read once per tile per
 * placement check (which runs every frame while the player drags a ghost across
 * the map) and copying a 4096-entry array on every mutation to satisfy
 * immutability would buy nothing. `buildings` is the reactive value; this is a
 * derived index kept in step with it.
 *
 * Stores building-array-index + 1, so 0 means empty.
 */
const occupancy = new Int32Array(REGION_TILES * REGION_TILES);

/**
 * Live construction progress, 0-1, for structures still going up.
 *
 * Like the occupancy grid this is deliberately outside React. Progress changes
 * every frame and only the 3D scene cares about the in-between values; the
 * store is notified once, when a build finishes.
 */
export const constructionProgress = new Map<string, number>();

export function occupantAt(tx: number, tz: number): number {
  if (tx < 0 || tz < 0 || tx >= REGION_TILES || tz >= REGION_TILES) return 0;
  return occupancy[tz * REGION_TILES + tx];
}

function stampFootprint(building: PlacedBuilding, value: number): void {
  const [w, d] = rotatedFootprint(building.type, building.rotation);
  for (let dz = 0; dz < d; dz++) {
    for (let dx = 0; dx < w; dx++) {
      const tx = building.tx + dx;
      const tz = building.tz + dz;
      if (tx < 0 || tz < 0 || tx >= REGION_TILES || tz >= REGION_TILES) continue;
      occupancy[tz * REGION_TILES + tx] = value;
    }
  }
}

function reindexOccupancy(buildings: PlacedBuilding[]): void {
  occupancy.fill(0);
  buildings.forEach((building, index) => stampFootprint(building, index + 1));
}

/** World-space centre and rotation of a placed building. */
export function buildingTransform(
  terrain: TerrainData,
  building: Pick<PlacedBuilding, 'type' | 'tx' | 'tz' | 'rotation'>,
): { x: number; y: number; z: number; rotationY: number } {
  const [w, d] = rotatedFootprint(building.type, building.rotation);
  const x = (building.tx + w / 2) * TILE_SIZE - WORLD_HALF;
  const z = (building.tz + d / 2) * TILE_SIZE - WORLD_HALF;
  return {
    x,
    y: footprintGroundHeight(terrain, building.tx, building.tz, w, d).high,
    z,
    rotationY: (building.rotation * Math.PI) / 2,
  };
}

/**
 * Highest and lowest terrain under a footprint.
 *
 * Structures are seated at the high point so nothing ever floats; the spread
 * between the two is what `maxRelief` tests against.
 */
function footprintGroundHeight(
  terrain: TerrainData,
  tx: number,
  tz: number,
  w: number,
  d: number,
): { high: number; low: number } {
  let high = -Infinity;
  let low = Infinity;
  for (let dz = 0; dz < d; dz++) {
    for (let dx = 0; dx < w; dx++) {
      const index = tileIndex(terrain, tx + dx, tz + dz);
      if (index < 0) continue;
      const h = terrain.height[index];
      if (h > high) high = h;
      if (h < low) low = h;
    }
  }
  if (high === -Infinity) return { high: 0, low: 0 };
  return { high, low };
}

/** Distance of a tile centre from the colony origin. */
function tileRadius(tx: number, tz: number): number {
  const [x, z] = tileToWorld(tx, tz);
  return Math.hypot(x, z);
}

interface ColonyState {
  buildings: PlacedBuilding[];
  stock: ResourceStock;
  /** Territory is unlocked as an expanding circle from the landing site. */
  unlockedRadius: number;
  selectedId: string | null;

  population: number;
  happiness: number;
  batteryCharge: number;
  /** Latest simulation readout, refreshed a few times a second. */
  stats: ColonyStats;

  /** Applies one simulation step's results. */
  applyStep: (result: StepResult) => void;

  /** Replaces colony state wholesale, as when loading a save. */
  restore: (snapshot: {
    buildings: PlacedBuilding[];
    stock: ResourceStock;
    unlockedRadius: number;
    population: number;
    happiness: number;
    batteryCharge: number;
  }) => void;

  /** Places the starting lander and resets everything else. */
  initialise: (terrain: TerrainData) => void;
  checkPlacement: (
    terrain: TerrainData,
    type: BuildingId,
    tx: number,
    tz: number,
    rotation: number,
  ) => PlacementCheck;
  place: (
    terrain: TerrainData,
    type: BuildingId,
    tx: number,
    tz: number,
    rotation: number,
  ) => boolean;
  demolish: (id: string) => void;
  completeConstruction: (id: string) => void;
  /** Takes a finished structure to its next tier, if the colony can pay. */
  upgrade: (id: string) => boolean;
  select: (id: string | null) => void;
  expandTerritory: () => boolean;
  /** Cost of the next perimeter expansion. */
  nextExpansionCost: () => number;
  spend: (cost: ResourceBundle) => boolean;
}

let nextBuildingId = 1;

export const useColonyStore = create<ColonyState>((set, get) => ({
  buildings: [],
  stock: startingStock(),
  unlockedRadius: START_UNLOCK_RADIUS,
  selectedId: null,

  population: 4,
  happiness: 0.8,
  batteryCharge: 0,
  stats: emptyStats(),

  restore: (snapshot) => {
    // The occupancy grid is derived, so rebuild it from the restored list
    // rather than trusting anything serialised alongside it.
    constructionProgress.clear();
    reindexOccupancy(snapshot.buildings);

    // Anything mid-build resumes from where it left off.
    for (const building of snapshot.buildings) {
      if (building.progress < 1) constructionProgress.set(building.id, building.progress);
    }

    // Ids must never collide with the restored set.
    nextBuildingId =
      snapshot.buildings.reduce((highest, building) => {
        const numeric = Number.parseInt(building.id.replace(/^b/, ''), 10);
        return Number.isFinite(numeric) ? Math.max(highest, numeric) : highest;
      }, 0) + 1;

    set({
      buildings: snapshot.buildings,
      stock: snapshot.stock,
      unlockedRadius: snapshot.unlockedRadius,
      population: snapshot.population,
      happiness: snapshot.happiness,
      batteryCharge: snapshot.batteryCharge,
      selectedId: null,
      stats: emptyStats(),
    });
  },

  applyStep: (result) =>
    set({
      stock: result.stock,
      population: result.population,
      happiness: result.happiness,
      batteryCharge: result.batteryCharge,
      stats: result.stats,
    }),

  initialise: (terrain) => {
    nextBuildingId = 1;
    occupancy.fill(0);

    // Seat the lander on the flattest ground near the centre of the crater.
    const [w, d] = rotatedFootprint('lander', 0);
    let bestTx = Math.floor(REGION_TILES / 2) - 1;
    let bestTz = Math.floor(REGION_TILES / 2) - 1;
    let bestRelief = Infinity;

    const searchRadius = 8;
    const centre = Math.floor(REGION_TILES / 2);
    for (let dz = -searchRadius; dz <= searchRadius; dz++) {
      for (let dx = -searchRadius; dx <= searchRadius; dx++) {
        const tx = centre + dx;
        const tz = centre + dz;

        let buildable = true;
        for (let fz = 0; fz < d && buildable; fz++) {
          for (let fx = 0; fx < w; fx++) {
            const index = tileIndex(terrain, tx + fx, tz + fz);
            if (index < 0 || !terrain.buildable[index]) {
              buildable = false;
              break;
            }
          }
        }
        if (!buildable) continue;

        const { high, low } = footprintGroundHeight(terrain, tx, tz, w, d);
        const relief = high - low + Math.hypot(dx, dz) * 0.04;
        if (relief < bestRelief) {
          bestRelief = relief;
          bestTx = tx;
          bestTz = tz;
        }
      }
    }

    const lander: PlacedBuilding = {
      id: `b${nextBuildingId++}`,
      type: 'lander',
      tx: bestTx,
      tz: bestTz,
      rotation: 0,
      progress: 1,
      enabled: true,
      level: 1,
    };

    const buildings = [lander];
    reindexOccupancy(buildings);

    set({
      buildings,
      stock: startingStock(),
      unlockedRadius: START_UNLOCK_RADIUS,
      selectedId: null,
      population: 4,
      happiness: 0.8,
      batteryCharge: 0,
      stats: emptyStats(),
    });
  },

  checkPlacement: (terrain, type, tx, tz, rotation) => {
    const def = BUILDINGS[type];
    const [w, d] = rotatedFootprint(type, rotation);
    const { unlockedRadius, stock } = get();

    const tiles: number[] = [];
    let high = -Infinity;
    let low = Infinity;
    let hasDeposit = false;
    let allRequiredTerrain = true;

    for (let dz = 0; dz < d; dz++) {
      for (let dx = 0; dx < w; dx++) {
        const cx = tx + dx;
        const cz = tz + dz;
        const index = tileIndex(terrain, cx, cz);

        if (index < 0) {
          return {
            valid: false,
            issue: 'outside',
            message: 'Outside the surveyed region',
            tiles,
            groundY: 0,
          };
        }
        tiles.push(index);

        if (tileRadius(cx, cz) > unlockedRadius) {
          return {
            valid: false,
            issue: 'locked',
            message: 'Outside your claimed perimeter',
            tiles,
            groundY: 0,
          };
        }

        if (!terrain.buildable[index]) {
          const kind = terrain.kind[index] as TerrainKind;
          return {
            valid: false,
            issue: 'unbuildable',
            message:
              kind === TerrainKind.Cliff
                ? 'Ground is too steep'
                : 'Basalt flow cannot be built on',
            tiles,
            groundY: 0,
          };
        }

        if (occupancy[cz * REGION_TILES + cx] !== 0) {
          return { valid: false, issue: 'occupied', message: 'Ground already occupied', tiles, groundY: 0 };
        }

        if (def.requiresTerrain && !def.requiresTerrain.includes(terrain.kind[index] as TerrainKind)) {
          allRequiredTerrain = false;
        }
        if (def.requiresDeposit && def.requiresDeposit.includes(terrain.deposit[index] as DepositKind)) {
          hasDeposit = true;
        }

        const h = terrain.height[index];
        if (h > high) high = h;
        if (h < low) low = h;
      }
    }

    if (def.requiresTerrain && !allRequiredTerrain) {
      return {
        valid: false,
        issue: 'terrain',
        message: 'Must be built entirely on an ice field',
        tiles,
        groundY: high,
      };
    }

    if (def.requiresDeposit && !hasDeposit) {
      return {
        valid: false,
        issue: 'deposit',
        message: 'No mineral deposit here',
        tiles,
        groundY: high,
      };
    }

    if (high - low > def.maxRelief) {
      return {
        valid: false,
        issue: 'relief',
        message: 'Ground is too uneven for this structure',
        tiles,
        groundY: high,
      };
    }

    if (!canAfford(stock, def.cost)) {
      const missing = missingResources(stock, def.cost);
      const names = Object.keys(missing).join(', ');
      return { valid: false, issue: 'cost', message: `Not enough ${names}`, tiles, groundY: high };
    }

    return { valid: true, issue: 'ok', message: def.name, tiles, groundY: high };
  },

  place: (terrain, type, tx, tz, rotation) => {
    const check = get().checkPlacement(terrain, type, tx, tz, rotation);
    if (!check.valid) return false;

    const def = BUILDINGS[type];
    const building: PlacedBuilding = {
      id: `b${nextBuildingId++}`,
      type,
      tx,
      tz,
      rotation,
      // Construction is instant for free structures, timed for everything else.
      progress: def.buildTime <= 0 ? 1 : 0,
      enabled: true,
      level: 1,
    };

    if (building.progress < 1) constructionProgress.set(building.id, 0);

    set((state) => {
      const buildings = [...state.buildings, building];
      stampFootprint(building, buildings.length);

      const stock = { ...state.stock };
      for (const [id, amount] of Object.entries(def.cost) as [keyof ResourceStock, number][]) {
        stock[id] -= amount;
      }

      return { buildings, stock };
    });

    return true;
  },

  demolish: (id) => {
    constructionProgress.delete(id);
    set((state) => {
      const buildings = state.buildings.filter((building) => building.id !== id);
      reindexOccupancy(buildings);
      return {
        buildings,
        selectedId: state.selectedId === id ? null : state.selectedId,
      };
    });
  },

  upgrade: (id) => {
    const state = get();
    const building = state.buildings.find((entry) => entry.id === id);
    if (!building || building.progress < 1) return false;
    if (building.level >= MAX_UPGRADE_LEVEL) return false;

    const cost = upgradeCost(building.type, building.level);
    if (!canAfford(state.stock, cost)) return false;

    const stock = { ...state.stock };
    for (const [resource, amount] of Object.entries(cost) as [keyof ResourceStock, number][]) {
      stock[resource] -= amount;
    }

    // The structure goes back under construction while the retrofit is fitted,
    // so an upgrade costs downtime as well as money.
    const tier = UPGRADE_TIERS[building.level];
    constructionProgress.set(id, 0);

    set({
      stock,
      buildings: state.buildings.map((entry) =>
        entry.id === id
          ? { ...entry, level: entry.level + 1, progress: tier.buildTime > 0 ? 0 : 1 }
          : entry,
      ),
    });

    return true;
  },

  completeConstruction: (id) => {
    constructionProgress.delete(id);
    set((state) => ({
      buildings: state.buildings.map((building) =>
        building.id === id ? { ...building, progress: 1 } : building,
      ),
    }));
  },

  select: (id) => set({ selectedId: id }),

  nextExpansionCost: () => {
    const steps = Math.round((get().unlockedRadius - START_UNLOCK_RADIUS) / UNLOCK_STEP);
    // Each ring is larger than the last, so each costs more.
    return Math.round(2000 * Math.pow(1.55, steps));
  },

  expandTerritory: () => {
    const { unlockedRadius, stock, nextExpansionCost } = get();
    if (unlockedRadius >= VALLEY_FLOOR_RADIUS) return false;

    const cost = nextExpansionCost();
    if (stock.money < cost) return false;

    set({
      unlockedRadius: Math.min(VALLEY_FLOOR_RADIUS, unlockedRadius + UNLOCK_STEP),
      stock: { ...stock, money: stock.money - cost },
    });
    return true;
  },

  spend: (cost) => {
    const { stock } = get();
    if (!canAfford(stock, cost)) return false;
    const next = { ...stock };
    for (const [id, amount] of Object.entries(cost) as [keyof ResourceStock, number][]) {
      next[id] -= amount;
    }
    set({ stock: next });
    return true;
  },
}));

/** True once the perimeter covers the whole crater floor. */
export function isFullyExpanded(radius: number): boolean {
  return radius >= VALLEY_FLOOR_RADIUS;
}
