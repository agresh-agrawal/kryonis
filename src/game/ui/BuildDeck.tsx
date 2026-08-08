'use client';

import { useMemo, useRef } from 'react';

import {
  BUILDINGS,
  PLACEABLE_BUILDINGS,
  missingRequirementNames,
  unlockState,
  type BuildingId,
} from '../buildings/catalog';
import { RESOURCES, canAfford, formatAmount, type ResourceId } from '../core/resources';
import { BUILD_TABS, useBuildStore } from '../state/useBuildStore';
import { useColonyStore } from '../state/useColonyStore';
import { gradeUnlocked, useRoadStore } from '../state/useRoadStore';
import { useThumbnailStore } from '../state/useThumbnailStore';
import { ROAD_GRADE_LIST, type RoadGradeDef } from '../world/roadGrades';
import { BUILDING_ICONS } from './buildingIcons';
import { CrewIcon, PowerIcon } from './icons';

/**
 * The construction deck.
 *
 * A shelf of objects, not a list of options. Each card is mostly render: the
 * structure is the content, and the name is a caption for it. Cost sits alone
 * in the corner because it is the only number needed to decide whether to click.
 *
 * Everything else a player might want - production rates, prerequisites, the
 * science behind it - lives in the inspector after placement. Putting it on the
 * card would turn a shelf back into a spreadsheet.
 *
 * Roads are the last tray. They are not structures - they are painted into a
 * flat grid rather than stamped into the building list - but that is a fact
 * about the code, not about the player, who is choosing a thing and putting it
 * on the ground either way.
 */
