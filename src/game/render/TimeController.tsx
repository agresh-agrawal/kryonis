'use client';

import { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';

import { SOL_DURATION_SECONDS } from '../core/constants';
import { dayFraction, useTimeStore, worldClock } from '../state/useTimeStore';
import { currentSun, updateMoons, updateSunState } from '../world/sun';

/**
 * Drives the colony clock.
 *
 * A single component owns the advance of game time so there is exactly one
 * place where speed, pausing and frame-delta clamping are applied. Everything
 * else in the game reads `worldClock` and `currentSun` rather than integrating
 * time itself.
 */
export function TimeController() {
  const paused = useTimeStore((state) => state.paused);
  const speed = useTimeStore((state) => state.speed);

  // Space bar pauses, 1/2/3 pick a speed - the bindings every strategy player
  // tries within the first minute.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;

      const store = useTimeStore.getState();
      if (event.code === 'Space') {
        event.preventDefault();
        store.togglePause();
      } else if (event.code === 'Digit1') {
        store.setSpeed(1);
      } else if (event.code === 'Digit2') {
        store.setSpeed(2);
      } else if (event.code === 'Digit3') {
        store.setSpeed(4);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Development-only hook for jumping the clock. A sol is 24 minutes, so
  // waiting for nightfall to check the night lighting is not practical during
  // development. Never exposed in a production build.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    (window as unknown as { kryonisClock?: unknown }).kryonisClock = {
      get sols() {
        return worldClock.sols;
      },
      set sols(value: number) {
        worldClock.sols = value;
      },
      setTimeOfDay(fraction: number) {
        worldClock.sols = Math.floor(worldClock.sols) + fraction;
      },
    };
    return () => {
      delete (window as unknown as { kryonisClock?: unknown }).kryonisClock;
    };
  }, []);

  useFrame((_, rawDelta) => {
    if (!paused) {
      // Clamping matters here: a backgrounded tab can hand back a delta of
      // several seconds, which at 4x would skip most of a sol in one frame.
      const delta = Math.min(rawDelta, 0.25);
      worldClock.sols += (delta * speed) / SOL_DURATION_SECONDS;
    }

    // The sun and moons still refresh while paused so the scene renders
    // correctly after a load or a manual time change.
    updateSunState(currentSun, dayFraction());
    updateMoons(worldClock.sols, currentSun.nightFactor);
  });

  return null;
}
