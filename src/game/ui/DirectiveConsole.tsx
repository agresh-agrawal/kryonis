'use client';

import { RESOURCES, formatAmount, type ResourceId } from '../core/resources';
import { EVENTS } from '../progress/events';
import { suggestNextStep } from '../progress/nextStep';
import { useColonyStore } from '../state/useColonyStore';
import { useCrewStore } from '../state/useCrewStore';
import { useProgressStore } from '../state/useProgressStore';
import { Console, ConsoleSection, Readout } from './Console';
import { useTicker } from './useTicker';

const TONE = {
  critical: 'text-alert',
  warn: 'text-warn',
  info: 'text-bone',
  good: 'text-good',
} as const;

/**
 * The objectives screen.
 *
 * The dock had a Directives button that selected a section nothing rendered a
 * special case for, so it landed on the same default rail as Overview - two
 * buttons, one result. This is what it should always have opened.
 *
 * It answers three questions in order of how often a player asks them: what
 * should I do right now, what is the colony being asked for, and what have I
 * already done. The last one matters more than it sounds - a game with no
 * ending needs to show its own history, or progress stops being visible at all.
 */
export function DirectiveConsole({ onClose }: { onClose: () => void }) {
  useTicker(3);

  const active = useProgressStore((state) => state.active);
  const completed = useProgressStore((state) => state.completed);
  const events = useProgressStore((state) => state.events);
  const project = useProgressStore((state) => state.project);

  const stats = useColonyStore((state) => state.stats);
  const stock = useColonyStore((state) => state.stock);
  const buildings = useColonyStore((state) => state.buildings);
  const roster = useCrewStore((state) => state.roster);
  const assignedResearcherId = useCrewStore((state) => state.assignedResearcherId);

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

  const step = suggestNextStep({
    stats,
    stock,
    counts,
    totalBuildings,
    vacancies: Math.max(0, stats.housing - roster.length),
    hasResearchLead: assignedResearcherId !== null,
    researchRunning: project !== null,
    researchPoints: stock.research,
  });

  return (
    <Console
      title="OBJECTIVES"
      legend={`${active.length} in progress · ${completed.length} done`}
      onClose={onClose}
    >
      {/* --- What to do right now ----------------------------------------- */}
      <div className="state-owned rounded-[3px] px-5 py-5">
        <span className="t-micro text-dust">Do this next</span>
        <p className={`mt-2.5 text-[1.25rem] leading-snug ${TONE[step.tone]}`}>{step.text}</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
        <Readout label="People" value={String(Math.round(stats.population))} />
        <Readout label="Structures" value={String(totalBuildings)} />
        <Readout
          label="Power"
          value={`${Math.round(stats.powerProduction - stats.powerDemand)} MW`}
          tone={stats.powerProduction >= stats.powerDemand ? 'good' : 'alert'}
          note={stats.powerProduction >= stats.powerDemand ? 'Spare' : 'Short'}
        />
        <Readout
          label="Morale"
          value={`${Math.round(stats.happiness * 100)}%`}
          tone={stats.happiness > 0.7 ? 'good' : stats.happiness > 0.45 ? 'warn' : 'alert'}
        />
      </div>

      <div className="mt-7 grid gap-6 min-[1180px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] min-[1180px]:gap-9">
        {/* --- Current directives ---------------------------------------- */}
        <div className="min-w-0">
          <ConsoleSection title="Current jobs" hint="Finish one and another comes in">
            <div className="space-y-3">
              {active.map((mission) => {
                const value = Math.min(mission.target, mission.measure(context));
                const fraction = mission.target > 0 ? value / mission.target : 0;
                const done = fraction >= 1;

                return (
                  <div
                    key={mission.id}
                    className={`rounded-[3px] px-4 py-3.5 ${done ? 'state-owned' : 'state-open'}`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className={`t-md ${done ? 'text-dust' : 'text-bone'}`}>
                        {mission.title}
                      </span>
                      <span className="t-num shrink-0 text-[0.78rem] text-ash">
                        {Math.floor(value)}/{mission.target}
                      </span>
                    </div>

                    <p className="t-sm mt-2 leading-snug text-ash">{mission.detail}</p>

                    <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-dust transition-[width] duration-500"
                        style={{ width: `${Math.min(1, fraction) * 100}%` }}
                      />
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-3">
                      <span className="t-micro">Pays</span>
                      {(Object.entries(mission.reward) as [ResourceId, number][]).map(
                        ([resource, amount]) => (
                          <span key={resource} className="t-num text-[0.7rem] text-good">
                            +{formatAmount(amount)}
                            <span className="text-faint"> {RESOURCES[resource].short}</span>
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ConsoleSection>

          {events.length > 0 ? (
            <ConsoleSection className="mt-7" title="Going wrong right now">
              <div className="space-y-2.5">
                {events.map((entry) => {
                  const def = EVENTS[entry.id];
                  const left = entry.remaining / entry.duration;
                  return (
                    <div key={entry.id} className="state-blocked rounded-[3px] px-4 py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <span
                          className={`t-md ${
                            def.severity === 'critical' ? 'text-alert' : 'text-warn'
                          }`}
                        >
                          {def.name}
                        </span>
                        <span className="t-num shrink-0 text-[0.7rem] text-ash">
                          {Math.ceil(entry.remaining)}s left
                        </span>
                      </div>
                      <p className="t-sm mt-1.5 leading-snug text-ash">{def.detail}</p>
                      <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full transition-[width] duration-500 ${
                            def.severity === 'critical' ? 'bg-alert' : 'bg-warn'
                          }`}
                          style={{ width: `${Math.max(0, Math.min(1, left)) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </ConsoleSection>
          ) : null}
        </div>

        {/* --- History ---------------------------------------------------- */}
        <div className="min-w-0">
          <ConsoleSection title="Already done" hint={`${completed.length} finished`}>
            {completed.length === 0 ? (
              <div className="state-locked rounded-[3px] px-4 py-5 text-center">
                <p className="t-sm text-ash">
                  Nothing finished yet. Your first job is on the left.
                </p>
              </div>
            ) : (
              <ol className="space-y-2">
                {completed.slice(0, 14).map((entry) => (
                  <li
                    key={`${entry.id}-${entry.sol}`}
                    className="state-open flex items-baseline justify-between gap-3 rounded-[3px] px-3.5 py-2.5"
                  >
                    <span className="t-sm truncate text-bone">{entry.title}</span>
                    <span className="t-num shrink-0 text-[0.68rem] text-faint">
                      Sol {entry.sol}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </ConsoleSection>
        </div>
      </div>
    </Console>
  );
}
