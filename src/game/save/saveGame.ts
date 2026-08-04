/**
 * Saving and loading.
 *
 * A save is a small JSON document, not a snapshot of the world. Terrain is
 * regenerated from its seed, models are rebuilt from the catalog, and colonists
 * are respawned from the population count - so a colony that occupies tens of
 * megabytes in memory serialises to a few kilobytes.
 *
 * Every save carries a schema version. Loading a save from an older version is
 * allowed and missing fields fall back to defaults; loading one from a *newer*
 * version is refused, because guessing at a format we have never seen is how
 * you silently corrupt somebody's colony.
 */

import type { BuildingId } from '../buildings/catalog';
import { REGION_TILES } from '../core/constants';
import { startingStock, type ResourceStock } from '../core/resources';
import type { ResearchId } from '../progress/research';
import type { CrewSnapshot } from '../state/useCrewStore';
import type { Profile } from '../state/useProfileStore';
import type { PlacedBuilding } from '../state/useColonyStore';
import type { TerrainConfig } from '../world/terrain';

export const SAVE_VERSION = 4;
const STORAGE_KEY = 'kryonis.save.v4';
const LEGACY_STORAGE_KEYS = ['kryonis.save.v3', 'kryonis.save.v2', 'kryonis.save.v1'];

export interface SaveGame {
  version: number;
  savedAt: number;
  siteName: string;
  terrain: Partial<TerrainConfig>;

  sols: number;

  colony: {
    buildings: PlacedBuilding[];
    stock: ResourceStock;
    unlockedRadius: number;
    population: number;
    happiness: number;
    batteryCharge: number;
  };

  crew?: CrewSnapshot;

  /** Who is running the colony and on what doctrine. Absent in v1 and v2. */
  profile?: Profile;

  /** Time controls, so a paused colony reloads paused. Absent before v3. */
  time?: { paused: boolean; speed: number };

  /** Road tiles as flat grid indices. Absent before v4. */
  roads?: number[];

  progress: {
    unlocked: ResearchId[];
    missionIndex: number;
    activeMissionIds: string[];
    completed: { id: string; title: string; sol: number }[];
    /** Research in flight. Absent before v3, and absent when nothing is running. */
    project?: { id: ResearchId; elapsed: number; duration: number } | null;
  };
}

export interface SaveSummary {
  savedAt: number;
  siteName: string;
  sols: number;
  population: number;
  buildings: number;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/** Writes a save. Returns false if storage refused it (quota, private mode). */
export function writeSave(save: SaveGame): boolean {
  if (!isBrowser()) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads and validates the stored save.
 *
 * Returns null for anything we cannot trust: absent, unparseable, from a newer
 * build, or structurally wrong. A corrupt save should look like no save, never
 * like a broken colony.
 */
export function readSave(): SaveGame | null {
  if (!isBrowser()) return null;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      for (const key of LEGACY_STORAGE_KEYS) {
        raw = window.localStorage.getItem(key);
        if (raw) break;
      }
    }
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as SaveGame;

    if (typeof parsed?.version !== 'number' || parsed.version > SAVE_VERSION) return null;
    if (!parsed.colony || !Array.isArray(parsed.colony.buildings)) return null;

    // Reject anything that would place a structure outside the grid; a bad
    // index would corrupt the occupancy map on load.
    for (const building of parsed.colony.buildings) {
      if (
        typeof building.tx !== 'number' ||
        typeof building.tz !== 'number' ||
        building.tx < 0 ||
        building.tz < 0 ||
        building.tx >= REGION_TILES ||
        building.tz >= REGION_TILES
      ) {
        return null;
      }
      // Older saves predate upgrade tiers.
      if (typeof building.level !== 'number') building.level = 1;
      if (typeof building.enabled !== 'boolean') building.enabled = true;
    }

    parsed.colony.stock = { ...startingStock(), ...parsed.colony.stock };
    parsed.crew = parsed.crew ?? undefined;
    parsed.progress = parsed.progress ?? {
      unlocked: [],
      missionIndex: 2,
      activeMissionIds: [],
      completed: [],
    };

    return parsed;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    for (const key of LEGACY_STORAGE_KEYS) window.localStorage.removeItem(key);
  } catch {
    // Nothing useful to do if storage is unavailable.
  }
}

export function hasSave(): boolean {
  return readSave() !== null;
}

/** Cheap header for the load button, without committing to a full load. */
export function readSummary(): SaveSummary | null {
  const save = readSave();
  if (!save) return null;
  return {
    savedAt: save.savedAt,
    siteName: save.siteName,
    sols: save.sols,
    population: save.colony.population,
    buildings: save.colony.buildings.length,
  };
}

/** "3 minutes ago", for the load button. */
export function describeAge(savedAt: number): string {
  const seconds = Math.max(0, (Date.now() - savedAt) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Building ids that no longer exist are dropped rather than crashing a load. */
export function pruneUnknownBuildings(
  buildings: PlacedBuilding[],
  known: ReadonlySet<string>,
): PlacedBuilding[] {
  return buildings.filter((building) => known.has(building.type as BuildingId));
}
