'use client';

import { VALLEY_FLOOR_RADIUS } from '../core/constants';
import { formatAmount } from '../core/resources';
import { useBuildStore } from '../state/useBuildStore';
import { useColonyStore } from '../state/useColonyStore';

/**
 * Territory and the demolish toggle.
 *
 * Two controls that used to occupy a full toolbar, reduced to one chip. The
 * claim is a ring rather than a percentage bar because it describes a circular
 * crater - the shape of the readout matches the shape of the thing.
 *
 * The chip no longer *performs* the expansion; it reports the claim and opens
 * the territory console. Buying land off a two-line chip meant committing
 * thousands of credits with no idea what was in the band being bought.
 */
export function TerritoryChip({ onOpen }: { onOpen: () => void }) {
  const tool = useBuildStore((state) => state.tool);
  const setTool = useBuildStore((state) => state.setTool);
  const cancel = useBuildStore((state) => state.cancel);

  const unlockedRadius = useColonyStore((state) => state.unlockedRadius);
  const money = useColonyStore((state) => state.stock.money);
  const nextExpansionCost = useColonyStore((state) => state.nextExpansionCost);

  const atMaximum = unlockedRadius >= VALLEY_FLOOR_RADIUS;
  const cost = nextExpansionCost();
  const affordable = money >= cost;
  const claimed = Math.min(1, unlockedRadius / VALLEY_FLOOR_RADIUS);

  const circumference = 2 * Math.PI * 13;

  return (
    <div className="glass anim-fade pointer-events-auto flex items-center gap-2.5 rounded-[3px] px-2.5 py-2">
      <span className="relative grid h-8 w-8 place-items-center" title="Crater floor claimed">
        <svg viewBox="0 0 32 32" className="absolute inset-0 h-full w-full -rotate-90">
          <circle cx="16" cy="16" r="13" fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="2" />
          <circle
            cx="16"
            cy="16"
            r="13"
            fill="none"
            stroke="var(--color-dust)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={`${circumference * claimed} ${circumference}`}
            className="transition-[stroke-dasharray] duration-700"
          />
        </svg>
        <span className="t-num text-[0.55rem] text-ash">{Math.round(claimed * 100)}</span>
      </span>

      <button
        type="button"
        onClick={onOpen}
        title={
          atMaximum
            ? 'The whole crater floor is claimed - open the survey'
            : `Survey and claim the next band, ${formatAmount(cost)} credits`
        }
        className="press flex flex-col items-start rounded-[2px] px-1 py-0.5 text-ash transition-colors hover:text-bone"
      >
        <span className="t-micro">Perimeter</span>
        <span className={`t-num mt-1 text-[0.72rem] ${affordable && !atMaximum ? 'text-dust' : ''}`}>
          {atMaximum ? 'Complete' : `Survey · ${formatAmount(cost)}`}
        </span>
      </button>

      <span className="rule-y h-7" />

      <button
        type="button"
        onClick={() => (tool === 'demolish' ? cancel() : setTool('demolish'))}
        aria-pressed={tool === 'demolish'}
        aria-label="Demolish"
        title="Demolish a structure"
        className={`press grid h-8 w-8 place-items-center rounded-[2px] transition-colors ${
          tool === 'demolish'
            ? 'bg-alert/15 text-alert'
            : 'text-titanium hover:bg-white/5 hover:text-bone'
        }`}
      >
        <svg viewBox="0 0 14 14" className="h-3.5 w-3.5 fill-current" aria-hidden>
          <path d="M5 2h4l.5 1H12v1.5H2V3h2.5zM3.2 6h7.6l-.6 7H3.8z" />
        </svg>
      </button>
    </div>
  );
}
