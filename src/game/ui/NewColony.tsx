'use client';

import { useEffect, useMemo, useState } from 'react';

import { REGION_TILES } from '../core/constants';
import { hashString } from '../core/rng';
import { DOCTRINE_IDS, DOCTRINES, type DoctrineId } from '../progress/doctrine';
import { generateTerrain, surveySite, type TerrainConfig } from '../world/terrain';
import { useColonyStore } from '../state/useColonyStore';
import { useCrewStore } from '../state/useCrewStore';
import { useProfileStore } from '../state/useProfileStore';
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

type Step = 'commander' | 'doctrine' | 'site' | 'confirm';

const STEPS: { key: Step; label: string; legend: string }[] = [
  { key: 'commander', label: 'Command', legend: 'Who is running this programme' },
  { key: 'doctrine', label: 'Doctrine', legend: 'What the programme is for' },
  { key: 'site', label: 'Landing site', legend: 'Where the first lander sets down' },
  { key: 'confirm', label: 'Descent', legend: 'Confirm and go' },
];

/**
 * The opening flow.
 *
 * Four steps rather than one screen. The old version asked for a corporation
 * name that changed nothing and a site, which is not enough of a decision to
 * feel like the start of anything - but the fix is not simply *more questions*.
 * Every question here moves a number the player will feel within the first ten
 * minutes, and the confirmation step states exactly what each answer did.
 */
