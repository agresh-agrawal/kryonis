'use client';

import { create } from 'zustand';

import type { BuildingId } from '../buildings/catalog';

/**
 * Baked preview images for the build deck.
 *
 * Data URLs rather than textures, because the consumer is an `<img>` in the
 * HUD, not something in the 3D scene. They are produced once by
 * `ThumbnailBaker` using the game's own renderer and then never change.
 *
 * `complete` exists so the deck can show its fallback icon without flickering
 * through a half-populated set as the bake trickles in over a few frames.
 */
interface ThumbnailState {
  images: Partial<Record<BuildingId, string>>;
  complete: boolean;

  set: (id: BuildingId, dataUrl: string) => void;
  markComplete: () => void;
  clear: () => void;
}

export const useThumbnailStore = create<ThumbnailState>((set) => ({
  images: {},
  complete: false,

  set: (id, dataUrl) =>
    set((state) => ({ images: { ...state.images, [id]: dataUrl } })),

  markComplete: () => set({ complete: true }),

  clear: () => set({ images: {}, complete: false }),
}));
