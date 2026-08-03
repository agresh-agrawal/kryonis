'use client';

import { useMemo, useState } from 'react';

import { formatAmount } from '../core/resources';
import { RESEARCH } from '../progress/research';
import { useColonyStore } from '../state/useColonyStore';
import { useProgressStore } from '../state/useProgressStore';
import { worldClock } from '../state/useTimeStore';
import { announce } from '../state/useToastStore';
import {
  CREW_SKILLS,
  SKILL_RESEARCH_BRANCH,
  describeAffinity,
  hiringCost,
  researchDiscount,
  researchSpeed,
  type CrewMember,
  type CrewSkill,
  useCrewStore,
} from '../state/useCrewStore';
import { Console, ConsoleSection, Readout } from './Console';
import { ColonistsIcon, CreditsIcon, ResearchIcon } from './icons';

/** What each speciality is actually for, in the player's terms. */
const SKILL_BRIEF: Record<CrewSkill, string> = {
  Engineering: 'Keeps the power on. Best at Energy research.',
  Biology: 'Air, water and things that grow. Best at Life Support research.',
  Geology: 'Knows where to dig. Best at Industry research.',
  Operations: 'Runs the place day to day. Best at Colony research.',
  Medicine: 'Keeps everyone on their feet. Good at any research.',
};

/**
 * The crew screen.
 *
 * Two jobs that used to be crammed into one 17rem rail: seeing who is here, and
 * deciding who arrives next. Given the whole viewport they separate cleanly -
 * the roster is a grid of people, recruitment is a single deliberate decision on
 * the right, and neither has to be abbreviated into illegibility.
 *
 * Hiring is gated on housing rather than on money alone. That is the entire
 * link between this screen and the build screen: crew capacity is something you
 * *construct*, so wanting a specialist is a reason to go and put up a dome.
 */
