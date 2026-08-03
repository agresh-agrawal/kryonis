'use client';

import { useEffect, useState } from 'react';

/**
 * Re-renders the calling component at a fixed low rate.
 *
 * The colony clock and resource totals live outside React and change every
 * frame. HUD panels that display them need to refresh, but refreshing at 60Hz
 * would re-render the interface as fast as the 3D scene for no benefit - a
 * readout of "Sol 3 - 14:32" only needs to change a few times a second.
 */
export function useTicker(hz = 4): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => setTick((value) => value + 1), 1000 / hz);
    return () => window.clearInterval(interval);
  }, [hz]);

  return tick;
}
