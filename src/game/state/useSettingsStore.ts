'use client';

import { create } from 'zustand';

import {
  detectQualityTier,
  getQualitySettings,
  type QualitySettings,
  type QualityTier,
} from '../core/quality';

interface SettingsState {
  /** Tier chosen by hardware detection on first load. */
  autoTier: QualityTier;
  /** Player's explicit choice, or null to follow `autoTier`. */
  override: QualityTier | null;
  /** Whether hardware detection has run yet. */
  detected: boolean;

  detect: () => void;
  setOverride: (tier: QualityTier | null) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  // A middle tier is assumed until the real GPU is known, so the very first
  // frame is never rendered at ultra settings on a netbook.
  autoTier: 'medium',
  override: null,
  detected: false,

  detect: () => {
    if (get().detected) return;
    set({ autoTier: detectQualityTier(), detected: true });
  },

  setOverride: (tier) => set({ override: tier }),
}));

/** The tier actually in force. */
export function useQualityTier(): QualityTier {
  return useSettingsStore((state) => state.override ?? state.autoTier);
}

/** The full settings bundle for the tier in force. */
export function useQuality(): QualitySettings {
  const tier = useQualityTier();
  return getQualitySettings(tier);
}
