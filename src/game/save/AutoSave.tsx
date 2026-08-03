'use client';

import { useEffect } from 'react';

import { saveNow } from './useSaveGame';

/** Real seconds between autosaves. */
const AUTOSAVE_INTERVAL = 45;

/**
 * Autosave.
 *
 * Saves on a wall-clock timer rather than on game time, so a paused or slowed
 * colony still gets written; and again on `pagehide`, which is the one event
 * that fires reliably when a tab is closed or backgrounded on mobile.
 *
 * This component deliberately does **not** restore a save. It used to, guarded
 * by "only if the colony has at most one building" - but a freshly founded
 * colony has exactly one, the lander. So choosing a new landing site and
 * pressing begin would immediately load the previous colony over the top of it.
 * Restoring is now an explicit choice on the opening screen, which is where a
 * decision that discards a game belongs.
 */
export function AutoSave() {
  useEffect(() => {
    const timer = window.setInterval(saveNow, AUTOSAVE_INTERVAL * 1000);

    const flush = () => saveNow();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  return null;
}
