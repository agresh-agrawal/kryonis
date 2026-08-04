'use client';

import { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';

import { BUILDING_IDS, getBuildingModel, type BuildingId } from '../buildings/catalog';
import { IMPORTED_MODELS, getImportedModel } from '../buildings/importedModels';
import { SOL_DURATION_SECONDS } from '../core/constants';
import { useColonyStore } from '../state/useColonyStore';
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
        store.setSpeed(0.5);
      } else if (event.code === 'Digit2') {
        store.setSpeed(1);
      } else if (event.code === 'Digit3') {
        store.setSpeed(3);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Development-only hooks. A sol is 24 minutes and research points arrive at a
  // few per minute, so reaching the state you want to *look at* by playing to it
  // is not practical while developing. Never exposed in a production build.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;

    const debug = {
      get sols() {
        return worldClock.sols;
      },
      set sols(value: number) {
        worldClock.sols = value;
      },
      setTimeOfDay(fraction: number) {
        worldClock.sols = Math.floor(worldClock.sols) + fraction;
      },
      /**
       * Triangle cost of every structure's model.
       *
       * The detail kit adds hardware freely because it merges into existing
       * geometry and costs no draw calls - but it does cost triangles, and
       * "costs no draw calls" is not the same as "is free". This is how that
       * claim gets checked rather than assumed.
       */
      tris() {
        const rows = BUILDING_IDS.map((id) => {
          const model = getBuildingModel(id);
          let triangles = 0;
          for (const geometry of Object.values(model)) {
            if (!geometry) continue;
            const index = geometry.getIndex();
            const position = geometry.getAttribute('position');
            triangles += (index ? index.count : (position?.count ?? 0)) / 3;
          }
          return { building: id, triangles: Math.round(triangles), materials: Object.keys(model).length };
        }).sort((a, b) => b.triangles - a.triangles);

        // eslint-disable-next-line no-console
        console.table(rows);
        return {
          total: rows.reduce((sum, r) => sum + r.triangles, 0),
          structures: rows.length,
          heaviest: rows.slice(0, 8),
        };
      },

      /** Which structures ended up on a downloaded model rather than a built one. */
      models() {
        const rows = (Object.keys(IMPORTED_MODELS) as BuildingId[]).map((id) => {
          const model = getImportedModel(id);
          return {
            building: id,
            file: IMPORTED_MODELS[id],
            loaded: Boolean(model),
            materials: model ? Object.keys(model).join(', ') : '-',
          };
        });
        // eslint-disable-next-line no-console
        console.table(rows);
        return `${rows.filter((r) => r.loaded).length}/${rows.length} imported models in use`;
      },

      /** Tops up the ledger so a screen can be exercised without playing to it. */
      grant(bundle: Partial<Record<string, number>>) {
        useColonyStore.setState((state) => {
          const stock = { ...state.stock };
          for (const [id, amount] of Object.entries(bundle)) {
            const key = id as keyof typeof stock;
            if (typeof stock[key] === 'number') stock[key] += amount ?? 0;
          }
          return { stock };
        });
      },
    };

    const target = window as unknown as { kryonisClock?: unknown; kryonisDebug?: unknown };
    target.kryonisClock = debug;
    target.kryonisDebug = debug;
    return () => {
      delete target.kryonisClock;
      delete target.kryonisDebug;
    };
  }, []);

  useFrame((_, rawDelta) => {
    if (!paused) {
      // Clamping matters here: a backgrounded tab can hand back a delta of
      // several seconds, which at 3x would skip most of a sol in one frame.
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
