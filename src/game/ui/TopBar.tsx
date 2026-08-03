'use client';

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
 * Rates sit under each figure at a third of its size. The eye lands on the
 * amount first and only picks up the trend if it is looking for it - which is
 * the correct priority, since the amount is what you check and the trend is
 * what you diagnose.
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
  const low = bounded && amount / capacity < 0.15;
  const perHour = rate * 3600;
  const moving = Math.abs(perHour) >= 0.5;

  return (
    <div
      className="group relative flex min-w-[4.6rem] flex-col justify-center px-2.5 py-1.5 min-[1180px]:px-4 min-[1180px]:py-2"
      title={def.label}
    >
      {divided ? <span className="rule-y absolute inset-y-2 left-0" /> : null}

      <span className="t-micro">{def.short}</span>

      <span className="mt-1.5 flex items-baseline gap-1.5">
        {Icon ? (
          <Icon
            className={`h-3 w-3 shrink-0 self-center transition-colors ${
              low ? 'text-alert' : 'text-titanium group-hover:text-steel'
            }`}
          />
        ) : null}
        <span className={`t-num text-[0.98rem] ${low ? 'text-alert' : 'text-bone'}`}>
          {formatAmount(amount)}
        </span>
        {moving ? (
          <span className={`t-num text-[0.58rem] ${perHour > 0 ? 'text-good' : 'text-alert'}`}>
            {perHour > 0 ? '+' : ''}
            {formatAmount(perHour)}
          </span>
        ) : null}
      </span>
    </div>
  );
}
