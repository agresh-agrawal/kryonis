'use client';

import { useEffect, type ReactNode } from 'react';

import { dayFraction, solNumber } from '../state/useTimeStore';
import { formatSolTime } from '../world/sun';
import { useTicker } from './useTicker';

/**
 * The full-screen console shell.
 *
 * Four screens in the game are not glances - crew, research, territory and the
 * codex are all "sit down and think" work, and trying to do them in a 17rem rail
 * beside a live 3D scene meant unreadable type and panels stacking on top of one
 * another. These take the whole viewport instead and hide the world outright.
 *
 * Hiding the world is the point, not a side effect. A management screen that
 * leaves Mars visible behind it asks the player to keep half an eye on the
 * colony; taking it away says "this is the only thing you are doing now". The
 * clock stays in the header precisely because the world is gone - time is still
 * passing and the player must be able to see it.
 *
 * The radar sweep behind the content is doing a job as well as looking like
 * something: it is the only moving thing on screen once the 3D scene is hidden,
 * and without it the console reads as a document rather than an instrument.
 */
export function Console({
  title,
  legend,
  onClose,
  actions,
  children,
}: {
  title: string;
  legend: string;
  onClose: () => void;
  /** Optional controls pinned to the header, right of the title. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  useTicker(2);

  // Escape closes, from anywhere, unless the player is mid-way through typing.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="anim-fade pointer-events-auto absolute inset-0 z-40 flex flex-col bg-void/97 backdrop-blur-2xl">
      <ConsoleBackdrop />

      <header className="relative z-10 flex shrink-0 items-center justify-between gap-6 px-6 pb-4 pt-5 min-[1180px]:px-10 min-[1180px]:pb-5 min-[1180px]:pt-7">
        <div className="min-w-0">
          <h1 className="text-[1.5rem] leading-none font-light tracking-[0.4em] text-bone min-[1180px]:text-[1.85rem]">
            {title}
          </h1>
          <p className="t-micro mt-2.5 text-steel">{legend}</p>
        </div>

        <div className="flex shrink-0 items-center gap-3 min-[1180px]:gap-5">
          {actions}

          {/*
            The clock. Present because the world is hidden: without it a player
            can spend a minute hiring crew and not notice a sol went by.
          */}
          <div className="hidden flex-col items-end min-[900px]:flex">
            <span className="t-micro">Sol {solNumber()}</span>
            <span className="t-num mt-1.5 text-[0.95rem] leading-none text-ash">
              {formatSolTime(dayFraction())}
            </span>
          </div>

          <span className="rule-y hidden h-9 min-[900px]:block" />

          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title.toLowerCase()}`}
            title="Close (Esc)"
            className="press glass grid h-10 w-10 place-items-center rounded-[3px] text-titanium hover:text-bone min-[1180px]:h-11 min-[1180px]:w-11"
          >
            <svg viewBox="0 0 12 12" className="h-3 w-3 fill-current" aria-hidden>
              <path d="M2.4 1.3L6 4.9l3.6-3.6 1.1 1.1L7.1 6l3.6 3.6-1.1 1.1L6 7.1l-3.6 3.6-1.1-1.1L4.9 6 1.3 2.4z" />
            </svg>
          </button>
        </div>
      </header>

      <span className="rule-x relative z-10 mx-6 shrink-0 min-[1180px]:mx-10" />

      <div className="quiet-scroll relative z-10 min-h-0 flex-1 overflow-y-auto px-6 py-5 min-[1180px]:px-10 min-[1180px]:py-7">
        <div className="mx-auto w-full max-w-[112rem]">{children}</div>
      </div>
    </div>
  );
}

/** The sweeping radar behind every console. Decorative, deliberately faint. */
function ConsoleBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute left-1/2 top-1/2 h-[124vmax] w-[124vmax] -translate-x-1/2 -translate-y-1/2 opacity-[0.16]">
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full">
          {[28, 52, 76, 96].map((r) => (
            <circle
              key={r}
              cx="100"
              cy="100"
              r={r}
              fill="none"
              stroke="var(--color-dust)"
              strokeWidth="0.22"
            />
          ))}
          <line x1="4" y1="100" x2="196" y2="100" stroke="var(--color-dust)" strokeWidth="0.16" />
          <line x1="100" y1="4" x2="100" y2="196" stroke="var(--color-dust)" strokeWidth="0.16" />
        </svg>

        {/* The sweep itself: one conic wedge, rotating slowly. */}
        <div
          className="animate-[radar-sweep_7s_linear_infinite] absolute inset-0 rounded-full"
          style={{
            background:
              'conic-gradient(from 0deg, transparent 0deg, transparent 300deg, color-mix(in oklab, var(--color-dust) 55%, transparent) 358deg, transparent 360deg)',
          }}
        />
      </div>

      {/* Vignette, so the sweep never competes with the content in the middle. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(12_10_9_/_0.86)_38%,rgb(12_10_9_/_0.99))]" />
    </div>
  );
}

/**
 * A titled block within a console.
 *
 * Consoles are wide, and a wide screen with no internal structure is worse to
 * read than a narrow one. Everything inside a console goes in one of these.
 */
export function ConsoleSection({
  title,
  hint,
  children,
  className = '',
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="flex items-baseline justify-between gap-4 pb-2.5">
        <h2 className="t-micro text-steel">{title}</h2>
        {hint ? <span className="t-sm text-faint">{hint}</span> : null}
      </div>
      <span className="rule-x mb-3.5 block" />
      {children}
    </section>
  );
}

/**
 * A single number with a label.
 *
 * Deliberately not `text-faint` on the value: these are the figures a player
 * makes decisions from, and dimming them to fit the ambient look was exactly
 * the readability problem this pass exists to fix.
 */
export function Readout({
  label,
  value,
  tone = 'normal',
  note,
}: {
  label: string;
  value: string;
  tone?: 'normal' | 'good' | 'warn' | 'alert' | 'accent';
  note?: string;
}) {
  const toneClass = {
    normal: 'text-bone',
    good: 'text-good',
    warn: 'text-warn',
    alert: 'text-alert',
    accent: 'text-dust',
  }[tone];

  return (
    <div className="rounded-[3px] border border-white/[0.07] bg-white/[0.03] px-3.5 py-3">
      <span className="t-micro block">{label}</span>
      <span className={`t-num mt-2 block text-[1.15rem] leading-none ${toneClass}`}>{value}</span>
      {note ? <span className="t-sm mt-2 block text-ash">{note}</span> : null}
    </div>
  );
}
