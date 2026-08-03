'use client';

import { useEffect, useState } from 'react';

import { REGION_TILES } from '../core/constants';
import { hashString } from '../core/rng';
import { generateTerrain, surveySite, type TerrainConfig } from '../world/terrain';
import { useColonyStore } from '../state/useColonyStore';
import { useCrewStore } from '../state/useCrewStore';
import { useProgressStore } from '../state/useProgressStore';
import { useTimeStore } from '../state/useTimeStore';
import { useWorldStore } from '../state/useWorldStore';
import { describeAge, readSummary } from '../save/saveGame';
import { loadSave } from '../save/useSaveGame';
import { PlanetIcon } from './icons';

interface SiteOption {
  key: string;
  name: string;
  region: string;
  blurb: string;
  config: Partial<TerrainConfig>;
}

/**
 * The three candidate landing sites.
 *
 * Each is a genuinely different proposition rather than a reskin - the survey
 * figures below are measured from the real generated terrain, not authored, so
 * the trade-off a site advertises is the one the player actually gets.
 */
const SITES: SiteOption[] = [
  {
    key: 'arcadia',
    name: 'Arcadia Planitia',
    region: 'Northern lowlands',
    blurb:
      'A broad, even basin with shallow buried ice. The safe choice, and the one every real mission architecture keeps coming back to.',
    config: {
      seed: hashString('kryonis-arcadia-planitia'),
      ruggedness: 0.5,
      iceAbundance: 0.55,
      mineralAbundance: 0.5,
      dustiness: 0.45,
    },
  },
  {
    key: 'hellas',
    name: 'Hellas Margin',
    region: 'Impact basin rim',
    blurb:
      'Rough, mineral-rich ground on the edge of the deepest basin on Mars. Harder to build on, but the ore is close to the surface.',
    config: {
      seed: hashString('kryonis-hellas-margin'),
      ruggedness: 0.85,
      iceAbundance: 0.3,
      mineralAbundance: 0.95,
      dustiness: 0.35,
    },
  },
  {
    key: 'korolev',
    name: 'Korolev Reach',
    region: 'High latitude',
    blurb:
      'Cold, dusty and unusually icy. Water is easy here and everything else is a fight.',
    config: {
      seed: hashString('kryonis-korolev-reach'),
      ruggedness: 0.6,
      iceAbundance: 0.95,
      mineralAbundance: 0.4,
      dustiness: 0.7,
    },
  },
];

/**
 * The opening screen.
 *
 * Name the corporation, pick where to land. Kept to one screen with three
 * options: a new-game flow that asks more questions than that is delaying the
 * thing the player actually came for.
 */
