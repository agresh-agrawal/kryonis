'use client';

import { create } from 'zustand';

/**
 * The three tempos, plus pause.
 *
 * Half speed exists so a player can watch a shift change or a construction
 * finish without the sol running away from them; 3x is the "nothing is
 * happening, get me to morning" speed. Anything faster desynchronises the
 * colonist animation from the simulation badly enough to look broken.
 */
export type GameSpeed = 0.5 | 1 | 3;

export const GAME_SPEEDS: GameSpeed[] = [0.5, 1, 3];

/** How each speed is written on its button. */
export const SPEED_LABEL: Record<GameSpeed, string> = {
  0.5: '½',
  1: '1',
  3: '3',
};

/**
 * The colony clock, measured in sols since landing.
 *
 * Held outside React because it advances every frame; the simulation and the
 * sun read it directly. Anything the player can *change* about time - the speed
 * multiplier, whether we are paused - lives in the store below, because those
 * change rarely and the HUD needs to re-render when they do.
 */
export const worldClock = {
  /** Elapsed sols. The fractional part is the time of day. */
  sols: 0.3,
};

/** Time of day in [0, 1): 0 midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset. */
export function dayFraction(): number {
  return worldClock.sols - Math.floor(worldClock.sols);
}

/** Whole sols elapsed, as shown in the HUD. */
export function solNumber(): number {
  return Math.floor(worldClock.sols) + 1;
}

interface TimeState {
  paused: boolean;
  speed: GameSpeed;

  setSpeed: (speed: GameSpeed) => void;
  setPaused: (paused: boolean) => void;
  togglePause: () => void;
  reset: () => void;
}

export const useTimeStore = create<TimeState>((set) => ({
  paused: false,
  speed: 1,

  // Choosing a speed also un-pauses; players expect clicking "2x" to start time.
  setSpeed: (speed) => set({ speed, paused: false }),
  setPaused: (paused) => set({ paused }),
  togglePause: () => set((state) => ({ paused: !state.paused })),
  reset: () => {
    worldClock.sols = 0.3;
    set({ paused: false, speed: 1 });
  },
}));

/** Effective multiplier applied to real time, 0 while paused. */
export function effectiveSpeed(state: TimeState): number {
  return state.paused ? 0 : state.speed;
}
