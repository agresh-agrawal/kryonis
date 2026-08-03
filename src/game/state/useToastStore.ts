'use client';

import { create } from 'zustand';

/**
 * Transient announcements.
 *
 * Distinct from `Notifications`, which is derived state: a notice exists for as
 * long as the condition causing it exists, and disappears when the player fixes
 * it. A toast is the opposite - it marks a *moment* ("research complete",
 * "directive paid") that has no ongoing condition to derive from, so it has to
 * be pushed and then expire on its own.
 *
 * Kept deliberately small. Three at a time, oldest dropped: a stack of toasts
 * tall enough to need scrolling has stopped being an announcement and become a
 * log, and the codex is the place for logs.
 */

export type ToastTone = 'info' | 'good' | 'warn';

export interface Toast {
  id: number;
  title: string;
  detail?: string;
  tone: ToastTone;
  /** Wall-clock ms at which the toast should disappear. */
  expiresAt: number;
}

const MAX_VISIBLE = 3;
const LIFETIME_MS = 6000;

let nextToastId = 1;

interface ToastState {
  toasts: Toast[];
  push: (toast: { title: string; detail?: string; tone?: ToastTone }) => void;
  dismiss: (id: number) => void;
  clear: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  push: ({ title, detail, tone = 'info' }) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { id: nextToastId++, title, detail, tone, expiresAt: Date.now() + LIFETIME_MS },
      ].slice(-MAX_VISIBLE),
    })),

  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  clear: () => set({ toasts: [] }),
}));

/**
 * Pushes a toast from outside React.
 *
 * The progress store runs inside the simulation tick, which is not a component
 * and has no hooks available to it.
 */
export function announce(title: string, detail?: string, tone: ToastTone = 'info'): void {
  useToastStore.getState().push({ title, detail, tone });
}