export function CrewConsole({ onClose }: { onClose: () => void }) {
  const [skill, setSkill] = useState<CrewSkill>('Engineering');

  const roster = useCrewStore((state) => state.roster);
  const assignedResearcherId = useCrewStore((state) => state.assignedResearcherId);
  const assignResearcher = useCrewStore((state) => state.assignResearcher);
  const hire = useCrewStore((state) => state.hire);

  const stock = useColonyStore((state) => state.stock);
  const stats = useColonyStore((state) => state.stats);
  const spend = useColonyStore((state) => state.spend);
  const project = useProgressStore((state) => state.project);

  // Housing can lag behind the roster after a demolition; never report negative
  // capacity, and never let the roster look like it exceeds a real limit.
  const housing = Math.max(stats.housing, roster.length);
  const vacancies = Math.max(0, housing - roster.length);
  const cost = hiringCost(roster.length, skill);
  const affordable = stock.money >= cost;
  const canHire = vacancies > 0 && affordable;

  const assigned = useMemo(
    () => roster.find((member) => member.id === assignedResearcherId),
    [assignedResearcherId, roster],
  );

  const attemptHire = () => {
    if (!canHire) return;
    if (!spend({ money: cost })) return;
    const member = hire(skill, worldClock.sols);
    useColonyStore.setState((state) => ({ population: state.population + 1 }));
    announce('Crew arrived', `${member.name} — ${member.skill}`, 'good');
  };

  const blockedReason = vacancies <= 0
    ? 'Nowhere to put them. Build a Habitat Dome first.'
    : !affordable
      ? `You need ${formatAmount(cost - stock.money)} more credits.`
      : null;

  return (
    <Console
      title="YOUR CREW"
      legend={`${roster.length} aboard · ${vacancies} ${vacancies === 1 ? 'vacancy' : 'vacancies'}`}
      onClose={onClose}
    >
      <div className="grid gap-5 min-[1180px]:grid-cols-[minmax(0,1fr)_22rem] min-[1180px]:gap-8">
        {/* --- Left: who is here ------------------------------------------ */}
        <div className="min-w-0">
          <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
            <Readout label="Aboard" value={String(roster.length)} />
            <Readout label="Quarters" value={String(housing)} />
            <Readout
              label="Vacancies"
              value={String(vacancies)}
              tone={vacancies > 0 ? 'accent' : 'normal'}
              note={vacancies === 0 ? 'Build to expand' : undefined}
            />
            <Readout
              label="Research lead"
              value={assigned ? assigned.name.split(' ')[0] : 'None'}
              tone={assigned ? 'accent' : 'warn'}
              note={assigned ? assigned.skill : 'Research is slow'}
            />
          </div>

          <ConsoleSection
            className="mt-7"
            title="Roster"
            hint="Tap someone to put them in charge of research"
          >
            <div className="grid gap-3 min-[760px]:grid-cols-2 min-[1500px]:grid-cols-3">
              {roster.map((member) => (
                <CrewCard
                  key={member.id}
                  member={member}
                  lead={member.id === assignedResearcherId}
                  onToggleLead={() =>
                    assignResearcher(member.id === assignedResearcherId ? null : member.id)
                  }
                />
              ))}

              {/* Empty quarters are shown, not implied. A player who cannot see
                  the vacancy has no reason to come back to this screen. */}
              {Array.from({ length: Math.min(vacancies, 4) }).map((_, index) => (
                <div
                  key={`vacancy-${index}`}
                  className="state-locked grid min-h-[7.5rem] place-items-center rounded-[3px] p-4"
                >
                  <div className="text-center">
                    <span className="tag text-titanium">Vacant</span>
                    <p className="t-sm mt-2.5 text-faint">A free bed. Hire someone.</p>
                  </div>
                </div>
              ))}
            </div>
          </ConsoleSection>
        </div>

        {/* --- Right: who arrives next ------------------------------------ */}
        <div className="min-w-0">
          <ConsoleSection title="Recruit" hint={`${formatAmount(stock.money)} credits`}>
            <div className="space-y-1.5">
              {CREW_SKILLS.map((entry) => {
                const active = skill === entry;
                return (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => setSkill(entry)}
                    aria-pressed={active}
                    className={`press w-full rounded-[3px] px-3.5 py-3 text-left ${
                      active ? 'state-owned' : 'state-open hover:bg-white/[0.06]'
                    }`}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`t-md ${active ? 'text-dust' : 'text-bone'}`}>{entry}</span>
                      <span className="t-num text-[0.68rem] text-ash">
                        {formatAmount(hiringCost(roster.length, entry))}
                      </span>
                    </span>
                    <span className="t-sm mt-1.5 block leading-snug text-ash">
                      {SKILL_BRIEF[entry]}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={!canHire}
              onClick={attemptHire}
              className="press mt-4 flex w-full items-center justify-center gap-2 rounded-[3px] bg-dust py-3 text-void transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-faint"
            >
              <CreditsIcon className="h-4 w-4" />
              <span className="t-md">Hire {skill}</span>
              <span className="t-num text-[0.78rem]">{formatAmount(cost)}</span>
            </button>

            {/* The reason is stated, not left for the player to deduce from a
                greyed-out button. */}
            {blockedReason ? (
              <p className="t-sm mt-2.5 leading-snug text-warn">{blockedReason}</p>
            ) : null}
          </ConsoleSection>

          <ConsoleSection className="mt-7" title="Research assignment">
            {assigned ? (
              <AssignmentSummary member={assigned} projectId={project?.id} />
            ) : (
              <div className="state-blocked rounded-[3px] px-3.5 py-3.5">
                <span className="flex items-center gap-2 text-warn">
                  <ResearchIcon className="h-3.5 w-3.5" />
                  <span className="t-micro text-warn">No lead assigned</span>
                </span>
                <p className="t-sm mt-2 leading-snug text-ash">
                  Research still crawls along at about half speed. Put someone in charge and it
                  speeds up — pick a specialist in the right field and it gets cheaper too.
                </p>
              </div>
            )}
          </ConsoleSection>
        </div>
      </div>
    </Console>
  );
}

function CrewCard({
  member,
  lead,
  onToggleLead,
}: {
  member: CrewMember;
  lead: boolean;
  onToggleLead: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggleLead}
      aria-pressed={lead}
      title={lead ? 'Stand down as research lead' : 'Put in charge of research'}
      className={`press flex min-h-[7.5rem] flex-col rounded-[3px] px-4 py-3.5 text-left ${
        lead ? 'state-owned' : 'state-open hover:bg-white/[0.06]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="t-md block truncate text-bone">{member.name}</span>
          <span className="t-sm mt-1 block text-ash">{member.skill}</span>
        </div>
        <span className={lead ? 'text-dust' : 'text-titanium'}>
          <ColonistsIcon className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-auto flex items-end justify-between gap-2 pt-3">
        <span className="flex flex-col gap-1.5">
          <span className="t-micro">Rank</span>
          {/* Rank as pips: three slots, filled to the member's rank. A number
              would need a scale explained; three dots explain themselves. */}
          <span className="flex gap-1">
            {[1, 2, 3].map((step) => (
              <span
                key={step}
                className={`h-1.5 w-4 rounded-full ${
                  step <= member.rank ? 'bg-dust' : 'bg-white/12'
                }`}
              />
            ))}
          </span>
        </span>

        {lead ? (
          <span className="tag text-dust">Research lead</span>
        ) : (
          <span className="t-sm text-faint">Sol {member.hiredAtSol}</span>
        )}
      </div>
    </button>
  );
}

/** What the assigned lead is actually doing for the current project. */
function AssignmentSummary({
  member,
  projectId,
}: {
  member: CrewMember;
  projectId?: string;
}) {
  const node = projectId ? RESEARCH[projectId as keyof typeof RESEARCH] : undefined;
  const branch = node?.branch ?? SKILL_RESEARCH_BRANCH[member.skill];
  const effectiveBranch = branch === 'Any' ? 'Energy' : branch;
  const affinity = describeAffinity(member, effectiveBranch);
  const discount = Math.round(researchDiscount(member, effectiveBranch) * 100);
  const speed = researchSpeed(member, effectiveBranch);

  return (
    <div className="state-owned rounded-[3px] px-3.5 py-3.5">
      <span className="t-md block text-bone">{member.name}</span>
      <span className={`t-sm mt-1 block ${affinity.matched ? 'text-dust' : 'text-warn'}`}>
        {affinity.text}
      </span>

      <div className="mt-3.5 grid grid-cols-2 gap-2.5">
        <div>
          <span className="t-micro block">Cost</span>
          <span className="t-num mt-1.5 block text-[0.95rem] text-bone">−{discount}%</span>
        </div>
        <div>
          <span className="t-micro block">Speed</span>
          <span className="t-num mt-1.5 block text-[0.95rem] text-bone">
            {speed.toFixed(2)}×
          </span>
        </div>
      </div>

      <p className="t-sm mt-3 leading-snug text-ash">
        {node
          ? `Currently working on ${node.name}.`
          : 'Waiting for orders. Start a project on the Research screen.'}
      </p>
    </div>
  );
}
