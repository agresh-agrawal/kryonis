'use client';

import {
  GAME_SPEEDS,
  SPEED_LABEL,
  dayFraction,
  solNumber,
  useTimeStore,
} from '../state/useTimeStore';
import { formatSolTime } from '../world/sun';
import { useTicker } from './useTicker';

/** What each tempo is for, in the tooltip. */
const SPEED_HINT: Record<number, string> = {
  0.5: 'Half speed - watch the detail',
  1: 'Normal speed',
  3: 'Fast forward',
};

/**
 * Time.
 *
 * The highest-priority control in the game and therefore the smallest one that
 * can still be hit reliably. A ring of four states with no labels: the sol and
 * clock read as one continuous number, and the transport controls are shapes
 * every player already knows.
 *
 * The day marker under the clock is a thin arc of the sol elapsed - a glance
 * tells you how long until dark without a word of text.
 */
export function TimePill() {
  useTicker(6);

  const paused = useTimeStore((state) => state.paused);
  const speed = useTimeStore((state) => state.speed);
  const setSpeed = useTimeStore((state) => state.setSpeed);
  const togglePause = useTimeStore((state) => state.togglePause);

  const fraction = dayFraction();
  const isNight = fraction < 0.24 || fraction > 0.76;

  return (
    <div className="glass anim-fade pointer-events-auto flex items-center gap-2 rounded-[3px] px-2 py-1.5 min-[1180px]:gap-3 min-[1180px]:px-3 min-[1180px]:py-2">
      <div className="flex min-w-[3.8rem] flex-col">
        <span className="t-micro">Sol {solNumber()}</span>
        <span className="t-num mt-1 text-[1.05rem] leading-none text-bone">
          {formatSolTime(fraction)}
        </span>
        {/* Day progress: a hairline that fills across the sol. */}
        <span className="mt-1.5 block h-px w-full bg-white/10">
          <span
            className={`block h-px transition-[width] duration-1000 ${
              isNight ? 'bg-signal/60' : 'bg-dust/70'
            }`}
            style={{ width: `${fraction * 100}%` }}
          />
        </span>
      </div>

      <span className="rule-y hidden h-8 min-[980px]:block" />

      <div className="flex items-center gap-0.5">
        <Transport
          active={paused}
          label={paused ? 'Resume' : 'Pause'}
          onClick={togglePause}
          path={paused ? 'M3 2l8 5-8 5z' : 'M3 2h2.6v10H3zM8.4 2H11v10H8.4z'}
        />
        {GAME_SPEEDS.map((value, index) => (
          <button
            key={value}
            type="button"
            onClick={() => setSpeed(value)}
            aria-pressed={!paused && speed === value}
            aria-label={`${value}x speed`}
            title={`${SPEED_HINT[value]} (${index + 1})`}
            className={`press h-7 w-7 rounded-[2px] text-[0.72rem] transition-colors min-[1180px]:h-8 min-[1180px]:w-8 min-[1180px]:text-[0.78rem] ${
              !paused && speed === value
                ? 'bg-white/10 text-dust'
                : 'text-titanium hover:bg-white/5 hover:text-bone'
            }`}
          >
            {SPEED_LABEL[value]}
            <span className="text-[0.62em] opacity-70">×</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Transport({
  active,
  label,
  onClick,
  path,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  path: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={`${label} (Space)`}
      className={`press grid h-7 w-7 place-items-center rounded-[2px] transition-colors min-[1180px]:h-8 min-[1180px]:w-8 ${
        active ? 'bg-white/10 text-dust' : 'text-titanium hover:bg-white/5 hover:text-bone'
      }`}
    >
      <svg viewBox="0 0 14 14" className="h-3 w-3 fill-current" aria-hidden>
        <path d={path} />
      </svg>
    </button>
  );
}
