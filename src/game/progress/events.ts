/**
 * Dynamic events.
 *
 * The design brief is explicit that events should create pressure without
 * being frustrating, so every event here is a *modifier with a timer*, never an
 * instant loss. A dust storm halves solar output for a few minutes; it does not
 * delete your panels. A colony that has built reserves rides it out, and a
 * colony that has not learns why reserves matter - which is the lesson the
 * mechanic exists to teach.
 *
 * Nothing fires during the opening sols, and nothing fires twice in a row
 * without a cooldown, because the fastest way to make a builder feel unfair is
 * to interrupt the player before they have the tools to respond.
 */

import { Random } from '../core/rng';

export type EventId =
  | 'dust-storm'
  | 'oxygen-leak'
  | 'grid-fault'
  | 'supply-delay'
  | 'coolant-failure'
  | 'transit-inspection';

export interface EventEffects {
  /** Multiplies solar generation while active. */
  solar: number;
  /** Multiplies power demand while active. */
  powerDraw: number;
  /** Multiplies oxygen production while active. */
  oxygen: number;
  /** Multiplies water production while active. */
  water: number;
  /** Multiplies industrial output while active. */
  industry: number;
  /** Added to the morale target while active. */
  morale: number;
}

export const NO_EVENT_EFFECTS: EventEffects = {
  solar: 1,
  powerDraw: 1,
  oxygen: 1,
  water: 1,
  industry: 1,
  morale: 0,
};

export interface EventDef {
  id: EventId;
  name: string;
  detail: string;
  severity: 'warning' | 'critical';
  /** Duration in game seconds. */
  duration: number;
  /** Relative likelihood of being chosen. */
  weight: number;
  effects: Partial<EventEffects>;
}

export const EVENTS: Record<EventId, EventDef> = {
  'dust-storm': {
    id: 'dust-storm',
    name: 'Dust Storm',
    detail: 'Airborne dust is blanketing the arrays. Solar output is badly reduced.',
    severity: 'warning',
    duration: 260,
    weight: 30,
    effects: { solar: 0.35, industry: 0.85, morale: -0.05 },
  },
  'oxygen-leak': {
    id: 'oxygen-leak',
    name: 'Seal Breach',
    detail: 'A habitat seal is venting. Oxygen production is being diverted to make up losses.',
    severity: 'critical',
    duration: 150,
    weight: 18,
    effects: { oxygen: 0.5, morale: -0.08 },
  },
  'grid-fault': {
    id: 'grid-fault',
    name: 'Grid Fault',
    detail: 'A bus fault is forcing everything through a degraded feed. Demand has risen.',
    severity: 'warning',
    duration: 180,
    weight: 20,
    effects: { powerDraw: 1.3, morale: -0.03 },
  },
  'supply-delay': {
    id: 'supply-delay',
    name: 'Launch Window Missed',
    detail: 'The transfer window has closed. No resupply until the next one - live on what you have.',
    severity: 'warning',
    duration: 300,
    weight: 16,
    effects: { industry: 0.9, morale: -0.04 },
  },
  'coolant-failure': {
    id: 'coolant-failure',
    name: 'Coolant Loss',
    detail: 'Radiator loop pressure is falling. Industrial plant is throttled to shed heat.',
    severity: 'warning',
    duration: 170,
    weight: 14,
    effects: { industry: 0.55, powerDraw: 1.15 },
  },
  'transit-inspection': {
    id: 'transit-inspection',
    name: 'Earth Inspection',
    detail: 'An oversight delegation is touring the colony. The crew are on their best behaviour.',
    severity: 'warning',
    duration: 200,
    weight: 8,
    effects: { morale: 0.08, industry: 0.92 },
  },
};

export interface ActiveEvent {
  id: EventId;
  /** Game seconds left to run. */
  remaining: number;
  /** Total duration, for progress display. */
  duration: number;
}

/** No event may fire before this many sols have elapsed. */
export const EVENT_GRACE_SOLS = 2;

/** Minimum game seconds between events. */
export const EVENT_COOLDOWN = 420;

/** Combines every running event into one set of multipliers. */
export function aggregateEventEffects(active: ActiveEvent[]): EventEffects {
  const total: EventEffects = { ...NO_EVENT_EFFECTS };

  for (const entry of active) {
    const def = EVENTS[entry.id];
    if (!def) continue;
    for (const [key, value] of Object.entries(def.effects) as [keyof EventEffects, number][]) {
      if (key === 'morale') total.morale += value;
      else total[key] *= value;
    }
  }

  return total;
}

/**
 * Picks the next event by weight, skipping anything already running.
 *
 * @param seed varied per roll so successive draws are not identical
 */
export function rollEvent(seed: number, active: ActiveEvent[]): EventDef | null {
  const running = new Set(active.map((entry) => entry.id));
  const candidates = Object.values(EVENTS).filter((event) => !running.has(event.id));
  if (candidates.length === 0) return null;

  const totalWeight = candidates.reduce((sum, event) => sum + event.weight, 0);
  const roll = new Random(seed).float() * totalWeight;

  let cursor = 0;
  for (const event of candidates) {
    cursor += event.weight;
    if (roll <= cursor) return event;
  }

  return candidates[candidates.length - 1];
}
