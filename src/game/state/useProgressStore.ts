'use client';

import { create } from 'zustand';

import {
  EVENTS,
  EVENT_COOLDOWN,
  EVENT_GRACE_SOLS,
  aggregateEventEffects,
  rollEvent,
  type ActiveEvent,
  type EventEffects,
} from '../progress/events';
import {
  MISSIONS,
  generateMission,
  type Mission,
  type MissionContext,
} from '../progress/missions';
import {
  RESEARCH,
  aggregateEffects,
  isAvailable,
  type ResearchEffects,
  type ResearchId,
} from '../progress/research';
import type { ResourceBundle, ResourceStock } from '../core/resources';

export interface CompletedDirective {
  id: string;
  title: string;
  reward: ResourceBundle;
  /** Sol on which it was completed, for the log. */
  sol: number;
}

interface ProgressState {
  unlocked: Set<ResearchId>;
  /** Cached aggregate so the simulation does not recompute it every tick. */
  effects: ResearchEffects;

  /** Index into MISSIONS; beyond its length, directives are generated. */
  missionIndex: number;
  /** The directives currently issued. */
  active: Mission[];
  completed: CompletedDirective[];

  events: ActiveEvent[];
  eventEffects: EventEffects;
  /** Game seconds until another event may fire. */
  eventCooldown: number;
  /** Most recent event, surfaced as a toast. */
  lastEvent: { id: string; at: number } | null;

  unlockResearch: (id: ResearchId) => boolean;
  /** Advances directives and events. Returns rewards to pay out. */
  tick: (dt: number, sols: number, ctx: MissionContext) => ResourceBundle[];
  reset: () => void;
}

function initialMissions(): Mission[] {
  return MISSIONS.slice(0, 2);
}

export const useProgressStore = create<ProgressState>((set, get) => ({
  unlocked: new Set<ResearchId>(),
  effects: aggregateEffects(new Set()),

  missionIndex: 2,
  active: initialMissions(),
  completed: [],

  events: [],
  eventEffects: aggregateEventEffects([]),
  eventCooldown: EVENT_COOLDOWN,
  lastEvent: null,

  unlockResearch: (id) => {
    const state = get();
    if (!isAvailable(id, state.unlocked)) return false;

    const unlocked = new Set(state.unlocked);
    unlocked.add(id);
    set({ unlocked, effects: aggregateEffects(unlocked) });
    return true;
  },

  tick: (dt, sols, ctx) => {
    const state = get();
    const rewards: ResourceBundle[] = [];

    // --- Directives -----------------------------------------------------
    let { missionIndex } = state;
    let active = state.active;
    let completed = state.completed;

    const finished = active.filter((mission) => mission.measure(ctx) >= mission.target);
    if (finished.length > 0) {
      const remaining = active.filter((mission) => !finished.includes(mission));
      const additions: Mission[] = [];

      for (const mission of finished) {
        rewards.push(mission.reward);
        completed = [
          { id: mission.id, title: mission.title, reward: mission.reward, sol: Math.floor(sols) + 1 },
          ...completed,
        ].slice(0, 20);

        // Issue a replacement so two directives are always live.
        const next =
          missionIndex < MISSIONS.length
            ? MISSIONS[missionIndex]
            : generateMission(missionIndex - MISSIONS.length, ctx);
        missionIndex++;
        additions.push(next);
      }

      active = [...remaining, ...additions];
    }

    // --- Events ---------------------------------------------------------
    let events = state.events
      .map((entry) => ({ ...entry, remaining: entry.remaining - dt }))
      .filter((entry) => entry.remaining > 0);

    let eventCooldown = state.eventCooldown - dt;
    let lastEvent = state.lastEvent;

    if (sols >= EVENT_GRACE_SOLS && eventCooldown <= 0) {
      const def = rollEvent(Math.floor(sols * 1000 + events.length * 7 + ctx.totalBuildings), events);
      if (def) {
        events = [...events, { id: def.id, remaining: def.duration, duration: def.duration }];
        lastEvent = { id: def.id, at: Date.now() };
      }
      // Larger colonies attract slightly more incident, but never a pile-up.
      eventCooldown = EVENT_COOLDOWN * (0.75 + Math.random() * 0.6);
    }

    const changed =
      finished.length > 0 ||
      events.length !== state.events.length ||
      lastEvent !== state.lastEvent;

    if (changed) {
      set({
        missionIndex,
        active,
        completed,
        events,
        eventEffects: aggregateEventEffects(events),
        eventCooldown,
        lastEvent,
      });
    } else {
      // Timers still advance even when nothing structural changed, but we
      // avoid replacing the arrays so subscribers do not re-render.
      set({ eventCooldown, events });
    }

    return rewards;
  },

  reset: () =>
    set({
      unlocked: new Set<ResearchId>(),
      effects: aggregateEffects(new Set()),
      missionIndex: 2,
      active: initialMissions(),
      completed: [],
      events: [],
      eventEffects: aggregateEventEffects([]),
      eventCooldown: EVENT_COOLDOWN,
      lastEvent: null,
    }),
}));

/** Research points cost, exposed for the UI. */
export function researchCost(id: ResearchId): number {
  return RESEARCH[id].cost;
}

/** Spendable check used by the research panel. */
export function canResearch(
  id: ResearchId,
  unlocked: ReadonlySet<ResearchId>,
  stock: ResourceStock,
): boolean {
  return isAvailable(id, unlocked) && stock.research >= RESEARCH[id].cost;
}

/** Human-readable name for an active event. */
export function eventName(id: string): string {
  return EVENTS[id as keyof typeof EVENTS]?.name ?? id;
}