export function NewColony({ onBegin }: { onBegin: () => void }) {
  const [step, setStep] = useState<Step>('commander');
  const [commander, setCommander] = useState('');
  const [corporation, setCorporation] = useState('Kryonis Industries');
  const [doctrine, setDoctrine] = useState<DoctrineId>('industrial');
  const [chosen, setChosen] = useState(SITES[0].key);

  const loadSite = useWorldStore((state) => state.loadSite);
  const initialise = useColonyStore((state) => state.initialise);

  /*
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

  const site = useMemo(
    () => SITES.find((entry) => entry.key === chosen) ?? SITES[0],
    [chosen],
  );

  const stepIndex = STEPS.findIndex((entry) => entry.key === step);
  const canAdvance = step !== 'commander' || corporation.trim().length > 0;

  const begin = () => {
    useProfileStore.getState().set({
      commander: commander.trim() || 'Commander',
      corporation: corporation.trim() || 'Kryonis Industries',
      doctrine,
    });

    useTimeStore.getState().reset();
    useProgressStore.getState().reset();
    useCrewStore.getState().reset();
    loadSite(site.config, site.name);
    initialise(useWorldStore.getState().terrain);
    onBegin();
  };

  return (
    <div className="anim-fade absolute inset-0 z-50 flex flex-col overflow-y-auto bg-void/96 backdrop-blur-2xl">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8 min-[1180px]:px-10 min-[1180px]:py-10">
        {/* --- Masthead ---------------------------------------------------- */}
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <span className="text-[2.1rem] leading-none font-light tracking-[0.5em] text-bone">
              KRYONIS
            </span>
            <p className="t-sm mt-3 max-w-lg leading-relaxed text-ash">
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
              className="press glass rounded-[3px] px-4 py-3 text-left"
            >
              <span className="t-micro block text-dust">Continue</span>
              <span className="t-md mt-1.5 block text-bone">{saved.siteName}</span>
              <span className="t-sm mt-1.5 block text-ash">
                Sol {Math.floor(saved.sols) + 1} · {saved.buildings} structures ·{' '}
                {describeAge(saved.savedAt)}
              </span>
            </button>
          ) : null}
        </header>

        {/* --- Step rail --------------------------------------------------- */}
        <nav className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-3">
          {STEPS.map((entry, index) => {
            const done = index < stepIndex;
            const active = index === stepIndex;
            return (
              <span key={entry.key} className="flex items-center gap-2">
                {index > 0 ? <span className="h-px w-6 bg-white/12 min-[900px]:w-10" /> : null}
                <button
                  type="button"
                  // Only steps already answered may be revisited; jumping ahead
                  // would skip questions the confirmation depends on.
                  disabled={index > stepIndex}
                  onClick={() => setStep(entry.key)}
                  className={`press flex items-center gap-2.5 rounded-[3px] px-3 py-2 ${
                    active ? 'state-owned' : done ? 'state-open' : 'state-locked'
                  } disabled:cursor-default`}
                >
                  <span
                    className={`t-num grid h-5 w-5 place-items-center rounded-full text-[0.6rem] ${
                      active || done ? 'bg-dust text-void' : 'bg-white/10 text-faint'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className={`t-sm ${active ? 'text-bone' : done ? 'text-ash' : 'text-faint'}`}>
                    {entry.label}
                  </span>
                </button>
              </span>
            );
          })}
        </nav>

        <p className="t-micro mt-4 text-steel">{STEPS[stepIndex].legend}</p>
        <span className="rule-x mt-3" />

        {/* --- The current step -------------------------------------------- */}
        <div className="anim-rise mt-7 flex-1" key={step}>
          {step === 'commander' ? (
            <CommanderStep
              commander={commander}
              corporation={corporation}
              onCommander={setCommander}
              onCorporation={setCorporation}
            />
          ) : step === 'doctrine' ? (
            <DoctrineStep chosen={doctrine} onChoose={setDoctrine} />
          ) : step === 'site' ? (
            <SiteStep chosen={chosen} onChoose={setChosen} surveys={surveys} />
          ) : (
            <ConfirmStep
              commander={commander.trim() || 'Commander'}
              corporation={corporation.trim() || 'Kryonis Industries'}
              doctrine={doctrine}
              site={site}
            />
          )}
        </div>

        {/* --- Navigation --------------------------------------------------- */}
        <div className="mt-8 flex items-center justify-between gap-4">
          <button
            type="button"
            disabled={stepIndex === 0}
            onClick={() => setStep(STEPS[Math.max(0, stepIndex - 1)].key)}
            className="press rounded-[3px] border border-white/10 px-5 py-3 text-titanium transition-colors hover:text-bone disabled:cursor-not-allowed disabled:opacity-0"
          >
            <span className="t-sm">Back</span>
          </button>

          {step === 'confirm' ? (
            <button
              type="button"
              onClick={begin}
              className="press rounded-[3px] bg-dust px-10 py-3.5 text-void transition-colors hover:brightness-110"
            >
              <span className="t-md tracking-[0.2em] uppercase">Begin descent</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!canAdvance}
              onClick={() => setStep(STEPS[Math.min(STEPS.length - 1, stepIndex + 1)].key)}
              className="press rounded-[3px] bg-dust px-8 py-3.5 text-void transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-faint"
            >
              <span className="t-md tracking-[0.14em] uppercase">Continue</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CommanderStep({
  commander,
  corporation,
  onCommander,
  onCorporation,
}: {
  commander: string;
  corporation: string;
  onCommander: (value: string) => void;
  onCorporation: (value: string) => void;
}) {
  return (
    <div className="grid gap-7 min-[900px]:grid-cols-2">
      <div>
        <Field
          label="Your name"
          hint="How mission control will address you. Leave blank for 'Commander'."
          value={commander}
          placeholder="Commander"
          onChange={onCommander}
        />
        <Field
          className="mt-6"
          label="Programme name"
          hint="Shown in the corner of the screen for the rest of the game."
          value={corporation}
          placeholder="Kryonis Industries"
          onChange={onCorporation}
        />
      </div>

      <div className="state-open rounded-[3px] p-5">
        <span className="t-micro">Briefing</span>
        <p className="t-sm mt-3 leading-relaxed text-ash">
          One lander, four people and roughly two years of consumables. Everything after that has
          to come out of the ground you land on — the air, the water, the metal and the fuel to
          leave again.
        </p>
        <p className="t-sm mt-3 leading-relaxed text-ash">
          Nothing here can kill the colony outright. Life support can fail and people can die, but
          the programme survives and rebuilds. The only real failure is standing still.
        </p>
      </div>
    </div>
  );
}

function DoctrineStep({
  chosen,
  onChoose,
}: {
  chosen: DoctrineId;
  onChoose: (id: DoctrineId) => void;
}) {
  return (
    <div className="grid gap-4 min-[900px]:grid-cols-3">
      {DOCTRINE_IDS.map((id) => {
        const doctrine = DOCTRINES[id];
        const active = chosen === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChoose(id)}
            aria-pressed={active}
            className={`press flex flex-col rounded-[3px] p-5 text-left ${
              active ? 'state-owned' : 'state-open hover:bg-white/[0.06]'
            }`}
          >
            <span className={`t-md ${active ? 'text-dust' : 'text-bone'}`}>{doctrine.name}</span>
            <p className="t-sm mt-2.5 leading-snug text-ash">{doctrine.premise}</p>

            <dl className="mt-5 space-y-3">
              <div>
                <dt className="t-micro text-good">Strengths</dt>
                <dd className="mt-1.5 space-y-1">
                  {doctrine.strengths.map((line) => (
                    <p key={line} className="t-sm leading-snug text-bone">
                      {line}
                    </p>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="t-micro text-warn">Costs</dt>
                <dd className="mt-1.5 space-y-1">
                  {doctrine.weaknesses.map((line) => (
                    <p key={line} className="t-sm leading-snug text-ash">
                      {line}
                    </p>
                  ))}
                </dd>
              </div>
            </dl>
          </button>
        );
      })}
    </div>
  );
}

function SiteStep({
  chosen,
  onChoose,
  surveys,
}: {
  chosen: string;
  onChoose: (key: string) => void;
  surveys: { key: string; survey: ReturnType<typeof surveySite> }[];
}) {
  return (
    <div className="grid gap-4 min-[900px]:grid-cols-3">
      {SITES.map((site) => {
        const survey = surveys.find((entry) => entry.key === site.key)?.survey;
        const active = chosen === site.key;

        return (
          <button
            key={site.key}
            type="button"
            onClick={() => onChoose(site.key)}
            aria-pressed={active}
            className={`press flex flex-col rounded-[3px] p-5 text-left ${
              active ? 'state-owned' : 'state-open hover:bg-white/[0.06]'
            }`}
          >
            <span className={active ? 'text-dust' : 'text-titanium'}>
              <PlanetIcon className="h-7 w-7" />
            </span>

            <span className={`t-md mt-3.5 ${active ? 'text-dust' : 'text-bone'}`}>
              {site.name}
            </span>
            <span className="t-micro mt-1.5">{site.region}</span>

            <p className="t-sm mt-3.5 flex-1 leading-snug text-ash">{site.blurb}</p>

            {survey ? (
              <dl className="mt-5 space-y-1.5">
                <Stat label="Buildable" value={survey.valley.buildableFraction} />
                <Stat label="Ice" value={survey.valley.iceFraction} />
                <Stat
                  label="Ore"
                  value={Math.min(1, survey.valley.depositTiles / 1600)}
                  display={`${survey.valley.depositTiles}`}
                />
              </dl>
            ) : (
              <p className="t-sm mt-5 text-faint">Surveying…</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** The last screen before landing: every answer, and what it did. */
function ConfirmStep({
  commander,
  corporation,
  doctrine,
  site,
}: {
  commander: string;
  corporation: string;
  doctrine: DoctrineId;
  site: SiteOption;
}) {
  const entry = DOCTRINES[doctrine];

  return (
    <div className="grid gap-5 min-[900px]:grid-cols-2">
      <div className="state-open rounded-[3px] p-6">
        <span className="t-micro">Mission profile</span>
        <dl className="mt-4 space-y-3.5">
          <Summary label="Commander" value={commander} />
          <Summary label="Programme" value={corporation} />
          <Summary label="Doctrine" value={entry.name} />
          <Summary label="Landing site" value={site.name} />
          <Summary label="Region" value={site.region} />
        </dl>
      </div>

      <div className="state-owned rounded-[3px] p-6">
        <span className="t-micro text-dust">What your doctrine changes</span>
        <ul className="mt-4 space-y-2.5">
          {entry.researchCostScale !== 1 ? (
            <Effect text={`Research projects cost ${Math.round((1 - entry.researchCostScale) * 100)}% less`} />
          ) : null}
          {entry.buildTimeScale !== 1 ? (
            <Effect text={`Construction is ${Math.round((1 - entry.buildTimeScale) * 100)}% faster`} />
          ) : null}
          {entry.lifeSupportScale !== 1 ? (
            <Effect
              text={`Air, water and food drain ${Math.round((1 - entry.lifeSupportScale) * 100)}% slower`}
            />
          ) : null}
          {Object.entries(entry.startingStock).map(([id, amount]) => (
            <Effect
              key={id}
              text={`${amount > 0 ? '+' : ''}${amount} starting ${id === 'money' ? 'credits' : id}`}
              tone={amount > 0 ? 'good' : 'warn'}
            />
          ))}
          {entry.freeResearch ? <Effect text="One research project already complete" /> : null}
        </ul>

        <p className="t-sm mt-5 leading-relaxed text-ash">
          None of this can be changed after landing. Everything else — what you build, who you
          hire, how far you claim — still can.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  placeholder,
  onChange,
  className = '',
}: {
  label: string;
  hint: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="t-micro">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        maxLength={34}
        className="glass mt-2.5 w-full rounded-[3px] px-4 py-3 text-bone outline-none placeholder:text-faint focus:ring-1 focus:ring-dust"
      />
      <span className="t-sm mt-2 block leading-snug text-faint">{hint}</span>
    </label>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="t-micro">{label}</dt>
      <dd className="t-md truncate text-bone">{value}</dd>
    </div>
  );
}

function Effect({ text, tone = 'good' }: { text: string; tone?: 'good' | 'warn' }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={`mt-[7px] h-1 w-1 shrink-0 rounded-full ${
          tone === 'good' ? 'bg-good' : 'bg-warn'
        }`}
      />
      <span className="t-sm leading-snug text-bone">{text}</span>
    </li>
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
    <div className="flex items-center gap-2.5">
      <dt className="t-micro w-14 shrink-0">{label}</dt>
      <dd className="flex flex-1 items-center gap-2.5">
        <span className="h-1 flex-1 rounded-full bg-white/10">
          <span
            className="block h-1 rounded-full bg-dust"
            style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
          />
        </span>
        <span className="t-num w-9 shrink-0 text-right text-[0.65rem] text-ash">
          {display ?? `${Math.round(value * 100)}%`}
        </span>
      </dd>
    </div>
  );
}
