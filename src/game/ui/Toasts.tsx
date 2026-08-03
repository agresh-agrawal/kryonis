'use client';

import { useEffect } from 'react';

import { useToastStore } from '../state/useToastStore';

const TONE = {
  info: 'text-signal',
  good: 'text-dust',
  warn: 'text-warn',
} as const;

/**
 * Transient announcements, bottom-centre-right of the screen.
 *
 * Placed low and to the right so it never lands on the build deck or the left
 * column, and never in the middle of the viewport - the rule that the world owns
 * the centre of the screen holds for these too.
 *
 * Expiry is driven by one timer for the whole stack rather than one per toast.
 * A timer per toast means a component that has to survive its own removal to
 * clear itself, which is where leaks come from.
 */
export function Toasts() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      for (const toast of useToastStore.getState().toasts) {
        if (toast.expiresAt <= now) dismiss(toast.id);
      }
    }, 400);
    return () => window.clearInterval(timer);
  }, [toasts.length, dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-30 flex flex-col items-end gap-2">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => dismiss(toast.id)}
          title="Dismiss"
          className="glass anim-rise press pointer-events-auto flex w-[16rem] flex-col items-start rounded-[3px] px-3.5 py-2.5 text-left"
        >
          <span className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full bg-current ${TONE[toast.tone]}`} />
            <span className={`t-micro ${TONE[toast.tone]}`}>{toast.title}</span>
          </span>
          {toast.detail ? (
            <span className="t-sm mt-1.5 leading-snug text-bone">{toast.detail}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
