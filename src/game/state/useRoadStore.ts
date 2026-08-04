'use client';

import { create } from 'zustand';

import { ROAD_COST } from '../core/constants';
import {
  clearRoads,
  currentNetworks,
  hasRoad,
  listRoadTiles,
  restoreRoads,
  setRoad,
  solveNetworks,
  type RoadNetworks,
} from '../world/roads';
import { useColonyStore } from './useColonyStore';

/**
 * The React-facing handle on the road network.
 *
 * The grid itself lives in flat typed arrays outside React - it is read every
 * simulation tick and rebuilt whenever anything changes, which is not something
 * to route through a store. What the interface actually needs is far smaller:
 * a version number to re-render on, and the network summary.
 */
interface RoadState {
  /** Bumped whenever the grid changes, so views can depend on it. */
  version: number;
  networks: RoadNetworks;
  /** Whether the utility overlay is being shown. */
  showUtilities: boolean;

  /** Lays road on a tile. Returns false if it was refused. */
  lay: (tx: number, tz: number) => boolean;
  /** Removes road from a tile, refunding half. */
  remove: (tx: number, tz: number) => boolean;
  /** Recomputes networks after buildings change. */
  resolve: () => void;
  setShowUtilities: (show: boolean) => void;
  restore: (tiles: number[]) => void;
  reset: () => void;
}

export const useRoadStore = create<RoadState>((set, get) => ({
  version: 0,
  networks: currentNetworks(),
  showUtilities: false,

  lay: (tx, tz) => {
    if (hasRoad(tx, tz)) return false;

    const colony = useColonyStore.getState();
    if (!colony.spend({ money: ROAD_COST })) return false;
    if (!setRoad(tx, tz, true)) return false;

    const networks = solveNetworks(useColonyStore.getState().buildings);
    set((state) => ({ version: state.version + 1, networks }));
    return true;
  },

  remove: (tx, tz) => {
    if (!hasRoad(tx, tz)) return false;
    if (!setRoad(tx, tz, false)) return false;

    // Half back, the same salvage rule demolition uses.
    useColonyStore.setState((state) => ({
      stock: { ...state.stock, money: state.stock.money + ROAD_COST * 0.5 },
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

  restore: (tiles) => {
    restoreRoads(tiles);
    const networks = solveNetworks(useColonyStore.getState().buildings);
    set((state) => ({ version: state.version + 1, networks }));
  },

  reset: () => {
    clearRoads();
    set((state) => ({ version: state.version + 1, networks: currentNetworks() }));
  },
}));

/** Road tiles as flat indices, for the save file. */
export function captureRoads(): number[] {
  return listRoadTiles();
}
