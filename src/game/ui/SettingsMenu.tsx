'use client';

import { useEffect, useState } from 'react';

import { QUALITY_TIERS, type QualityTier } from '../core/quality';
import { useSettingsStore } from '../state/useSettingsStore';
import { hasSave } from '../save/saveGame';
import { loadSave, saveNow } from '../save/useSaveGame';
import { MenuIcon } from './icons';

const LABELS: Record<QualityTier, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  ultra: 'Ultra',
};

/**
 * Graphics settings.
 *
 * Hidden behind a single icon, because settings are third-priority: opened once
 * and then never again. Quality is auto-detected from the GPU string, which is
 * a heuristic and will occasionally be wrong in both directions, so the player
 * always keeps the final say.
 */
export function SettingsMenu({ onResetWorld }: { onResetWorld: () => void }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  /**
   * Whether a save exists, refreshed when the menu opens.
   *
   * Held in state rather than called during render: `hasSave` parses the whole
   * save document, and it touches localStorage, which does not exist during
   * server rendering.
   */
  const [canLoad, setCanLoad] = useState(false);

  useEffect(() => {
    if (open) setCanLoad(hasSave());
    else setConfirmReset(false);
  }, [open]);

  const autoTier = useSettingsStore((state) => state.autoTier);
  const override = useSettingsStore((state) => state.override);
  const setOverride = useSettingsStore((state) => state.setOverride);

  return (
    <div className="pointer-events-auto relative z-30 flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Settings"
        title="Settings"
        className={`glass press grid h-10 w-10 place-items-center rounded-[3px] transition-colors ${
          open ? 'text-dust' : 'text-titanium hover:text-bone'
        }`}
      >
        <MenuIcon className="h-4 w-4" />
      </button>

      {/*
        Floated out of flow so opening settings never pushes the right rail
        down, and layered above it so it is never half-hidden behind a panel.
      */}
      {open ? (
        <div className="glass anim-rise quiet-scroll absolute right-0 top-11 z-30 max-h-[calc(100dvh-4.5rem)] w-[min(13rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[3px] p-3 shadow-2xl min-[1180px]:top-12 min-[1180px]:w-52">
          <span className="t-micro">Graphics</span>

          <div className="mt-2.5 grid grid-cols-2 gap-1">
            {QUALITY_TIERS.map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => setOverride(tier)}
                aria-pressed={override === tier}
                className={`press t-sm rounded-[2px] py-1.5 transition-colors ${
                  override === tier
                    ? 'bg-white/10 text-dust'
                    : 'text-titanium hover:bg-white/5 hover:text-bone'
                }`}
              >
                {LABELS[tier]}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setOverride(null)}
            aria-pressed={override === null}
            className={`press t-sm mt-1 w-full rounded-[2px] py-1.5 transition-colors ${
              override === null
                ? 'bg-white/10 text-dust'
                : 'text-titanium hover:bg-white/5 hover:text-bone'
            }`}
          >
            Auto · {LABELS[autoTier]}
          </button>

          <span className="rule-x my-3 block" />

          <span className="t-micro">Colony</span>
          <div className="mt-2 flex gap-1">
            <button
              type="button"
              onClick={() => {
                setSaved(saveNow() ? 'Saved' : 'Save failed');
                window.setTimeout(() => setSaved(null), 1800);
              }}
              className="press t-sm flex-1 rounded-[2px] py-1.5 text-titanium transition-colors hover:bg-white/5 hover:text-bone"
            >
              {saved ?? 'Save now'}
            </button>
            <button
              type="button"
              disabled={!canLoad}
              onClick={() => {
                loadSave();
                setCanLoad(hasSave());
              }}
              className="press t-sm flex-1 rounded-[2px] py-1.5 text-titanium transition-colors hover:bg-white/5 hover:text-bone disabled:cursor-not-allowed disabled:text-faint/50"
            >
              Load
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!confirmReset) {
                setConfirmReset(true);
                return;
              }
              onResetWorld();
              setOpen(false);
            }}
            className={`press t-sm mt-1.5 w-full rounded-[2px] py-1.5 transition-colors ${
              confirmReset
                ? 'bg-alert/20 text-alert hover:bg-alert/30'
                : 'text-titanium hover:bg-white/5 hover:text-bone'
            }`}
          >
            {confirmReset ? 'Confirm reset world' : 'Reset world'}
          </button>
          <p className="t-sm mt-2 leading-relaxed text-faint">
            The colony autosaves every 45 seconds and when you close the tab.
          </p>

          <span className="rule-x my-3 block" />

          <p className="t-sm leading-relaxed text-faint">
            Graphics settings never affect the simulation. Terrain, buildable ground and
            deposits are identical at every quality level.
          </p>
        </div>
      ) : null}
    </div>
  );
}
