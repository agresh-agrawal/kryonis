'use client';

import { BUILDING_IDS } from '../buildings/catalog';
import { useColonyStore } from '../state/useColonyStore';
import { useCrewStore } from '../state/useCrewStore';
import { useProgressStore } from '../state/useProgressStore';
import { worldClock } from '../state/useTimeStore';
import { useWorldStore } from '../state/useWorldStore';
import { MISSIONS, generateMission } from '../progress/missions';
import type { ResearchId } from '../progress/research';
import { aggregateEffects } from '../progress/research';
import { resetColonists } from '../colonists/colonists';
import {
  pruneUnknownBuildings,
  readSave,
  writeSave,
  SAVE_VERSION,
  type SaveGame,
} from './saveGame';

const KNOWN_BUILDINGS = new Set<string>(BUILDING_IDS);

/** Builds a save document from whatever is currently in memory. */
export function captureSave(): SaveGame {
  const colony = useColonyStore.getState();
  const crew = useCrewStore.getState();
  const progress = useProgressStore.getState();
  const world = useWorldStore.getState();

  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    siteName: world.siteName,
    terrain: world.terrain.config,
    sols: worldClock.sols,
    colony: {
      buildings: colony.buildings,
      stock: colony.stock,
      unlockedRadius: colony.unlockedRadius,
      population: colony.population,
      happiness: colony.happiness,
      batteryCharge: colony.batteryCharge,
    },
    crew: {
      roster: crew.roster,
      assignedResearcherId: crew.assignedResearcherId,
    },
    progress: {
      unlocked: [...progress.unlocked],
      missionIndex: progress.missionIndex,
      activeMissionIds: progress.active.map((mission) => mission.id),
      completed: progress.completed.map(({ id, title, sol }) => ({ id, title, sol })),
    },
  };
}

export function saveNow(): boolean {
  return writeSave(captureSave());
}

/**
 * Restores a save into the live stores.
 *
 * Order matters: the region has to exist before buildings can be stamped into
 * the occupancy grid, and colonists are cleared so they respawn against the
 * restored colony rather than walking to workplaces that no longer exist.
 */
export function loadSave(): boolean {
  const save = readSave();
  if (!save) return false;

  const world = useWorldStore.getState();
  world.loadSite(save.terrain, save.siteName);

  resetColonists();

  const buildings = pruneUnknownBuildings(save.colony.buildings, KNOWN_BUILDINGS);
  useColonyStore.getState().restore({
    buildings,
    stock: save.colony.stock,
    unlockedRadius: save.colony.unlockedRadius,
    population: save.colony.population,
    happiness: save.colony.happiness,
    batteryCharge: save.colony.batteryCharge,
  });
  useCrewStore.getState().restore(save.crew);
  useCrewStore.getState().reconcilePopulation(save.colony.population);

  // Rebuild the directive queue. Saved ids are matched against the authored
  // list; anything generated is regenerated from its index instead.
  const unlocked = new Set<ResearchId>(save.progress.unlocked);
  const active = save.progress.activeMissionIds
    .map((id, offset) => {
      const authored = MISSIONS.find((mission) => mission.id === id);
      if (authored) return authored;
      return generateMission(Math.max(0, save.progress.missionIndex - MISSIONS.length + offset), {
        population: save.colony.population,
        housing: 0,
        counts: {},
        totalBuildings: buildings.length,
        stock: save.colony.stock,
        happiness: save.colony.happiness,
        powerProduction: 0,
        researchUnlocked: unlocked.size,
        sols: save.sols,
      });
    })
    .filter(Boolean);

  useProgressStore.setState({
    unlocked,
    effects: aggregateEffects(unlocked),
    missionIndex: save.progress.missionIndex,
    active: active.length > 0 ? active : MISSIONS.slice(0, 2),
    completed: save.progress.completed.map((entry) => ({ ...entry, reward: {} })),
    events: [],
    lastEvent: null,
  });

  worldClock.sols = save.sols;
  return true;
}
