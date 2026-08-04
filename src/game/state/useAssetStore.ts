'use client';

import { create } from 'zustand';

/**
 * Whether the downloaded models have finished loading.
 *
 * Anything that builds geometry in a `useMemo` runs long before the preload
 * resolves, so without a signal to depend on it would cache the procedural
 * fallback and keep it for the whole session. The buildings solve this by
 * clearing a cache; anything living inside a React component needs a
 * dependency it can actually re-run on, which is what this is.
 */
interface AssetState {
  /** Bumped once the imported models are available. */
  version: number;
  ready: boolean;
  markReady: () => void;
}

export const useAssetStore = create<AssetState>((set) => ({
  version: 0,
  ready: false,
  markReady: () => set((state) => ({ version: state.version + 1, ready: true })),
}));
