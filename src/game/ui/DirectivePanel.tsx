'use client';

import { RESOURCES, formatAmount, type ResourceId } from '../core/resources';
import { EVENTS } from '../progress/events';
import { useColonyStore } from '../state/useColonyStore';
import { useProgressStore } from '../state/useProgressStore';
import { useTicker } from './useTicker';

/**
 * Current directives, and anything currently going wrong.
 *
 * The brief places the current objective in the highest priority tier
 * alongside time and resources, so this sits top-right where the eye lands
 * after the resource strip. Two directives at a time: enough to always have
 * something achievable, few enough to still be a focus.
 */
export function DirectivePanel() {
  useTicker(3);

  const active = useProgressStore((state) => state.active);
  const events = useProgressStore((state) => state.events);
  const stats = useColonyStore((state) => state.stats);
  const stock = useColonyStore((state) => state.stock);
  const buildings = useColonyStore((state) => state.buildings);

  // Directives measure themselves; rebuild the snapshot they read.
  const counts: Record<string, number> = {};
  let totalBuildings = 0;
  for (const building of buildings) {
    if (building.progress < 1) continue;
    counts[building.type] = (counts[building.type] ?? 0) + 1;
    totalBuildings++;
  }

  const context = {
    population: stats.population,
    housing: stats.housing,
    counts,
    totalBuildings,
    stock,
    happiness: stats.happiness,
    powerProduction: stats.powerProduction,
    researchUnlocked: 0,
    sols: 0,
  } as Parameters<(typeof active)[number]['measure']>[0];

  return (
    <div className="glass anim-rise pointer-events-auto w-[16.5rem] overflow-hidden rounded-[3px]">
      <div className="px-3 pb-1 pt-2.5">
        <span className="t-micro">Directives</span>
      </div>

      {active.map((mission, index) => {
        const value = Math.min(mission.target, mission.measure(context));
        const fraction = mission.target > 0 ? value / mission.target : 0;

        return (
          <div key={mission.id}>
            {index > 0 ? <span className="rule-x mx-3 block" /> : null}
            <div className="px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="t-sm text-bone">{mission.title}</span>
                <span className="t-num text-[0.62rem] text-faint">
                  {Math.floor(value)}/{mission.target}
                </span>
              </div>

              <p className="t-sm mt-1 leading-snug text-faint">{mission.detail}</p>

              <div className="mt-2 h-px w-full bg-white/10">
                <div
                  className="h-px bg-dust transition-[width] duration-500"
                  style={{ width: `${Math.min(1, fraction) * 100}%` }}
                />
              </div>

              <div className="mt-1.5 flex gap-2">
                {(Object.entries(mission.reward) as [ResourceId, number][]).map(
                  ([resource, amount]) => (
                    <span key={resource} className="t-num text-[0.58rem] text-good">
                      +{formatAmount(amount)}
                      <span className="text-faint"> {RESOURCES[resource].short}</span>
                    </span>
                  ),
                )}
              </div>
            </div>
          </div>
        );
      })}

      {events.length > 0 ? (
        <>
          <span className="rule-x mx-3 block" />
          <div className="px-3 py-2.5">
            <span className="t-micro text-warn">Active Events</span>
            {events.map((entry) => {
              const def = EVENTS[entry.id];
              const left = entry.remaining / entry.duration;
              return (
                <div key={entry.id} className="mt-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={`t-sm ${
                        def.severity === 'critical' ? 'text-alert' : 'text-warn'
                      }`}
                    >
                      {def.name}
                    </span>
                    <span className="t-num text-[0.58rem] text-faint">
                      {Math.ceil(entry.remaining)}s
                    </span>
                  </div>
                  <div className="mt-1 h-px w-full bg-white/10">
                    <div
                      className={`h-px transition-[width] duration-500 ${
                        def.severity === 'critical' ? 'bg-alert' : 'bg-warn'
                      }`}
                      style={{ width: `${Math.max(0, Math.min(1, left)) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
