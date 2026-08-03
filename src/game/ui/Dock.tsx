'use client';

import { useState } from 'react';

import { useBuildStore } from '../state/useBuildStore';
import {
  BuildIcon,
  ColonistsIcon,
  DashboardIcon,
  MissionsIcon,
  ResearchIcon,
  TradeIcon,
  ZonesIcon,
} from './icons';

export type DockKey =
  | 'overview'
  | 'build'
  | 'territory'
  | 'crew'
  | 'research'
  | 'missions'
  | 'codex';

const ITEMS: {
  key: DockKey;
  label: string;
  Icon: (props: { className?: string }) => React.ReactElement;
  ready: boolean;
}[] = [
  { key: 'overview', label: 'Overview', Icon: DashboardIcon, ready: true },
  { key: 'build', label: 'Construct', Icon: BuildIcon, ready: true },
  { key: 'territory', label: 'Territory', Icon: ZonesIcon, ready: true },
  { key: 'crew', label: 'Crew', Icon: ColonistsIcon, ready: true },
  { key: 'research', label: 'Research', Icon: ResearchIcon, ready: true },
  { key: 'missions', label: 'Directives', Icon: MissionsIcon, ready: true },
  { key: 'codex', label: 'Codex', Icon: TradeIcon, ready: true },
];

/**
 * The navigation dock.
 *
 * Collapsed to a column of icons at rest and widening to show labels on hover.
 * A permanent labelled sidebar would cost a fifth of the screen for information
 * the player needs for the half-second they are choosing where to go; icons
 * cost 48 pixels and the labels arrive exactly when the pointer says they are
 * wanted.
 *
 * The active item is marked by a bronze bar at its leading edge rather than by
 * a filled background, so the dock never becomes a stack of bright rectangles.
 */
export function Dock({
  active,
  onSelect,
}: {
  active: DockKey;
  onSelect: (key: DockKey) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cancel = useBuildStore((state) => state.cancel);
  const setTool = useBuildStore((state) => state.setTool);

  const handle = (key: DockKey, ready: boolean) => {
    if (!ready) return;
    onSelect(key);
    if (key === 'build') setTool('build');
    else cancel();
  };

  return (
    <nav
      onPointerEnter={() => setExpanded(true)}
      onPointerLeave={() => setExpanded(false)}
      className={`glass anim-slide-left pointer-events-auto overflow-hidden rounded-[3px] py-1.5 transition-[width] duration-300 min-[1180px]:py-2 ${
        expanded ? 'w-40 min-[1180px]:w-44' : 'w-[3rem] min-[1180px]:w-[3.25rem]'
      }`}
      style={{ transitionTimingFunction: 'var(--ease-spring)' }}
    >
      {ITEMS.map(({ key, label, Icon, ready }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            disabled={!ready}
            onClick={() => handle(key, ready)}
            aria-current={isActive ? 'page' : undefined}
            title={ready ? label : `${label} — not yet available`}
            className={`group relative flex h-10 w-full items-center gap-3 px-3.5 transition-colors min-[1180px]:h-11 min-[1180px]:gap-3.5 min-[1180px]:px-4 ${
              ready
                ? isActive
                  ? 'text-dust'
                  : 'text-titanium hover:text-bone'
                : 'cursor-not-allowed text-faint/45'
            }`}
          >
            {/* Active marker: a short bronze rule at the leading edge. */}
            <span
              className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full transition-all duration-300 ${
                isActive ? 'bg-dust opacity-100' : 'bg-transparent opacity-0'
              }`}
            />

            <Icon className="h-4 w-4 shrink-0 min-[1180px]:h-[18px] min-[1180px]:w-[18px]" />

            <span
              className={`t-sm whitespace-nowrap transition-all duration-200 ${
                expanded ? 'translate-x-0 opacity-100' : '-translate-x-1 opacity-0'
              }`}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
