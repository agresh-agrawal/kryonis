'use client';

import { create } from 'zustand';

import { SEALED_ROAD_RESEARCH } from '../progress/research';
import {
  NO_ROAD,
  ROAD_GRADES,
  ROAD_SALVAGE,
  roadTileCost,
  type RoadGrade,
} from '../world/roadGrades';
import {
  clearRoads,
  currentNetworks,
  gradeAt,
  hasRoad,
  listRoadGrades,
  listRoadTiles,
  restoreRoads,
  setRoad,
  solveNetworks,
  type RoadNetworks,
} from '../world/roads';
import { tileIndex, tileToWorld } from '../world/terrain';
import { occupantAt, useColonyStore } from './useColonyStore';
import { useProgressStore } from './useProgressStore';
import { useWorldStore } from './useWorldStore';

/**
 * The React-facing handle on the road network.
 *
 * The grid itself lives in flat typed arrays outside React - it is read every
 * simulation tick and rebuilt whenever anything changes, which is not something
 * to route through a store. What the interface actually needs is far smaller:
 * a version number to re-render on, the network summary, and which grade the
 * player currently has selected.
 */

/** Why a tile will not take a road. `null` means it will. */
export type RoadRefusal =
  | 'outside'
  | 'locked'
  | 'unbuildable'
  | 'occupied'
  | 'cost'
  | 'locked-grade'
  | 'already';

export const ROAD_REFUSAL_TEXT: Record<RoadRefusal, string> = {
  outside: 'Outside the surveyed region',
  locked: 'Outside your claimed perimeter',
  unbuildable: 'Ground is too steep to grade',
  occupied: 'A structure is standing here',
  cost: 'Not enough credits',
  'locked-grade': 'Requires Sealed Roadbed research',
  already: 'Already laid to this grade',
};

interface RoadState {
  /** Bumped whenever the grid changes, so views can depend on it. */
  version: number;
  networks: RoadNetworks;
  /** Whether the utility overlay is being shown. */
  showUtilities: boolean;
  /** The grade the road tool is currently laying. */
  grade: RoadGrade;

  /** Lays or upgrades a tile to the current grade. Returns why it was refused. */
  lay: (tx: number, tz: number) => RoadRefusal | null;
  /** Removes road from a tile, refunding half of what that grade cost. */
  remove: (tx: number, tz: number) => boolean;
  /** Tests a tile without laying anything, for the hover readout. */
  check: (tx: number, tz: number) => RoadRefusal | null;
  /** Recomputes networks after buildings change. */
  resolve: () => void;
  setShowUtilities: (show: boolean) => void;
  setGrade: (grade: RoadGrade) => void;
  restore: (tiles: number[], grades?: number[]) => void;
  reset: () => void;
}

/** Whether the colony has researched what a grade needs. */
export function gradeUnlocked(grade: RoadGrade): boolean {
  const required = ROAD_GRADES[grade].unlockedBy;
  if (!required) return true;
  return useProgressStore.getState().unlocked.has(required);
}

/**
 * Whether a tile will accept the given grade.
 *
 * Roads used to be laid with no checks at all: you could paint one across a
 * cliff, through the middle of a habitat, or ten tiles outside the perimeter
 * you had actually paid for. Structures are checked against all three, and a
 * road is a structure in every sense that matters here.
 */
function checkTile(tx: number, tz: number, grade: RoadGrade): RoadRefusal | null {
  if (!gradeUnlocked(grade)) return 'locked-grade';

  const terrain = useWorldStore.getState().terrain;
  const index = tileIndex(terrain, tx, tz);
  if (index < 0) return 'outside';

  const existing = gradeAt(tx, tz);
  const cost = roadTileCost(existing, grade);
  if (cost === null) return 'already';

  // An occupied tile is fine only if the occupant is a road structure left over
  // from an older save; anything else is a building standing on the ground.
  if (existing === NO_ROAD && occupantAt(tx, tz) !== 0) return 'occupied';

  if (!terrain.buildable[index]) return 'unbuildable';

  const [x, z] = tileToWorld(tx, tz);
  if (Math.hypot(x, z) > useColonyStore.getState().unlockedRadius) return 'locked';

  if (useColonyStore.getState().stock.money < cost) return 'cost';

  return null;
}

export const useRoadStore = create<RoadState>((set, get) => ({
  version: 0,
  networks: currentNetworks(),
  showUtilities: false,
  grade: 1,

  check: (tx, tz) => checkTile(tx, tz, get().grade),

  lay: (tx, tz) => {
    const grade = get().grade;
    const refusal = checkTile(tx, tz, grade);
    if (refusal) return refusal;

    // `checkTile` already proved this is non-null and affordable.
    const cost = roadTileCost(gradeAt(tx, tz), grade) ?? 0;
    if (!useColonyStore.getState().spend({ money: cost })) return 'cost';
    if (!setRoad(tx, tz, grade)) return 'already';

    const networks = solveNetworks(useColonyStore.getState().buildings);
    set((state) => ({ version: state.version + 1, networks }));
    return null;
  },

  remove: (tx, tz) => {
    const existing = gradeAt(tx, tz);
    if (!hasRoad(tx, tz)) return false;
    if (!setRoad(tx, tz, NO_ROAD)) return false;

    // Half back, the same salvage rule demolition uses - and half of what this
    // particular tile cost, so ripping up a sealed way is worth more than
    // ripping up a service road.
    const refund = (ROAD_GRADES[existing as RoadGrade]?.cost ?? 0) * ROAD_SALVAGE;
    useColonyStore.setState((state) => ({
      stock: { ...state.stock, money: state.stock.money + refund },
    }));

    const networks = solveNetworks(useColonyStore.getState().buildings);
    set((state) => ({ version: state.version + 1, networks }));
    return true;
  },

  resolve: () => {
    const networks = solveNetworks(useColonyStore.getState().buildings);
    set((state) => ({ version: state.version + 1, networks }));
  },

  setShowUtilities: (showUtilities) => set({ showUtilities }),

  setGrade: (grade) => set({ grade }),

  restore: (tiles, grades) => {
    restoreRoads(tiles, grades);
    const networks = solveNetworks(useColonyStore.getState().buildings);
    set((state) => ({ version: state.version + 1, networks }));
  },

  reset: () => {
    clearRoads();
    set((state) => ({ version: state.version + 1, networks: currentNetworks(), grade: 1 }));
  },
}));

/** Road tiles as flat indices, for the save file. */
export function captureRoads(): number[] {
  return listRoadTiles();
}

/** Grades for those tiles, in the same order. */
export function captureRoadGrades(): number[] {
  return listRoadGrades();
}
