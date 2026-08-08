/**
 * What a structure is doing, in words.
 *
 * Every building in the colony can answer three questions at any moment: what
 * is my job, am I doing it, and if not, what is stopping me. Before this the
 * game answered none of them - a finished structure looked identical whether it
 * was running flat out, starved of water, or standing dark because nobody had
 * run a road to it, and the only feedback was a resource bar that failed to go
 * up somewhere else entirely.
 *
 * The wording rules, which are not negotiable:
 *
 *   - **Say the job, not the category.** "Producing oxygen", not "Life Support".
 *   - **Name the fix, not the fault.** "Not connected to a road" tells you what
 *     to do; "offline" tells you to go looking.
 *   - **Plain English.** "Carbon dioxide", never "CO₂" - the same rule the rest
 *     of the interface follows.
 *
 * Everything here is derived from the catalog and from the simulation's own
 * per-tick activity record, so a new structure needs no status text written for
 * it and cannot fall out of step with what it actually does.
 */

import { RESOURCES, type ResourceId } from '../core/resources';
import { activityOf, type ActivityLimit } from '../sim/simulation';
import { serviceOf } from '../world/roads';
import type { PlacedBuilding } from '../state/useColonyStore';
import { BUILDINGS, upgradeTier, type BuildingDef } from './catalog';

export type StatusTone = 'good' | 'warn' | 'alert' | 'idle';

export interface StructureStatus {
  /** What it is doing, or the thing that is wrong. One short clause. */
  headline: string;
  /** The supporting figure or instruction. May be empty. */
  detail: string;
  /** 0-1, how hard it is running. Drives the meter. */
  rate: number;
  tone: StatusTone;
  /** True while it is doing its job, at any rate above nothing. */
  working: boolean;
}

/**
 * A structure's standing job, independent of whether it is managing it today.
 *
 * Derived rather than authored: a building that outputs something is producing
 * it, a building with housing is housing people, and a building with neither is
 * doing whatever its one special case says. Adding a structure to the catalog
 * therefore gives it a correct job description for free.
 */
export function roleOf(def: BuildingDef): string {
  switch (def.id) {
    case 'lander':
      return 'Running the colony';
    case 'battery':
      return 'Banking surplus power';
    case 'exportpad':
      return 'Shipping surplus to Earth';
    case 'storage':
      return 'Holding the colony stores';
    case 'medical':
      return 'Keeping the crew on their feet';
    case 'atrium':
      return 'Keeping the crew sane';
    case 'corridor':
      return 'Linking sectors under pressure';
    case 'road':
      return 'Carrying power and water';
    default:
      break;
  }

  if (def.power > 0) return def.id === 'solar' ? 'Generating solar power' : 'Generating power';

  const output = primaryOutput(def);
  if (output) return `Producing ${RESOURCES[output].label.toLowerCase()}`;

  if (def.housing > 0) return `Housing ${def.housing} crew`;
  if (Object.keys(def.storage).length > 0) return 'Holding stores';
  return 'Supporting the colony';
}

/** The output a structure is best known for: the largest one it makes. */
export function primaryOutput(def: BuildingDef): ResourceId | null {
  let best: ResourceId | null = null;
  let bestAmount = 0;
  for (const [resource, amount] of Object.entries(def.output) as [ResourceId, number][]) {
    // Credits and research are byproducts of almost everything and would
    // otherwise drown out the physical good a plant exists to make.
    const weight = resource === 'money' || resource === 'research' ? amount * 0.05 : amount;
    if (weight > bestAmount) {
      bestAmount = weight;
      best = resource;
    }
  }
  return best;
}

/** Everything a structure makes, per second, at its current tier and rate. */
export function outputLines(
  building: PlacedBuilding,
  rate: number,
): { resource: ResourceId; amount: number }[] {
  const def = BUILDINGS[building.type];
  const scale = upgradeTier(building.level).output;
  return (Object.entries(def.output) as [ResourceId, number][]).map(([resource, amount]) => ({
    resource,
    amount: amount * scale * rate,
  }));
}

/** Everything a structure consumes, per second, at its current tier and rate. */
export function inputLines(
  building: PlacedBuilding,
  rate: number,
): { resource: ResourceId; amount: number }[] {
  const def = BUILDINGS[building.type];
  const scale = upgradeTier(building.level).output;
  return (Object.entries(def.input) as [ResourceId, number][]).map(([resource, amount]) => ({
    resource,
    amount: amount * scale * rate,
  }));
}

/** Plain-English name for a resource, lower case, for use mid-sentence. */
function resourceWord(resource: ResourceId | undefined): string {
  return resource ? RESOURCES[resource].label.toLowerCase() : 'materials';
}

/**
 * The one line that says what this structure is doing right now.
 *
 * `progress` is the live construction fraction, which lives outside the store
 * and so has to be passed in by whoever is drawing the card.
 */
