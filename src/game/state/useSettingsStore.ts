'use client';

import { create } from 'zustand';

import {
  detectQualityTier,
  getQualitySettings,
  type QualitySettings,
  type QualityTier,
} from '../core/quality';

const STORAGE_KEY = 'kryonis.settings.v1';

interface PersistedSettings {
  override: QualityTier | null;
  audioEnabled: boolean;
  volume: number;
}

const DEFAULTS: PersistedSettings = {
  override: null,
  audioEnabled: true,
  volume: 0.7,
};

/**
 * Settings live in their own storage key, not in the save.
 *
 * A graphics preference belongs to the machine, not to the colony: a player who
 * turns shadows off because their laptop is struggling means it for every
 * colony they ever start, and resetting the world must not silently put them
 * back to Ultra. Keeping them separate is also what lets `Reset world` and
 * `Reset settings` be two different buttons that do what they say.
 */
function readPersisted(): PersistedSettings {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
    return {
      override: parsed.override ?? null,
      audioEnabled: parsed.audioEnabled ?? DEFAULTS.audioEnabled,
      // Clamped on read: a hand-edited or corrupted value must not be able to
      // produce a volume the audio graph will refuse.
      volume: Math.min(1, Math.max(0, parsed.volume ?? DEFAULTS.volume)),
    };
  } catch {
    return DEFAULTS;
  }
}

function persist(settings: PersistedSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable; settings simply will not survive the session.
  }
}

interface SettingsState extends PersistedSettings {
  /** Tier chosen by hardware detection on first load. */
  autoTier: QualityTier;
  /** Whether hardware detection has run yet. */
  detected: boolean;
  /** Whether stored preferences have been read back yet. */
  hydrated: boolean;

  detect: () => void;
  hydrate: () => void;
  setOverride: (tier: QualityTier | null) => void;
  setAudioEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  // A middle tier is assumed until the real GPU is known, so the very first
  // frame is never rendered at ultra settings on a netbook.
  autoTier: 'medium',
  detected: false,
  hydrated: false,
  ...DEFAULTS,

  detect: () => {
    if (get().detected) return;
    set({ autoTier: detectQualityTier(), detected: true });
  },

  /*
   * Read after mount, never during render. localStorage does not exist on the
   * server, so reading it as an initialiser produces server markup that
   * disagrees with the client and React throws the tree away.
   */
  hydrate: () => {
    if (get().hydrated) return;
    set({ ...readPersisted(), hydrated: true });
  },

  setOverride: (override) => {
    set({ override });
    persist(snapshot(get()));
  },

  setAudioEnabled: (audioEnabled) => {
    set({ audioEnabled });
    persist(snapshot(get()));
  },

  setVolume: (volume) => {
    set({ volume: Math.min(1, Math.max(0, volume)) });
    persist(snapshot(get()));
  },

  resetSettings: () => {
    set({ ...DEFAULTS });
    persist(DEFAULTS);
  },
}));

function snapshot(state: SettingsState): PersistedSettings {
  return { override: state.override, audioEnabled: state.audioEnabled, volume: state.volume };
}

/** The tier actually in force. */
export function useQualityTier(): QualityTier {
  return useSettingsStore((state) => state.override ?? state.autoTier);
}

/** The full settings bundle for the tier in force. */
export function useQuality(): QualitySettings {
  const tier = useQualityTier();
  return getQualitySettings(tier);
}
