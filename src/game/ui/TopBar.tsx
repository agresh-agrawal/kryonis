'use client';

import { SOL_DURATION_SECONDS } from '../core/constants';
import { RESOURCES, formatAmount, type ResourceId } from '../core/resources';
import { useColonyStore } from '../state/useColonyStore';
import { ColonistsIcon, PowerIcon, RESOURCE_ICONS } from './icons';

/**
 * The top instrument strip.
 *
 * Seven numbers, one hairline, nothing else. This is the only interface element
 * permitted to sit across the top of the world, so it earns its place by being
 * thin enough to ignore and legible enough to never need opening.
 *
 * The one rule that governs every readout here: **a number on screen must be a
 * number the player can name.** An earlier version printed the amount and the
 * rate side by side as bare digits - "Oxygen 299 259" - which reads as two
 * unrelated quantities and told nobody anything. It is now the amount, and then
 * a direction: an arrow, a colour, and the change per sol.
 */
const STRIP: ResourceId[] = ['money', 'oxygen', 'water', 'food', 'research'];

export function TopBar() {
  const stock = useColonyStore((state) => state.stock);
  const stats = useColonyStore((state) => state.stats);

  const powerBalance = stats.powerProduction - stats.powerDemand;
  const powerStrained = stats.powerSatisfaction < 0.999;

  return (
    <div className="glass anim-fade quiet-scroll pointer-events-auto flex w-full min-w-0 items-stretch overflow-x-auto rounded-[3px] px-0.5 min-[1180px]:px-1">
      {STRIP.map((id, index) => (
        <Readout
          key={id}
          id={id}
          amount={stock[id]}
          rate={stats.rates[id]}
          capacity={stats.capacity[id]}
          divided={index > 0}
        />
      ))}

      <Cell divided label="Power" tone={powerStrained ? 'alert' : 'normal'}>
        <span className="flex items-center gap-1.5">
          <PowerIcon className="h-3 w-3 text-titanium" />
          <span
            className={`t-num text-[0.98rem] ${
              powerStrained ? 'text-alert' : powerBalance >= 0 ? 'text-bone' : 'text-warn'
            }`}
          >
            {powerBalance >= 0 ? '+' : ''}
            {Math.round(powerBalance)}
          </span>
        </span>
      </Cell>

      <Cell divided label="Crew">
        <span className="flex items-center gap-1.5">
          <ColonistsIcon className="h-3 w-3 text-titanium" />
          <span className="t-num text-[0.98rem] text-bone">
            {Math.floor(stats.population)}
            <span className="text-faint">/{stats.housing}</span>
          </span>
        </span>
      </Cell>
    </div>
  );
}

function Cell({
  label,
  divided,
  children,
}: {
  label: string;
  divided?: boolean;
  tone?: 'normal' | 'alert';
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-w-[4.4rem] flex-col justify-center px-2.5 py-1.5 min-[1180px]:px-4 min-[1180px]:py-2">
      {divided ? <span className="rule-y absolute inset-y-2 left-0" /> : null}
      <span className="t-micro">{label}</span>
      <span className="mt-1.5">{children}</span>
    </div>
  );
}

/** A small solid triangle. Direction is read before any digit is. */
function Trend({ up, className }: { up: boolean; className: string }) {
  return (
    <svg viewBox="0 0 8 8" className={`h-2 w-2 shrink-0 fill-current ${className}`} aria-hidden>
      {up ? <path d="M4 1l3.2 5.4H0.8z" /> : <path d="M4 7L0.8 1.6h6.4z" />}
    </svg>
  );
}

function Readout({
  id,
  amount,
  rate,
  capacity,
  divided,
}: {
  id: ResourceId;
  amount: number;
  rate: number;
  capacity: number;
  divided: boolean;
}) {
  const def = RESOURCES[id];
  const Icon = RESOURCE_ICONS[id];

  const bounded = Number.isFinite(capacity) && capacity > 0;
  const share = bounded ? amount / capacity : 1;

  /*
   * Everything is quoted per sol.
   *
   * A fraction of a unit per second is true and useless: it rounds to nothing
   * on screen, which is why credits looked frozen even while the colony was
   * earning. A sol is the unit the player already thinks in, because it is the
   * unit directives, wages and the clock are all quoted in.
   */
  const perSol = rate * SOL_DURATION_SECONDS;
  const falling = perSol < -0.5;
  const rising = perSol > 0.5;

  /*
   * When to shout.
   *
   * Red is reserved for a real problem, not for any downward movement - a store
   * that is draining while three sols of buffer remain is normal operation, and
   * colouring it red every time teaches the player to ignore red.
   *
   * So: red when the store is genuinely low, amber when it is falling and
   * getting there, and quiet otherwise. Unbounded resources (credits, research)
   * have no ceiling to be low against, so for those "falling" is the signal.
   */
  const critical = bounded ? share < 0.12 : amount <= 0;
  const warning = !critical && falling && (bounded ? share < 0.35 : amount < 2000);

  const valueTone = critical ? 'text-alert' : warning ? 'text-warn' : 'text-bone';
  const trendTone = critical ? 'text-alert' : falling ? 'text-warn' : 'text-good';

  return (
    <div
      className="group relative flex min-w-[5.2rem] flex-col justify-center px-2.5 py-1.5 min-[1180px]:px-4 min-[1180px]:py-2"
      title={
        rising || falling
          ? `${def.label}: ${Math.round(amount)}${bounded ? ` of ${Math.round(capacity)}` : ''}, ${
              rising ? 'gaining' : 'losing'
            } ${Math.abs(Math.round(perSol))} per sol`
          : `${def.label}: ${Math.round(amount)}${bounded ? ` of ${Math.round(capacity)}` : ''}, steady`
      }
    >
      {divided ? <span className="rule-y absolute inset-y-2 left-0" /> : null}

      <span className={`t-micro ${critical ? 'text-alert' : ''}`}>{def.short}</span>

      <span className="mt-1.5 flex items-center gap-1.5">
        {Icon ? (
          <Icon
            className={`h-3 w-3 shrink-0 transition-colors ${
              critical ? 'text-alert' : 'text-titanium group-hover:text-steel'
            }`}
          />
        ) : null}

        <span className={`t-num text-[0.98rem] ${valueTone}`}>{formatAmount(amount)}</span>

        {/*
          The arrow, not a second number.
          Direction is the thing being communicated; the magnitude is secondary
          and sits at two-thirds the size behind it.
        */}
        {rising || falling ? (
          <span className="flex items-center gap-0.5">
            <Trend up={rising} className={trendTone} />
            <span className={`t-num text-[0.56rem] ${trendTone}`}>
              {formatAmount(Math.abs(perSol))}
            </span>
          </span>
        ) : null}
      </span>

      {/*
        A hairline fill for anything with a ceiling.
        Turns "260 food" into "260 food and about a third of a tank", which is
        the question actually being asked.
      */}
      {bounded ? (
        <span className="mt-1.5 block h-px w-full bg-white/10">
          <span
            className={`block h-px transition-[width] duration-700 ${
              critical ? 'bg-alert' : warning ? 'bg-warn' : 'bg-dust/70'
            }`}
            style={{ width: `${Math.max(2, Math.min(1, share) * 100)}%` }}
          />
        </span>
      ) : null}
    </div>
  );
}