export function NewColony({ onBegin }: { onBegin: () => void }) {
  const [corporation, setCorporation] = useState('Kryonis Industries');
  const [chosen, setChosen] = useState(SITES[0].key);

  const loadSite = useWorldStore((state) => state.loadSite);
  const initialise = useColonyStore((state) => state.initialise);

  /**
   * Both of these are resolved after mount, never during render.
   *
   * The save summary reads localStorage, which does not exist on the server -
   * so rendering it directly produced markup with no Continue button on the
   * server and one on the client, and React discarded the tree as a hydration
   * mismatch. The surveys are deterministic and would hydrate cleanly, but
   * generating three full regions is far too much work to do twice.
   */
  const [saved, setSaved] = useState<ReturnType<typeof readSummary>>(null);
  const [surveys, setSurveys] = useState<
    { key: string; survey: ReturnType<typeof surveySite> }[]
  >([]);

  useEffect(() => {
    setSaved(readSummary());

    setSurveys(
      SITES.map((site) => {
        const terrain = generateTerrain({ ...site.config, size: REGION_TILES });
        return { key: site.key, survey: surveySite(terrain) };
      }),
    );
  }, []);

  const begin = () => {
    const site = SITES.find((entry) => entry.key === chosen) ?? SITES[0];
    useTimeStore.getState().reset();
    useProgressStore.getState().reset();
    useCrewStore.getState().reset();
    loadSite(site.config, site.name);
    initialise(useWorldStore.getState().terrain);
    onBegin();
  };

  return (
    <div className="anim-fade absolute inset-0 z-50 grid place-items-center overflow-y-auto bg-void/95 p-6 backdrop-blur-xl">
      <div className="w-full max-w-4xl">
        <header className="flex items-end justify-between gap-6">
          <div>
            <span className="text-[2rem] leading-none font-light tracking-[0.5em] text-bone">
              KRYONIS
            </span>
            <p className="t-sm mt-3 max-w-md text-ash">
              You are the operator of a private Mars programme. Choose where to put the first
              landing, and build something that outlasts you.
            </p>
          </div>

          {saved ? (
            <button
              type="button"
              onClick={() => {
                loadSave();
                onBegin();
              }}
              className="press glass rounded-[3px] px-4 py-2.5 text-left"
            >
              <span className="t-micro block">Continue</span>
              <span className="t-sm mt-1 block text-bone">{saved.siteName}</span>
              <span className="t-micro mt-1 block normal-case tracking-normal text-faint">
                Sol {Math.floor(saved.sols) + 1} · {saved.buildings} structures ·{' '}
                {describeAge(saved.savedAt)}
              </span>
            </button>
          ) : null}
        </header>

        <div className="rule-x my-6" />

        <label className="block">
          <span className="t-micro">Corporation</span>
          <input
            value={corporation}
            onChange={(event) => setCorporation(event.target.value)}
            maxLength={34}
            className="glass mt-2 w-full max-w-sm rounded-[3px] px-3 py-2.5 text-bone outline-none focus:ring-1 focus:ring-dust"
          />
        </label>

        <div className="mt-7">
          <span className="t-micro">Landing site</span>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {SITES.map((site) => {
              const survey = surveys.find((entry) => entry.key === site.key)?.survey;
              const active = chosen === site.key;

              return (
                <button
                  key={site.key}
                  type="button"
                  onClick={() => setChosen(site.key)}
                  aria-pressed={active}
                  className={`press glass flex flex-col rounded-[3px] p-4 text-left ${
                    active ? 'ring-1 ring-dust' : 'hover:ring-1 hover:ring-white/15'
                  }`}
                >
                  <span className={active ? 'text-dust' : 'text-titanium'}>
                    <PlanetIcon className="h-6 w-6" />
                  </span>

                  <span className="t-md mt-3 text-bone">{site.name}</span>
                  <span className="t-micro mt-1">{site.region}</span>

                  <p className="t-sm mt-3 flex-1 leading-snug text-faint">{site.blurb}</p>

                  {survey ? (
                    <dl className="mt-4 space-y-1">
                      <Stat label="Buildable" value={survey.valley.buildableFraction} />
                      <Stat label="Ice" value={survey.valley.iceFraction} />
                      <Stat
                        label="Ore"
                        value={Math.min(1, survey.valley.depositTiles / 1600)}
                        display={`${survey.valley.depositTiles}`}
                      />
                    </dl>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={begin}
          className="press mt-8 w-full rounded-[3px] bg-dust py-3.5 text-center text-void transition-colors hover:brightness-110"
        >
          <span className="t-md tracking-[0.2em] uppercase">Begin descent</span>
        </button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  display,
}: {
  label: string;
  value: number;
  display?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <dt className="t-micro w-16 shrink-0">{label}</dt>
      <dd className="flex flex-1 items-center gap-2">
        <span className="h-px flex-1 bg-white/10">
          <span
            className="block h-px bg-dust"
            style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
          />
        </span>
        <span className="t-num w-9 text-right text-[0.6rem] text-ash">
          {display ?? `${Math.round(value * 100)}%`}
        </span>
      </dd>
    </div>
  );
}
