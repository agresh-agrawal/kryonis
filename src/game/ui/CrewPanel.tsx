'use client';

import { useMemo, useState } from 'react';

import { formatAmount } from '../core/resources';
import { useColonyStore } from '../state/useColonyStore';
import { worldClock } from '../state/useTimeStore';
import {
  CREW_SKILLS,
  SKILL_RESEARCH_BRANCH,
  hiringCost,
  type CrewSkill,
  useCrewStore,
} from '../state/useCrewStore';
import { ColonistsIcon, CreditsIcon, ResearchIcon } from './icons';

export function CrewPanel({ onClose }: { onClose: () => void }) {
  const [skill, setSkill] = useState<CrewSkill>('Engineering');

  const roster = useCrewStore((state) => state.roster);
  const assignedResearcherId = useCrewStore((state) => state.assignedResearcherId);
  const assignResearcher = useCrewStore((state) => state.assignResearcher);
  const hire = useCrewStore((state) => state.hire);

  const stock = useColonyStore((state) => state.stock);
  const stats = useColonyStore((state) => state.stats);
  const spend = useColonyStore((state) => state.spend);

  const housing = Math.max(stats.housing, roster.length);
  const vacancies = Math.max(0, housing - roster.length);
  const cost = hiringCost(roster.length, skill);
  const canHire = vacancies > 0 && stock.money >= cost;

  const assigned = useMemo(
    () => roster.find((member) => member.id === assignedResearcherId),
    [assignedResearcherId, roster],
  );

  const attemptHire = () => {
    if (!canHire) return;
    if (!spend({ money: cost })) return;
    hire(skill, worldClock.sols);
    useColonyStore.setState((state) => ({ population: state.population + 1 }));
  };

  return (
    <div className="glass anim-rise pointer-events-auto flex w-full flex-col overflow-hidden rounded-[3px]">
      <div className="flex items-center justify-between px-3.5 pb-2 pt-3">
        <span className="t-micro">Crew</span>
        <span className="flex items-center gap-3">
          <span className="t-num flex items-center gap-1.5 text-[0.8rem] text-bone">
            <ColonistsIcon className="h-3 w-3 text-titanium" />
            {roster.length}
            <span className="text-faint">/{housing}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close crew"
            className="press grid h-6 w-6 place-items-center rounded-[2px] text-titanium hover:text-bone"
          >
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-current" aria-hidden>
              <path d="M2.4 1.3L6 4.9l3.6-3.6 1.1 1.1L7.1 6l3.6 3.6-1.1 1.1L6 7.1l-3.6 3.6-1.1-1.1L4.9 6 1.3 2.4z" />
            </svg>
          </button>
        </span>
      </div>

      <span className="rule-x" />

      <div className="p-3">
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Vacancies" value={String(vacancies)} />
          <Metric label="Research lead" value={assigned ? assigned.skill : 'None'} />
        </div>

        <div className="mt-3">
          <span className="t-micro">Recruit</span>
          <div className="mt-2 grid grid-cols-2 gap-1">
            {CREW_SKILLS.map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setSkill(entry)}
                aria-pressed={skill === entry}
                className={`press rounded-[2px] px-2 py-1.5 text-left transition-colors ${
                  skill === entry
                    ? 'bg-white/10 text-dust'
                    : 'text-titanium hover:bg-white/5 hover:text-bone'
                }`}
              >
                <span className="t-sm block">{entry}</span>
                <span className="t-micro mt-1 block normal-case tracking-normal">
                  {SKILL_RESEARCH_BRANCH[entry]}
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={!canHire}
            onClick={attemptHire}
            className="press mt-2 flex w-full items-center justify-center gap-2 rounded-[2px] bg-dust py-2 text-void transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-faint"
            title={vacancies <= 0 ? 'Build a Habitat Dome to create more crew capacity' : undefined}
          >
            <CreditsIcon className="h-3.5 w-3.5" />
            <span className="t-sm">
              Hire {skill} - {formatAmount(cost)}
            </span>
          </button>
        </div>
      </div>

      <span className="rule-x" />

      <div className="quiet-scroll max-h-[18rem] space-y-2 overflow-y-auto p-2.5">
        {roster.map((member) => {
          const assigned = member.id === assignedResearcherId;
          return (
            <button
              key={member.id}
              type="button"
              onClick={() => assignResearcher(assigned ? null : member.id)}
              aria-pressed={assigned}
              className={`press w-full rounded-[2px] px-3 py-2.5 text-left transition-colors ${
                assigned ? 'bg-white/[0.08]' : 'bg-white/[0.03] hover:bg-white/[0.06]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="t-sm text-bone">{member.name}</span>
                <span className={`t-micro ${assigned ? 'text-dust' : ''}`}>
                  {assigned ? 'Assigned' : `Rank ${member.rank}`}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="t-sm text-faint">{member.skill}</span>
                <span className="t-num flex items-center gap-1 text-[0.62rem] text-ash">
                  <ResearchIcon className="h-3 w-3 text-titanium" />
                  {SKILL_RESEARCH_BRANCH[member.skill]}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[2px] bg-white/[0.035] px-3 py-2">
      <span className="t-micro block">{label}</span>
      <span className="t-num mt-1 block text-[0.9rem] text-bone">{value}</span>
    </div>
  );
}
