'use client';

import { useMemo, useState } from 'react';

import type { BuildingId } from '../buildings/catalog';
import { CODEX } from '../progress/codex';
import { useColonyStore } from '../state/useColonyStore';

/**
 * The codex.
 *
 * A list of what the colony has taught you, locked entries included so the
 * player can see there is more to find. Reading is opt-in: an entry opens only
 * when clicked, and nothing here ever interrupts play.
 */
export function CodexPanel({ onClose }: { onClose: () => void }) {
  const buildings = useColonyStore((state) => state.buildings);
  const [openId, setOpenId] = useState<string | null>(null);

  const completed = useMemo(() => {
    const set = new Set<BuildingId>();
    for (const building of buildings) {
      if (building.progress >= 1) set.add(building.type);
    }
    return set;
  }, [buildings]);

  const found = CODEX.filter((entry) => completed.has(entry.unlockedBy)).length;

  return (
    <div className="glass anim-rise pointer-events-auto flex w-full flex-col overflow-hidden rounded-[3px]">
      <div className="flex items-center justify-between px-3.5 pb-2 pt-3">
        <span className="t-micro">Codex</span>
        <span className="flex items-center gap-3">
          <span className="t-num text-[0.7rem] text-ash">
            {found}
            <span className="text-faint">/{CODEX.length}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close codex"
            className="press grid h-6 w-6 place-items-center rounded-[2px] text-titanium hover:text-bone"
          >
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-current" aria-hidden>
              <path d="M2.4 1.3L6 4.9l3.6-3.6 1.1 1.1L7.1 6l3.6 3.6-1.1 1.1L6 7.1l-3.6 3.6-1.1-1.1L4.9 6 1.3 2.4z" />
            </svg>
          </button>
        </span>
      </div>

      <span className="rule-x" />

      <div className="quiet-scroll max-h-[20rem] overflow-y-auto p-2">
        {CODEX.map((entry) => {
          const unlocked = completed.has(entry.unlockedBy);
          const open = openId === entry.id;

          return (
            <div key={entry.id} className="mb-1">
              <button
                type="button"
                disabled={!unlocked}
                onClick={() => setOpenId(open ? null : entry.id)}
                aria-expanded={open}
                className={`press w-full rounded-[2px] px-3 py-2 text-left transition-colors ${
                  unlocked
                    ? open
                      ? 'bg-white/[0.07]'
                      : 'hover:bg-white/[0.04]'
                    : 'cursor-not-allowed opacity-40'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`t-sm ${unlocked ? 'text-bone' : 'text-faint'}`}>
                    {unlocked ? entry.title : 'Undiscovered'}
                  </span>
                  <span className="t-micro shrink-0">{entry.category}</span>
                </div>

                {!unlocked ? (
                  <span className="t-micro mt-1 block normal-case tracking-normal text-faint">
                    Build the relevant structure to unlock
                  </span>
                ) : null}
              </button>

              {open && unlocked ? (
                <div className="anim-fade selectable px-3 pb-3 pt-1">
                  <p className="t-sm leading-relaxed text-ash">{entry.body}</p>
                  <p className="t-sm mt-2.5 border-l border-dust/50 pl-2.5 leading-snug text-dust">
                    {entry.keyFact}
                  </p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
