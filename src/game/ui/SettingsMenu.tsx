'use client';

import { useEffect, useState } from 'react';

import { QUALITY_TIERS, type QualityTier } from '../core/quality';
import { useSettingsStore } from '../state/useSettingsStore';
import { hasSave } from '../save/saveGame';
import { loadSave, saveNow } from '../save/useSaveGame';
import { requestTrailerReplay } from './BootVideo';
import { MenuIcon } from './icons';

const LABELS: Record<QualityTier, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  ultra: 'Ultra',
};

/**
 * Settings.
 *
 * Hidden behind a single icon, because settings are third-priority: opened once
 * and then never again. Quality is auto-detected from the GPU string, which is
 * a heuristic and will occasionally be wrong in both directions, so the player
 * always keeps the final say.
 *
 * The three resets are deliberately separate. "Reset" as a single button always
 * destroys more than the player meant - somebody who wants a fresh colony does
 * not want their graphics preference wiped, and somebody fixing a bad graphics
 * setting certainly does not want their colony deleted.
 */
export function SettingsMenu({
  onResetWorld,
  onOpenOverview,
}: {
  onResetWorld: () => void;
  onOpenOverview?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<'world' | 'everything' | null>(null);

  /*
   * Whether a save exists, refreshed when the menu opens.
   *
   * Held in state rather than called during render: `hasSave` parses the whole
   * save document, and it touches localStorage, which does not exist during
   * server rendering.
   */
  const [canLoad, setCanLoad] = useState(false);

  useEffect(() => {
    if (open) setCanLoad(hasSave());
    else setConfirming(null);
  }, [open]);

  const autoTier = useSettingsStore((state) => state.autoTier);
  const override = useSettingsStore((state) => state.override);
  const setOverride = useSettingsStore((state) => state.setOverride);
  const audioEnabled = useSettingsStore((state) => state.audioEnabled);
  const setAudioEnabled = useSettingsStore((state) => state.setAudioEnabled);
  const resetSettings = useSettingsStore((state) => state.resetSettings);

  const flash = (message: string) => {
    setSaved(message);
    window.setTimeout(() => setSaved(null), 1800);
  };

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
        <div className="glass anim-rise quiet-scroll absolute right-0 top-11 z-30 max-h-[calc(100dvh-4.5rem)] w-[min(15rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[3px] p-3.5 shadow-2xl min-[1180px]:top-12 min-[1180px]:w-60">
          <span className="t-micro">Graphics</span>

          <div className="mt-2.5 grid grid-cols-2 gap-1">
            {QUALITY_TIERS.map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => setOverride(tier)}
                aria-pressed={override === tier}
                className={`press t-sm rounded-[2px] py-2 transition-colors ${
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
            className={`press t-sm mt-1 w-full rounded-[2px] py-2 transition-colors ${
              override === null
                ? 'bg-white/10 text-dust'
                : 'text-titanium hover:bg-white/5 hover:text-bone'
            }`}
          >
            Auto · {LABELS[autoTier]}
          </button>

          <span className="rule-x my-3.5 block" />

          <span className="t-micro">Sound</span>
          <button
            type="button"
            onClick={() => setAudioEnabled(!audioEnabled)}
            aria-pressed={audioEnabled}
            className="press t-sm mt-2 flex w-full items-center justify-between rounded-[2px] px-2 py-2 text-titanium transition-colors hover:bg-white/5 hover:text-bone"
          >
            <span>Audio</span>
            <span className={audioEnabled ? 'text-dust' : 'text-faint'}>
              {audioEnabled ? 'On' : 'Off'}
            </span>
          </button>

          <span className="rule-x my-3.5 block" />

          <span className="t-micro">Colony</span>
          <div className="mt-2 flex gap-1">
            <button
              type="button"
              onClick={() => flash(saveNow() ? 'Saved' : 'Save failed')}
              className="press t-sm flex-1 rounded-[2px] py-2 text-titanium transition-colors hover:bg-white/5 hover:text-bone"
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
              className="press t-sm flex-1 rounded-[2px] py-2 text-titanium transition-colors hover:bg-white/5 hover:text-bone disabled:cursor-not-allowed disabled:text-faint/60"
            >
              Load
            </button>
          </div>

          <p className="t-sm mt-2.5 leading-relaxed text-faint">
            The colony autosaves every 45 seconds and when you close the tab.
          </p>

          <span className="rule-x my-3.5 block" />

          <span className="t-micro">Reset</span>

          {/*
            Three scopes, each stating exactly what it destroys. The confirm
            step is a second click on the same button rather than a dialog:
            fewer moving parts, and the label can carry the warning.
          */}
          <button
            type="button"
            onClick={() => {
              if (confirming !== 'world') {
                setConfirming('world');
                return;
              }
              onResetWorld();
              setOpen(false);
            }}
            className={`press t-sm mt-2 w-full rounded-[2px] py-2 transition-colors ${
              confirming === 'world'
                ? 'bg-alert/20 text-alert hover:bg-alert/30'
                : 'text-titanium hover:bg-white/5 hover:text-bone'
            }`}
          >
            {confirming === 'world' ? 'Confirm — delete colony' : 'Reset world'}
          </button>

          <button
            type="button"
            onClick={() => {
              resetSettings();
              setConfirming(null);
              flash('Settings reset');
            }}
            className="press t-sm mt-1 w-full rounded-[2px] py-2 text-titanium transition-colors hover:bg-white/5 hover:text-bone"
          >
            Reset settings only
          </button>

          <button
            type="button"
            onClick={() => {
              if (confirming !== 'everything') {
                setConfirming('everything');
                return;
              }
              resetSettings();
              requestTrailerReplay();
              onResetWorld();
              setOpen(false);
            }}
            className={`press t-sm mt-1 w-full rounded-[2px] py-2 transition-colors ${
              confirming === 'everything'
                ? 'bg-alert/20 text-alert hover:bg-alert/30'
                : 'text-titanium hover:bg-white/5 hover:text-bone'
            }`}
          >
            {confirming === 'everything' ? 'Confirm — erase everything' : 'Reset everything'}
          </button>

          <p className="t-sm mt-2.5 leading-relaxed text-faint">
            Reset world keeps your settings. Reset everything also clears preferences and plays
            the intro again.
          </p>

          <span className="rule-x my-3.5 block" />

          <button
            type="button"
            onClick={() => {
              requestTrailerReplay();
              flash('Plays on next launch');
            }}
            className="press t-sm w-full rounded-[2px] py-2 text-titanium transition-colors hover:bg-white/5 hover:text-bone"
          >
            Replay intro
          </button>

          {onOpenOverview ? (
            <button
              type="button"
              onClick={() => {
                onOpenOverview();
                setOpen(false);
              }}
              className="press t-sm mt-1 w-full rounded-[2px] py-2 text-titanium transition-colors hover:bg-white/5 hover:text-bone"
            >
              Mission overview
            </button>
          ) : null}

          <p className="t-sm mt-3 leading-relaxed text-faint">
            Graphics settings never affect the simulation. Terrain, buildable ground and deposits
            are identical at every quality level.
          </p>
        </div>
      ) : null}
    </div>
  );
}
