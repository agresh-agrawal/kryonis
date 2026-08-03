'use client';

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

import { BUILDINGS } from '../buildings/catalog';
import { useColonyStore } from '../state/useColonyStore';
import { useProgressStore } from '../state/useProgressStore';
import { useSettingsStore } from '../state/useSettingsStore';
import { currentSun } from '../world/sun';
import { audio } from './audio';

/**
 * Drives ambience from world state, and fires one-shots on colony events.
 *
 * Events are detected by comparing against the previous frame's values rather
 * than by hooking every action, so a sound fires whatever caused the change -
 * a building finished by the player, by a load, or by a directive reward all
 * sound the same, which is correct.
 */
export function AudioController() {
  const previous = useRef({ completed: 0, criticalAlerts: 0, research: 0 });
  const throttle = useRef(0);
  const audioEnabled = useSettingsStore((state) => state.audioEnabled);

  // The setting is persisted, so this also applies the stored preference on
  // load rather than starting every session unmuted.
  useEffect(() => {
    audio.setMuted(!audioEnabled);
  }, [audioEnabled]);

  // Unlock on the first real gesture anywhere in the document.
  useEffect(() => {
    const start = () => audio.unlock();
    window.addEventListener('pointerdown', start, { once: true });
    window.addEventListener('keydown', start, { once: true });
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
  }, []);

  useFrame((_, delta) => {
    throttle.current += delta;
    if (throttle.current < 0.25) return;
    throttle.current = 0;

    const colony = useColonyStore.getState();
    const progress = useProgressStore.getState();

    // Wind rises during any event that moves air - dust storms, mainly.
    const storm = progress.events.some((entry) => entry.id === 'dust-storm');
    const wind = storm ? 1 : 0.25;

    // Machinery level tracks how much plant is actually drawing power.
    const machinery = Math.min(1, colony.stats.powerDemand / 120);

    audio.update(wind, currentSun.nightFactor, machinery);

    // --- One-shots ------------------------------------------------------
    const completed = colony.buildings.filter((b) => b.progress >= 1).length;
    if (completed > previous.current.completed && previous.current.completed > 0) {
      audio.play('complete');
    }
    previous.current.completed = completed;

    const critical = colony.stats.alerts.filter((a) => a.severity === 'critical').length;
    if (critical > previous.current.criticalAlerts) audio.play('alert');
    previous.current.criticalAlerts = critical;

    const unlocked = progress.unlocked.size;
    if (unlocked > previous.current.research) audio.play('unlock');
    previous.current.research = unlocked;
  });

  return null;
}

/** Number of distinct completed structure types, used by the codex. */
export function completedTypeCount(): number {
  const seen = new Set<string>();
  for (const building of useColonyStore.getState().buildings) {
    if (building.progress >= 1) seen.add(building.type);
  }
  // The lander is granted, not built, so it never counts as a discovery.
  seen.delete('lander');
  return Math.min(seen.size, Object.keys(BUILDINGS).length);
}
