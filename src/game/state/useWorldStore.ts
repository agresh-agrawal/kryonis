'use client';

import { create } from 'zustand';

import { REGION_TILES } from '../core/constants';
import { hashString } from '../core/rng';
import { generateTerrain, type TerrainConfig, type TerrainData } from '../world/terrain';

/** The site the colony starts on until the new-game flow replaces it. */
const DEFAULT_SITE: Partial<TerrainConfig> = {
  seed: hashString('kryonis-arcadia-planitia'),
  size: REGION_TILES,
  ruggedness: 0.5,
  iceAbundance: 0.55,
  mineralAbundance: 0.5,
  dustiness: 0.45,
};

interface WorldState {
  terrain: TerrainData;
  /** Name of the landing site, shown in the HUD. */
  siteName: string;

  /** Replace the region. Regenerating is cheap - a few milliseconds. */
  loadSite: (config: Partial<TerrainConfig>, siteName: string) => void;
  reset: () => void;
}

export const useWorldStore = create<WorldState>((set) => ({
  terrain: generateTerrain(DEFAULT_SITE),
  siteName: 'Arcadia Planitia',

  loadSite: (config, siteName) =>
    set({ terrain: generateTerrain({ ...DEFAULT_SITE, ...config }), siteName }),
  reset: () => set({ terrain: generateTerrain(DEFAULT_SITE), siteName: 'Arcadia Planitia' }),
}));
