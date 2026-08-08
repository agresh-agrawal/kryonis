'use client';

import { create } from 'zustand';

import { BUILDING_CATEGORIES, type BuildingCategory, type BuildingId } from '../buildings/catalog';

export type ColonyTool = 'select' | 'build' | 'demolish' | 'road';

/**
 * Tabs across the construction deck.
 *
 * Roads sit alongside the building categories rather than in a chip of their
 * own, because from the player's side they are the same decision: a thing you
 * choose and then place on the ground. That they are painted rather than
 * stamped, and live in a flat grid rather than in the building list, is an
 * implementation detail nobody should have to learn.
 */
export type BuildTab = BuildingCategory | 'Roads';

export const BUILD_TABS: BuildTab[] = [...BUILDING_CATEGORIES, 'Roads'];

interface BuildState {
  tool: ColonyTool;
  /** The structure queued for placement, when the build tool is active. */
  selectedType: BuildingId | null;
  /** Quarter turns applied to the ghost. */
  rotation: number;
  /** Reason the current hover position is invalid, for the cursor readout. */
  hint: string | null;
  hintValid: boolean;
  /** Which tray the construction deck is showing. */
  tab: BuildTab;

  chooseBuilding: (type: BuildingId) => void;
  rotate: () => void;
  setTool: (tool: ColonyTool) => void;
  setHint: (hint: string | null, valid: boolean) => void;
  setTab: (tab: BuildTab) => void;
  cancel: () => void;
}

export const useBuildStore = create<BuildState>((set) => ({
  tool: 'select',
  selectedType: null,
  rotation: 0,
  hint: null,
  hintValid: false,
  tab: 'Habitation',

  chooseBuilding: (type) =>
    set((state) => {
      // Clicking the active building again puts the tool away, which is what
      // players expect from a toggle in a build tray.
      if (state.tool === 'build' && state.selectedType === type) {
        return { tool: 'select', selectedType: null, hint: null };
      }
      return { tool: 'build', selectedType: type, hint: null };
    }),

  rotate: () => set((state) => ({ rotation: (state.rotation + 1) % 4 })),

  setTool: (tool) =>
    set({ tool, selectedType: tool === 'build' ? undefined : null, hint: null } as Partial<BuildState>),

  setHint: (hint, valid) => set({ hint, hintValid: valid }),

  setTab: (tab) => set({ tab }),

  cancel: () => set({ tool: 'select', selectedType: null, hint: null }),
}));
