'use client';

import { useState } from 'react';

import { SOL_DURATION_SECONDS } from '../core/constants';
import { formatAmount } from '../core/resources';
import {
  RESEARCH,
  RESEARCH_BRANCHES,
  RESEARCH_IDS,
  isAvailable,
  type ResearchBranch,
  type ResearchId,
} from '../progress/research';
import { useColonyStore } from '../state/useColonyStore';
import { currentDoctrine } from '../state/useProfileStore';
import { researchDiscount, researchSpeed, useCrewStore } from '../state/useCrewStore';
import { baseProjectDuration, useProgressStore } from '../state/useProgressStore';
import { announce } from '../state/useToastStore';
import { useTicker } from './useTicker';
import { Console, ConsoleSection, Readout } from './Console';
import { ResearchIcon } from './icons';

/** What each branch is for, shown above its column. */
const BRANCH_BRIEF: Record<ResearchBranch, string> = {
  Energy: 'Generation, storage and the losses between them',
  'Life Support': 'Air, water and food, and how little of each you waste',
  Industry: 'Getting material out of the ground and into a usable form',
  Colony: 'The people: morale, movement and how much room they need',
};

/**
 * The research screen.
 *
 * All four branches are visible at once here, which the old rail could not do -
 * it showed one branch at a time behind a tab strip, so the shape of the tree
 * was something the player had to remember rather than see.
 *
 * A project costs points up front and then takes time. The elapsed time is the
 * reason the crew screen exists: the assigned lead makes it cheaper *and*
 * shorter, and only one project runs at once, so who leads it is a real choice
 * rather than a passive bonus.
 */
