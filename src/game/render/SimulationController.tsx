'use client';

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

import type { BuildingId } from '../buildings/catalog';
import type { ResourceId } from '../core/resources';
import type { MissionContext } from '../progress/missions';
import { useColonyStore } from '../state/useColonyStore';
import { useRoadStore } from '../state/useRoadStore';
import { useCrewStore } from '../state/useCrewStore';
import { currentDoctrine } from '../state/useProfileStore';
import { useProgressStore } from '../state/useProgressStore';
import { useTimeStore, worldClock } from '../state/useTimeStore';
import { currentSun } from '../world/sun';
import { stepColony, type SimModifiers } from '../sim/simulation';

/**
 * Fixed-timestep driver for the colony.
 *
 * The simulation runs on its own clock rather than per rendered frame, for two
 * reasons. Results become independent of framerate - a colony on a 144Hz
 * monitor must not produce oxygen faster than one on a laptop - and the store
 * is written four times a second instead of sixty, so the HUD re-renders at a
 * sane rate while the 3D scene keeps running at full speed.
 */
const TICK_SECONDS = 0.25;

/** Ceiling on catch-up ticks, so a backgrounded tab cannot freeze the page. */
const MAX_TICKS_PER_FRAME = 8;

/** Directives and events are evaluated far less often than the economy. */
const PROGRESS_INTERVAL = 1;

export function SimulationController() {
  /*
   * Re-solve the road networks whenever the colony's structures change.
   *
   * Placing a generator can energise a whole grid and demolishing one can kill
   * it, so the network cannot be solved once at load. It is solved on change
   * rather than per tick because it is O(tiles) and nothing about it moves
   * between builds.
   */
  const buildings = useColonyStore((state) => state.buildings);
  useEffect(() => {
    useRoadStore.getState().resolve();
  }, [buildings]);

  const paused = useTimeStore((state) => state.paused);
  const speed = useTimeStore((state) => state.speed);
  const accumulator = useRef(0);
  const progressTimer = useRef(0);

  useFrame((_, rawDelta) => {
    if (paused) return;

    const scaled = Math.min(rawDelta, 0.25) * speed;
    accumulator.current += scaled;

    // Research is permanent, events are temporary; the simulation only ever
    // sees the product of the two.
    const progress = useProgressStore.getState();
    const research = progress.effects;
    const event = progress.eventEffects;

    const mods: SimModifiers = {
      solar: research.solarOutput * event.solar,
      oxygen: research.oxygenOutput * event.oxygen,
      water: research.waterOutput * event.water,
      food: research.foodOutput,
      industry: research.industryOutput * event.industry,
      powerDraw: research.powerDraw * event.powerDraw,
      storage: research.storage,
      morale: research.morale + event.morale,
      lifeSupportDraw: currentDoctrine().lifeSupportScale,
    };

    let ticks = 0;
    while (accumulator.current >= TICK_SECONDS && ticks < MAX_TICKS_PER_FRAME) {
      accumulator.current -= TICK_SECONDS;
      ticks++;

      const state = useColonyStore.getState();
      const result = stepColony(
        TICK_SECONDS,
        {
          stock: state.stock,
          population: state.population,
          happiness: state.happiness,
          batteryCharge: state.batteryCharge,
        },
        state.buildings,
        currentSun.solarFactor,
        mods,
      );
      state.applyStep(result);
      if (result.deaths > 0) useCrewStore.getState().reconcilePopulation(result.population);
    }

    if (ticks >= MAX_TICKS_PER_FRAME) accumulator.current = 0;

    // --- Directives and events ------------------------------------------
    progressTimer.current += scaled;
    if (progressTimer.current < PROGRESS_INTERVAL) return;

    const elapsed = progressTimer.current;
    progressTimer.current = 0;

    const colony = useColonyStore.getState();

    const counts: Partial<Record<BuildingId, number>> = {};
    let totalBuildings = 0;
    for (const building of colony.buildings) {
      if (building.progress < 1) continue;
      counts[building.type] = (counts[building.type] ?? 0) + 1;
      totalBuildings++;
    }

    const context: MissionContext = {
      population: colony.stats.population,
      housing: colony.stats.housing,
      counts,
      totalBuildings,
      stock: colony.stock,
      happiness: colony.stats.happiness,
      powerProduction: colony.stats.powerProduction,
      researchUnlocked: progress.unlocked.size,
      sols: worldClock.sols,
    };

    const rewards = useProgressStore.getState().tick(elapsed, worldClock.sols, context);

    // Directive payouts are applied as one batch so a double completion cannot
    // race two separate store writes.
    if (rewards.length > 0) {
      const stock = { ...useColonyStore.getState().stock };
      for (const reward of rewards) {
        for (const [resource, amount] of Object.entries(reward) as [ResourceId, number][]) {
          stock[resource] += amount;
        }
      }
      useColonyStore.setState({ stock });
    }
  });

  return null;
}