export function BuildDeck({ onDismiss }: { onDismiss: () => void }) {
  const tab = useBuildStore((state) => state.tab);
  const setTab = useBuildStore((state) => state.setTab);
  const scroller = useRef<HTMLDivElement>(null);

  const stock = useColonyStore((state) => state.stock);
  const buildings = useColonyStore((state) => state.buildings);
  const selectedType = useBuildStore((state) => state.selectedType);
  const tool = useBuildStore((state) => state.tool);
  const chooseBuilding = useBuildStore((state) => state.chooseBuilding);

  const completedTypes = useMemo(() => {
    const set = new Set<BuildingId>();
    for (const building of buildings) {
      if (building.progress >= 1) set.add(building.type);
    }
    return set;
  }, [buildings]);

  const entries =
    tab === 'Roads' ? [] : PLACEABLE_BUILDINGS.filter((id) => BUILDINGS[id].category === tab);

  return (
    <div className="anim-rise pointer-events-auto flex w-full max-w-[54rem] flex-col items-center gap-2 min-[1180px]:gap-3">
      {/* Categories: text only, spaced wide, marked by a hairline. */}
      <div className="glass quiet-scroll flex max-w-full items-center gap-1 overflow-x-auto rounded-[3px] px-1.5 py-1">
        {BUILD_TABS.map((name) => {
          const isActive = tab === name;
          const total =
            name === 'Roads'
              ? ROAD_GRADE_LIST.length
              : PLACEABLE_BUILDINGS.filter((id) => BUILDINGS[id].category === name).length;
          const open =
            name === 'Roads'
              ? ROAD_GRADE_LIST.filter((grade) => gradeUnlocked(grade.grade)).length
              : PLACEABLE_BUILDINGS.filter(
                  (id) => BUILDINGS[id].category === name && unlockState(id, completedTypes).unlocked,
                ).length;

          return (
            <button
              key={name}
              type="button"
              onClick={() => {
                setTab(name);
                scroller.current?.scrollTo({ left: 0, behavior: 'smooth' });
              }}
              aria-pressed={isActive}
              className={`press relative shrink-0 rounded-[2px] px-2.5 py-1.5 transition-colors min-[1180px]:px-3.5 ${
                isActive ? 'text-bone' : 'text-titanium hover:text-ash'
              }`}
            >
              <span className="t-micro tracking-[0.16em]">{name}</span>
              {open < total ? (
                <span className="t-num ml-1.5 text-[0.55rem] text-faint">
                  {open}/{total}
                </span>
              ) : null}
              <span
                className={`absolute inset-x-2.5 -bottom-px h-px transition-opacity duration-300 ${
                  isActive ? 'bg-dust opacity-100' : 'opacity-0'
                }`}
              />
            </button>
          );
        })}

        <span className="rule-y mx-1 h-5" />

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close construction"
          title="Close construction (Esc)"
          className="press grid h-7 w-7 place-items-center rounded-[2px] text-titanium hover:text-bone"
        >
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-current" aria-hidden>
            <path d="M2.4 1.3L6 4.9l3.6-3.6 1.1 1.1L7.1 6l3.6 3.6-1.1 1.1L6 7.1l-3.6 3.6-1.1-1.1L4.9 6 1.3 2.4z" />
          </svg>
        </button>
      </div>

      {/* The shelf. */}
      <div
        ref={scroller}
        className="quiet-scroll fade-edges-x flex w-full gap-2 overflow-x-auto px-5 pb-1.5 pt-1 min-[1180px]:gap-3 min-[1180px]:px-10 min-[1180px]:pb-2"
      >
        {tab === 'Roads' ? <RoadTray /> : null}

        {entries.map((id) => {
          const state = unlockState(id, completedTypes);
          return (
            <Card
              key={id}
              id={id}
              locked={!state.unlocked}
              missing={state.missing}
              affordable={canAfford(stock, BUILDINGS[id].cost)}
              active={tool === 'build' && selectedType === id}
              stock={stock}
              onSelect={() => chooseBuilding(id)}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * The two road grades.
 *
 * Both are always shown. A locked grade that is simply absent teaches the
 * player nothing; a locked grade sitting next to the one they can afford is
 * what makes the research worth going and getting.
 */
function RoadTray() {
  const tool = useBuildStore((state) => state.tool);
  const setTool = useBuildStore((state) => state.setTool);
  const cancel = useBuildStore((state) => state.cancel);
  const grade = useRoadStore((state) => state.grade);
  const setGrade = useRoadStore((state) => state.setGrade);
  const money = useColonyStore((state) => state.stock.money);

  return (
    <>
      {ROAD_GRADE_LIST.map((def) => {
        const unlocked = gradeUnlocked(def.grade);
        const active = tool === 'road' && grade === def.grade;
        return (
          <RoadCard
            key={def.grade}
            def={def}
            locked={!unlocked}
            affordable={money >= def.cost}
            active={active}
            onSelect={() => {
              if (!unlocked) return;
              if (active) {
                cancel();
                return;
              }
              setGrade(def.grade);
              setTool('road');
            }}
          />
        );
      })}
    </>
  );
}

function RoadCard({
  def,
  locked,
  affordable,
  active,
  onSelect,
}: {
  def: RoadGradeDef;
  locked: boolean;
  affordable: boolean;
  active: boolean;
  onSelect: () => void;
}) {
  const sealed = def.grade === 2;

  return (
    <button
      type="button"
      disabled={locked}
      onClick={onSelect}
      aria-pressed={active}
      title={locked ? `${def.name} — ${def.description}` : def.description}
      className={`press glass-deep group relative flex h-[9.2rem] w-[10rem] shrink-0 flex-col overflow-hidden rounded-[3px] text-left min-[1180px]:h-[10.5rem] min-[1180px]:w-[11.5rem] ${
        active
          ? 'ring-1 ring-dust'
          : locked
            ? 'cursor-not-allowed'
            : 'hover:ring-1 hover:ring-white/20'
      }`}
    >
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,#2a2018_0%,#12100e_74%)]" />

        {/* A run of road in section: the deck, and what is over or beside it. */}
        <div
          className={`absolute inset-0 grid place-items-center transition-transform duration-500 ${
            locked ? 'opacity-55' : 'group-hover:scale-[1.08]'
          }`}
          style={{ transitionTimingFunction: 'var(--ease-spring)' }}
        >
          <svg viewBox="0 0 64 40" className="h-[68%] w-[78%]" aria-hidden>
            {sealed ? (
              <>
                {/* Pressure arch over a poured deck. */}
                <path
                  d="M8 30 A24 20 0 0 1 56 30"
                  fill="rgb(159 212 224 / 0.16)"
                  stroke="#b9c3cc"
                  strokeWidth="1.6"
                />
                <path d="M18 30 A14 12 0 0 1 46 30" fill="none" stroke="#b9c3cc" strokeWidth="0.7" opacity="0.6" />
                <rect x="6" y="29.5" width="52" height="4" rx="0.6" fill="#9aa1a6" />
                <rect x="24" y="30.6" width="16" height="1" rx="0.5" fill="#ffc078" />
                <circle cx="14" cy="35.4" r="1.3" fill="#f0c657" />
                <circle cx="50" cy="35.4" r="1.3" fill="#4fa8e0" />
              </>
            ) : (
              <>
                {/* Graded track with the runs trenched either side. */}
                <rect x="12" y="26" width="40" height="5" rx="0.6" fill="#6d5e50" />
                <rect x="12" y="26" width="40" height="1" fill="#8e857a" opacity="0.7" />
                {[16, 24, 32, 40, 48].map((x) => (
                  <rect key={x} x={x} y="28" width="4" height="1" rx="0.5" fill="#8e857a" opacity="0.5" />
                ))}
                <rect x="5" y="29" width="5" height="2.4" rx="1.2" fill="#f0c657" opacity="0.8" />
                <rect x="54" y="29" width="5" height="2.4" rx="1.2" fill="#4fa8e0" opacity="0.8" />
              </>
            )}
          </svg>
        </div>

        <span className="t-num absolute bottom-1.5 left-2.5 text-[0.58rem] text-faint">1×1</span>

        {locked ? (
          <span className="absolute right-2.5 top-2.5">
            <svg viewBox="0 0 10 12" className="h-3 w-3 fill-titanium" aria-hidden>
              <path d="M2 5V3.5a3 3 0 016 0V5h1v7H1V5zm1.5 0h3V3.5a1.5 1.5 0 00-3 0z" />
            </svg>
          </span>
        ) : sealed ? (
          <span className="t-micro absolute right-2.5 top-2.5 text-dust">+ morale</span>
        ) : null}
      </div>

      <span className="rule-x" />

      <div className="flex items-end justify-between gap-2 px-2.5 py-2 min-[1180px]:px-3 min-[1180px]:py-2.5">
        <span className="min-w-0">
          <span className={`t-sm block truncate ${locked ? 'text-ash' : 'text-bone'}`}>
            {def.name}
          </span>
          <span
            className={`t-micro mt-1 block truncate normal-case tracking-normal ${
              locked ? 'text-warn' : 'text-faint'
            }`}
          >
            {locked ? 'Needs Sealed Roadbed research' : sealed ? `${formatAmount(def.upgradeCost)} to upgrade` : 'per tile'}
          </span>
        </span>

        {!locked ? (
          <span className={`t-num shrink-0 text-[0.82rem] ${affordable ? 'text-dust' : 'text-alert'}`}>
            {formatAmount(def.cost)}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function Card({
  id,
  locked,
  missing,
  affordable,
  active,
  stock,
  onSelect,
}: {
  id: BuildingId;
  locked: boolean;
  missing: BuildingId[];
  affordable: boolean;
  active: boolean;
  stock: Record<ResourceId, number>;
  onSelect: () => void;
}) {
  const def = BUILDINGS[id];
  const Icon = BUILDING_ICONS[id];
  const preview = useThumbnailStore((state) => state.images[id]);

  const material = (Object.entries(def.cost) as [ResourceId, number][]).find(
    ([resource]) => resource !== 'money',
  );

  return (
    <button
      type="button"
      disabled={locked}
      onClick={onSelect}
      aria-pressed={active}
      title={
        locked
          ? `${def.name} — requires ${missingRequirementNames(missing)}`
          : `${def.name} — ${def.summary}`
      }
      className={`press glass-deep group relative flex h-[9.2rem] w-[10rem] shrink-0 flex-col overflow-hidden rounded-[3px] text-left min-[1180px]:h-[10.5rem] min-[1180px]:w-[11.5rem] ${
        active
          ? 'ring-1 ring-dust'
          : locked
            ? 'cursor-not-allowed opacity-45'
            : 'hover:ring-1 hover:ring-white/20'
      }`}
    >
      {/* Illustration occupies most of the card. */}
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,#2a2018_0%,#12100e_74%)]" />

        {/*
          A real render of the structure, baked once from the actual model by
          `ThumbnailBaker`. The SVG glyph stays as the fallback: the bake takes
          a few frames, and an icon is far better than an empty square while it
          runs - or forever, if the render target ever fails.
        */}
        <div
          className={`absolute inset-0 grid place-items-center transition-transform duration-500 ${
            locked ? 'opacity-45 grayscale' : 'group-hover:scale-[1.08]'
          }`}
          style={{ transitionTimingFunction: 'var(--ease-spring)' }}
        >
          {preview ? (
            <img
              src={preview}
              alt=""
              draggable={false}
              className="h-full w-full object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.55)]"
            />
          ) : (
            <span className={locked ? 'text-faint/60' : 'text-steel'}>
              <Icon className="h-12 w-12 min-[1180px]:h-[3.6rem] min-[1180px]:w-[3.6rem]" />
            </span>
          )}
        </div>

        {/* Footprint, bottom-left of the render, very quiet. */}
        <span className="t-num absolute bottom-1.5 left-2.5 text-[0.58rem] text-faint">
          {def.footprint[0]}×{def.footprint[1]}
        </span>

        {locked ? (
          <span className="absolute right-2.5 top-2.5">
            <svg viewBox="0 0 10 12" className="h-3 w-3 fill-titanium" aria-hidden>
              <path d="M2 5V3.5a3 3 0 016 0V5h1v7H1V5zm1.5 0h3V3.5a1.5 1.5 0 00-3 0z" />
            </svg>
          </span>
        ) : (
          <span className="absolute right-2.5 top-2.5 flex items-center gap-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span className="t-num flex items-center gap-0.5 text-[0.58rem] text-ash">
              <PowerIcon className="h-2.5 w-2.5" />
              {def.power > 0 ? '+' : ''}
              {def.power}
            </span>
            {def.workers > 0 ? (
              <span className="t-num flex items-center gap-0.5 text-[0.58rem] text-ash">
                <CrewIcon className="h-2.5 w-2.5" />
                {def.workers}
              </span>
            ) : null}
          </span>
        )}
      </div>

      <span className="rule-x" />

      {/* Caption. */}
      <div className="flex items-end justify-between gap-2 px-2.5 py-2 min-[1180px]:px-3 min-[1180px]:py-2.5">
        <span className="min-w-0">
          <span
            className={`t-sm block truncate ${locked ? 'text-faint' : 'text-bone'}`}
          >
            {def.name}
          </span>
          {locked ? (
            <span className="t-micro mt-1 block truncate normal-case tracking-normal text-warn">
              {missingRequirementNames(missing)}
            </span>
          ) : material ? (
            <span
              className={`t-num mt-1 block text-[0.58rem] ${
                stock[material[0]] < material[1] ? 'text-alert' : 'text-faint'
              }`}
            >
              {formatAmount(material[1])} {RESOURCES[material[0]].short}
            </span>
          ) : null}
        </span>

        {!locked ? (
          <span
            className={`t-num shrink-0 text-[0.82rem] ${affordable ? 'text-dust' : 'text-alert'}`}
          >
            {formatAmount(def.cost.money ?? 0)}
          </span>
        ) : null}
      </div>
    </button>
  );
}