export function ResearchConsole({ onClose }: { onClose: () => void }) {
  // The project bar has to advance visibly; the store only writes 4x/sec and
  // this is cheap - one component, no 3D work.
  useTicker(4);

  const [inspecting, setInspecting] = useState<ResearchId | null>(null);

  const unlocked = useProgressStore((state) => state.unlocked);
  const project = useProgressStore((state) => state.project);
  const startProject = useProgressStore((state) => state.startProject);
  const cancelProject = useProgressStore((state) => state.cancelProject);

  const points = useColonyStore((state) => state.stock.research);
  const spend = useColonyStore((state) => state.spend);

  const roster = useCrewStore((state) => state.roster);
  const assignedResearcherId = useCrewStore((state) => state.assignedResearcherId);
  const lead = roster.find((member) => member.id === assignedResearcherId);

  // Two independent reductions: the doctrine chosen before landing, and the
  // crew member leading the work. They multiply rather than add, so a
  // scientific programme with a matched specialist is genuinely cheap.
  const priceOf = (id: ResearchId) => {
    const node = RESEARCH[id];
    const scaled = node.cost * currentDoctrine().researchCostScale;
    return Math.max(1, Math.ceil(scaled * (1 - researchDiscount(lead, node.branch))));
  };

  const begin = (id: ResearchId) => {
    if (project) return;
    const node = RESEARCH[id];
    if (!isAvailable(id, unlocked)) return;
    if (points < priceOf(id)) return;

    const duration = baseProjectDuration(id) / researchSpeed(lead, node.branch);
    // Pay first; only commit the project if the ledger accepted it.
    if (!spend({ research: priceOf(id) })) return;
    if (startProject(id, duration)) {
      announce('Project started', node.name);
      setInspecting(null);
    }
  };

  const completed = RESEARCH_IDS.filter((id) => unlocked.has(id)).length;

  return (
    <Console
      title="RESEARCH"
      legend={`${completed} of ${RESEARCH_IDS.length} projects complete`}
      onClose={onClose}
    >
      <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
        <Readout label="Research points" value={formatAmount(points)} tone="accent" />
        <Readout
          label="Lead researcher"
          value={lead ? lead.name : 'Unassigned'}
          tone={lead ? 'normal' : 'warn'}
          note={lead ? lead.skill : 'Projects run at 0.55×'}
        />
        <Readout label="Completed" value={`${completed}/${RESEARCH_IDS.length}`} />
        <Readout
          label="In progress"
          value={project ? RESEARCH[project.id].name : 'Idle'}
          tone={project ? 'accent' : 'normal'}
        />
      </div>

      {project ? (
        <ActiveProject
          onCancel={() => {
            cancelProject();
            announce('Project abandoned', RESEARCH[project.id].name, 'warn');
          }}
        />
      ) : null}

      <ConsoleSection
        className="mt-7"
        title="Projects"
        hint={
          project
            ? 'One project runs at a time — finish or abandon the current one first'
            : 'Select a project to begin'
        }
      >
        <div className="grid gap-x-5 gap-y-6 min-[860px]:grid-cols-2 min-[1440px]:grid-cols-4">
          {RESEARCH_BRANCHES.map((branch) => (
            <div key={branch} className="min-w-0">
              <div className="pb-3">
                <h3 className="t-md text-bone">{branch}</h3>
                <p className="t-sm mt-1.5 leading-snug text-faint">{BRANCH_BRIEF[branch]}</p>
              </div>

              <div className="space-y-2">
                {RESEARCH_IDS.filter((id) => RESEARCH[id].branch === branch).map((id) => (
                  <ProjectCard
                    key={id}
                    id={id}
                    price={priceOf(id)}
                    owned={unlocked.has(id)}
                    available={isAvailable(id, unlocked)}
                    affordable={points >= priceOf(id)}
                    running={project?.id === id}
                    blockedByOther={Boolean(project) && project?.id !== id}
                    expanded={inspecting === id}
                    onInspect={() => setInspecting(inspecting === id ? null : id)}
                    onBegin={() => begin(id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ConsoleSection>
    </Console>
  );
}

/** The running project: a progress bar with an honest time remaining. */
function ActiveProject({ onCancel }: { onCancel: () => void }) {
  const project = useProgressStore((state) => state.project);
  if (!project) return null;

  const node = RESEARCH[project.id];
  const fraction = Math.max(0, Math.min(1, project.elapsed / project.duration));
  const remainingSeconds = Math.max(0, project.duration - project.elapsed);

  return (
    <div className="state-owned anim-rise mt-5 rounded-[3px] px-4 py-4 min-[1180px]:px-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="flex items-center gap-2">
            <ResearchIcon className="h-3.5 w-3.5 text-dust" />
            <span className="t-micro text-dust">In progress</span>
          </span>
          <span className="t-md mt-2 block text-bone">{node.name}</span>
          <p className="t-sm mt-1.5 max-w-2xl leading-snug text-ash">{node.blurb}</p>
        </div>

        <div className="flex items-center gap-5">
          <div className="text-right">
            <span className="t-micro block">Remaining</span>
            <span className="t-num mt-1.5 block text-[1.05rem] text-bone">
              {formatDuration(remainingSeconds)}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            title="Abandon this project. Points already spent are not refunded."
            className="press rounded-[3px] border border-white/10 px-3 py-2 text-titanium transition-colors hover:border-alert/40 hover:text-alert"
          >
            <span className="t-sm">Abandon</span>
          </button>
        </div>
      </div>

      <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-dust transition-[width] duration-500"
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
    </div>
  );
}

function ProjectCard({
  id,
  price,
  owned,
  available,
  affordable,
  running,
  blockedByOther,
  expanded,
  onInspect,
  onBegin,
}: {
  id: ResearchId;
  price: number;
  owned: boolean;
  available: boolean;
  affordable: boolean;
  running: boolean;
  blockedByOther: boolean;
  expanded: boolean;
  onInspect: () => void;
  onBegin: () => void;
}) {
  const node = RESEARCH[id];
  const prerequisite = node.requires[0] ? RESEARCH[node.requires[0]] : undefined;

  /*
   * Each state gets a shape and a word, never just an opacity. "Locked" and
   * "cannot afford" used to look identical at 55% opacity, which meant the
   * player could not tell a missing prerequisite from a missing 20 points.
   */
  const surface = owned
    ? 'state-owned'
    : running
      ? 'state-owned'
      : !available
        ? 'state-locked'
        : affordable
          ? 'state-open hover:bg-white/[0.06]'
          : 'state-blocked';

  return (
    <div className={`rounded-[3px] ${surface}`}>
      <button
        type="button"
        onClick={onInspect}
        aria-expanded={expanded}
        className="w-full px-3.5 py-3 text-left"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className={`t-sm ${owned ? 'text-dust' : 'text-bone'}`}>{node.name}</span>

          {owned ? (
            <span className="tag shrink-0 text-dust">Active</span>
          ) : running ? (
            <span className="tag shrink-0 text-dust">Running</span>
          ) : !available ? (
            <span className="tag shrink-0 text-titanium">Locked</span>
          ) : (
            <span
              className={`t-num shrink-0 text-[0.68rem] ${affordable ? 'text-ash' : 'text-warn'}`}
            >
              {price}
            </span>
          )}
        </div>

        {/* Locked nodes say what unlocks them. A dimmed name that explains
            nothing is the same as no entry at all. */}
        {!available && !owned && prerequisite ? (
          <p className="t-sm mt-1.5 leading-snug text-faint">Needs {prerequisite.name}</p>
        ) : null}
      </button>

      {expanded ? (
        <div className="anim-fade px-3.5 pb-3.5">
          <span className="rule-x mb-3 block" />
          <p className="t-sm leading-relaxed text-ash">{node.blurb}</p>

          {owned ? (
            <p className="t-sm mt-3 text-dust">Already in service across the colony.</p>
          ) : !available ? (
            <p className="t-sm mt-3 text-faint">
              Complete {prerequisite?.name ?? 'earlier work'} to open this project.
            </p>
          ) : (
            <button
              type="button"
              disabled={!affordable || blockedByOther || running}
              onClick={onBegin}
              className="press mt-3 w-full rounded-[2px] bg-dust py-2 text-void transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-faint"
            >
              <span className="t-sm">
                {running
                  ? 'Running'
                  : blockedByOther
                    ? 'Another project is running'
                    : affordable
                      ? `Begin · ${price} points`
                      : `Needs ${price} points`}
              </span>
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Game seconds as sols and hours, matching how the clock reads elsewhere. */
function formatDuration(seconds: number): string {
  const solFraction = seconds / SOL_DURATION_SECONDS;
  if (solFraction >= 1) {
    const sols = Math.floor(solFraction);
    const hours = Math.round((solFraction - sols) * 24);
    return `${sols}s ${hours}h`;
  }
  const hours = solFraction * 24;
  if (hours >= 1) return `${hours.toFixed(1)}h`;
  return `${Math.ceil(hours * 60)}m`;
}