export function structureStatus(
  building: PlacedBuilding,
  progress = 1,
): StructureStatus {
  const def = BUILDINGS[building.type];
  const activity = activityOf(building.id);
  const service = serviceOf(building.id);
  const role = roleOf(def);

  const limit: ActivityLimit =
    building.progress < 1 ? 'construction' : !building.enabled ? 'disabled' : activity.limit;

  switch (limit) {
    case 'construction':
      return {
        headline: building.level > 1 ? 'Being retrofitted' : 'Under construction',
        detail: `${Math.round(progress * 100)}% complete`,
        rate: progress,
        tone: 'warn',
        working: false,
      };

    case 'disabled':
      return {
        headline: 'Switched off',
        detail: 'Producing nothing while it is idle',
        rate: 0,
        tone: 'idle',
        working: false,
      };

    case 'road':
      return {
        headline: 'Not connected',
        detail: 'Lay a road up to it to bring it online',
        rate: 0,
        tone: 'alert',
        working: false,
      };

    case 'power':
      return {
        headline: 'No power on this grid',
        detail: 'Connect this road run to a generator',
        rate: 0,
        tone: 'alert',
        working: false,
      };

    case 'water':
      return {
        headline: 'No water on this grid',
        detail: 'Connect this road run to an ice extractor',
        rate: 0,
        tone: 'alert',
        working: false,
      };

    case 'dark':
      return {
        headline: 'Waiting for sunrise',
        detail: 'Panels make nothing at night — this is what batteries are for',
        rate: 0,
        tone: 'idle',
        working: false,
      };

    case 'input':
      return {
        headline: `Short of ${resourceWord(activity.resource)}`,
        detail: `${role} at ${Math.round(activity.rate * 100)}%`,
        rate: activity.rate,
        tone: activity.rate < 0.35 ? 'alert' : 'warn',
        working: activity.rate > 0,
      };

    case 'crew':
      return {
        headline: 'Understaffed',
        detail: `${role} at ${Math.round(activity.rate * 100)}% — hire crew`,
        rate: activity.rate,
        tone: 'warn',
        working: activity.rate > 0,
      };

    case 'brownout':
      return {
        headline: 'Running on brownout',
        detail: `${role} at ${Math.round(activity.rate * 100)}% — the colony is short of power`,
        rate: activity.rate,
        tone: 'warn',
        working: activity.rate > 0,
      };

    default:
      break;
  }

  // Running. Say what it makes, and how much of it.
  const produced = outputLines(building, activity.rate).filter((line) => line.amount > 0.0005);
  const tier = upgradeTier(building.level);

  /*
   * The detail line, in order of what a player would want to see.
   *
   * A generator's story is kilowatts, not a production rate - it has no
   * `output` entries at all, and reading "Nominal" under a solar array that is
   * carrying the whole colony was the weakest line on the card.
   */
  const rated = Math.round(def.power * tier.output);

  const detail =
    building.type === 'lander'
      ? 'Landing pad, colony stores, and where every road starts'
      : def.power > 0
        ? // "26 kW" when it is making all of it; "11 kW of 26" only when the
          // shortfall is the interesting part. A ratio that always reads x of x
          // trains the eye to skip it.
          activity.rate >= 0.999
          ? `${rated} kW`
          : `${Math.round(rated * activity.rate)} kW of ${rated}`
      : building.type === 'battery'
        ? 'Charging by day, carrying the colony through the night'
        : produced.length > 0
          ? produced
              .slice(0, 2)
              .map((line) => `${formatRate(line.amount)} ${resourceWord(line.resource)}/s`)
              .join(' · ')
          : def.housing > 0
            ? `${def.housing} berths${service.grade === 2 ? ' · on sealed transit' : ''}`
            : Object.keys(def.storage).length > 0
              ? `Holding ${Object.keys(def.storage).length} kinds of stores`
              : 'Nominal';

  return {
    headline: role,
    detail,
    rate: Math.max(activity.rate, 0.001),
    tone: 'good',
    working: true,
  };
}

/** Production rates are small; two significant figures reads better than two decimals. */
function formatRate(amount: number): string {
  if (amount >= 10) return amount.toFixed(0);
  if (amount >= 1) return amount.toFixed(1);
  return amount.toFixed(2);
}

/**
 * The three services a structure needs, and whether it has them.
 *
 * Returned as a list rather than as flags so the interface can render exactly
 * the ones that apply - telling a solar array it has no water is noise, and
 * noise is what stops the one line that matters from being read.
 */
export function serviceChecklist(
  building: PlacedBuilding,
): { label: string; ok: boolean; note: string }[] {
  const def = BUILDINGS[building.type];
  const service = serviceOf(building.id);

  if (building.type === 'lander') {
    return [{ label: 'Road', ok: true, note: 'The colony spine starts here' }];
  }

  const rows = [
    {
      label: 'Road',
      ok: service.connected,
      note: service.connected
        ? service.grade === 2
          ? 'On a sealed transit way'
          : 'On a service road'
        : 'Not touching any road',
    },
  ];

  if (def.power < 0) {
    rows.push({
      label: 'Power',
      ok: service.hasPower,
      note: service.hasPower ? 'Grid is live' : 'No generator on this grid',
    });
  }
  if ((def.input.water ?? 0) > 0) {
    rows.push({
      label: 'Water',
      ok: service.hasWater,
      note: service.hasWater ? 'Main is pressurised' : 'No extractor on this grid',
    });
  }

  return rows;
}
