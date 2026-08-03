'use client';

import { useState } from 'react';

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
import { researchDiscount, useCrewStore } from '../state/useCrewStore';
import { useProgressStore } from '../state/useProgressStore';
import { ResearchIcon } from './icons';

/**
 * The research tree.
 *
 * One branch at a time, shown as a vertical chain, because that is what the
 * data actually is - each node has a single prerequisite and unlocks the next.
 * Drawing it as a sprawling web would be dishonest about a structure that is
 * genuinely linear, and would cost far more screen for no extra information.
 *
 * Each node carries the real engineering it is drawn from. That is where the
 * game's educational content lives: read at the moment the player has chosen to
 * care about it, never as a forced lesson.
 */
export function ResearchPanel({ onClose }: { onClose: () => void }) {
  const [branch, setBranch] = useState<ResearchBranch>('Energy');

  const unlocked = useProgressStore((state) => state.unlocked);
  const unlockResearch = useProgressStore((state) => state.unlockResearch);
  const points = useColonyStore((state) => state.stock.research);
  const spend = useColonyStore((state) => state.spend);
  const roster = useCrewStore((state) => state.roster);
  const assignedResearcherId = useCrewStore((state) => state.assignedResearcherId);
  const assignedResearcher = roster.find((member) => member.id === assignedResearcherId);

  const nodes = RESEARCH_IDS.filter((id) => RESEARCH[id].branch === branch);

  const attempt = (id: ResearchId) => {
    const node = RESEARCH[id];
    const discount = researchDiscount(assignedResearcher, node.branch);
    const cost = Math.max(1, Math.ceil(node.cost * (1 - discount)));
    if (!isAvailable(id, unlocked) || points < cost) return;
    // Pay first; only commit the unlock if the ledger accepted it.
    if (spend({ research: cost })) unlockResearch(id);
  };

  return (
    <div className="glass anim-rise pointer-events-auto flex w-full flex-col overflow-hidden rounded-[3px]">
      <div className="flex items-center justify-between px-3.5 pb-2 pt-3">
        <span className="t-micro">Research</span>
        <span className="flex items-center gap-3">
          <span className="t-num flex items-center gap-1.5 text-[0.8rem] text-bone">
            <ResearchIcon className="h-3 w-3 text-titanium" />
            {formatAmount(points)}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close research"
            className="press grid h-6 w-6 place-items-center rounded-[2px] text-titanium hover:text-bone"
          >
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-current" aria-hidden>
              <path d="M2.4 1.3L6 4.9l3.6-3.6 1.1 1.1L7.1 6l3.6 3.6-1.1 1.1L6 7.1l-3.6 3.6-1.1-1.1L4.9 6 1.3 2.4z" />
            </svg>
          </button>
        </span>
      </div>

      {/* Wraps rather than overflowing: four branch names will not always fit. */}
      <div className="flex flex-wrap gap-x-1 gap-y-0.5 px-2.5 pb-2">
        {RESEARCH_BRANCHES.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setBranch(name)}
            aria-pressed={branch === name}
            className={`press relative rounded-[2px] px-2.5 py-1.5 transition-colors ${
              branch === name ? 'text-bone' : 'text-titanium hover:text-ash'
            }`}
          >
            <span className="t-micro tracking-[0.12em]">{name}</span>
            <span
              className={`absolute inset-x-2 -bottom-px h-px transition-opacity ${
                branch === name ? 'bg-dust opacity-100' : 'opacity-0'
              }`}
            />
          </button>
        ))}
      </div>

      <span className="rule-x" />

      <div className="px-3 py-2">
        <span className="t-sm text-faint">
          {assignedResearcher
            ? `${assignedResearcher.name} is leading research. Matched skills reduce project cost.`
            : 'Assign a crew member from the crew screen to reduce research costs.'}
        </span>
      </div>

      <span className="rule-x" />

      <div className="quiet-scroll max-h-[19rem] overflow-y-auto p-2.5">
        {nodes.map((id, index) => {
          const node = RESEARCH[id];
          const owned = unlocked.has(id);
          const available = isAvailable(id, unlocked);
          const discount = researchDiscount(assignedResearcher, node.branch);
          const cost = Math.max(1, Math.ceil(node.cost * (1 - discount)));
          const affordable = points >= cost;

          return (
            <div key={id} className="relative pl-5">
              {/* Chain rail linking the branch. */}
              {index > 0 ? (
                <span className="absolute left-[7px] top-0 h-3 w-px bg-white/10" />
              ) : null}
              <span
                className={`absolute left-[3px] top-3 h-2 w-2 rounded-full ring-2 ring-graphite ${
                  owned ? 'bg-dust' : available ? 'bg-titanium' : 'bg-white/12'
                }`}
              />
              {index < nodes.length - 1 ? (
                <span className="absolute bottom-0 left-[7px] top-5 w-px bg-white/10" />
              ) : null}

              <button
                type="button"
                disabled={!available || !affordable}
                onClick={() => attempt(id)}
                title={
                  owned
                    ? 'Already researched'
                    : available
                      ? affordable
                        ? `Research for ${cost} points`
                        : `Needs ${cost} research points`
                      : `Requires ${RESEARCH[node.requires[0]]?.name ?? 'earlier work'}`
                }
                className={`press mb-2 w-full rounded-[2px] px-3 py-2.5 text-left transition-colors ${
                  owned
                    ? 'bg-white/[0.04]'
                    : available && affordable
                      ? 'bg-white/[0.03] hover:bg-white/[0.07]'
                      : 'cursor-not-allowed opacity-55'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`t-sm ${owned ? 'text-dust' : 'text-bone'}`}>{node.name}</span>
                  <span
                    className={`t-num text-[0.6rem] ${
                      owned ? 'text-dust' : affordable && available ? 'text-ash' : 'text-faint'
                    }`}
                  >
                    {owned
                      ? 'Active'
                      : discount > 0
                        ? `${cost} (-${Math.round(discount * 100)}%)`
                        : cost}
                  </span>
                </div>

                <p className="t-sm mt-1 leading-snug text-faint">{node.blurb}</p>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
