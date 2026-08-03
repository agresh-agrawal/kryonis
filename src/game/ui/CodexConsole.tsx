'use client';

import { useMemo, useState } from 'react';

import { BUILDINGS, type BuildingId } from '../buildings/catalog';
import { CODEX, type CodexEntry } from '../progress/codex';
import { useColonyStore } from '../state/useColonyStore';
import { Console, ConsoleSection, Readout } from './Console';

type Category = CodexEntry['category'];

const CATEGORIES: Category[] = ['Environment', 'Life Support', 'Power', 'Industry', 'People'];

/**
 * The codex.
 *
 * Everything here is true, and it is the one place the game is allowed to
 * teach. It earns that by never interrupting: entries unlock when you build the
 * thing they describe, and then wait.
 *
 * The rail version dimmed locked entries to 40% opacity, which made them
 * genuinely unreadable and - worse - told the player nothing. A locked entry
 * here keeps full contrast and names the structure that opens it, so the list
 * doubles as a set of reasons to go and build something.
 */
export function CodexConsole({ onClose }: { onClose: () => void }) {
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
    <Console
      title="CODEX"
      legend={`${found} of ${CODEX.length} entries recovered`}
      onClose={onClose}
    >
      <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
        <Readout label="Recovered" value={`${found}/${CODEX.length}`} tone="accent" />
        <Readout label="Remaining" value={String(CODEX.length - found)} />
        <Readout label="Structures built" value={String(completed.size)} />
        <Readout
          label="Source"
          value="Verified"
          note="Every figure here is real"
        />
      </div>

      <p className="t-sm mt-6 max-w-3xl leading-relaxed text-ash">
        Everything in the codex is factually true. Where a figure is approximate it says so.
        Entries open when you finish building the thing they describe — the game will never
        interrupt you to deliver one.
      </p>

      {CATEGORIES.map((category) => {
        const entries = CODEX.filter((entry) => entry.category === category);
        if (entries.length === 0) return null;
        const unlockedHere = entries.filter((entry) => completed.has(entry.unlockedBy)).length;

        return (
          <ConsoleSection
            key={category}
            className="mt-8"
            title={category}
            hint={`${unlockedHere}/${entries.length} recovered`}
          >
            <div className="grid gap-3 min-[900px]:grid-cols-2 min-[1500px]:grid-cols-3">
              {entries.map((entry) => (
                <CodexCard
                  key={entry.id}
                  entry={entry}
                  unlocked={completed.has(entry.unlockedBy)}
                  open={openId === entry.id}
                  onToggle={() => setOpenId(openId === entry.id ? null : entry.id)}
                />
              ))}
            </div>
          </ConsoleSection>
        );
      })}
    </Console>
  );
}

function CodexCard({
  entry,
  unlocked,
  open,
  onToggle,
}: {
  entry: CodexEntry;
  unlocked: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const source = BUILDINGS[entry.unlockedBy];

  if (!unlocked) {
    return (
      <div className="state-locked rounded-[3px] px-4 py-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="t-md text-titanium">Undiscovered</span>
          <span className="tag shrink-0 text-titanium">Locked</span>
        </div>
        {/*
          Naming the structure is the point. "Build the relevant structure to
          unlock" told the player nothing they could act on.
        */}
        <p className="t-sm mt-2 leading-snug text-ash">
          Recovered by completing a <span className="text-bone">{source.name}</span>.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-[3px] transition-colors ${
        open ? 'state-owned' : 'state-open hover:bg-white/[0.06]'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="press w-full px-4 py-3.5 text-left"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className={`t-md ${open ? 'text-dust' : 'text-bone'}`}>{entry.title}</span>
          <svg
            viewBox="0 0 12 12"
            className={`h-2.5 w-2.5 shrink-0 fill-titanium transition-transform duration-300 ${
              open ? 'rotate-180' : ''
            }`}
            aria-hidden
          >
            <path d="M1 4l5 5 5-5z" />
          </svg>
        </div>
        <p className="t-sm mt-2 leading-snug text-ash">From the {source.name}</p>
      </button>

      {open ? (
        <div className="anim-fade selectable px-4 pb-4">
          <span className="rule-x mb-3 block" />
          <p className="t-sm leading-relaxed text-bone">{entry.body}</p>
          <p className="t-sm mt-3.5 border-l-2 border-dust/60 pl-3 leading-relaxed text-dust">
            {entry.keyFact}
          </p>
        </div>
      ) : null}
    </div>
  );
}
