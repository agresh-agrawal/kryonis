/**
 * The colony simulation.
 *
 * One pure function, `stepColony`, advances the whole economy by a fixed
 * timestep. It takes the current state and returns the next one; it touches no
 * stores, no React and no rendering, which means it can be tested, replayed and
 * fast-forwarded without a browser.
 *
 * The chain the player has to keep balanced:
 *
 *   sunlight -> solar arrays -> power -> oxygen plant -> breathable air
 *   ice field -> extractor -> water -> greenhouse -> food -> population
 *   deposits -> mine -> ore -> fabrication -> concrete -> more buildings
 *
 * Everything narrows through two global multipliers - how much of the workforce
 * is available, and how much of the power demand is being met - because a
 * player can reason about two numbers. Per-building brownouts would be more
 * accurate and far harder to understand.
 */

import { BUILDINGS, upgradeTier, type BuildingId } from '../buildings/catalog';
import {
  EXPORTABLE,
  EXPORT_PRICE,
  EXPORT_RESERVE_UNITS,
  RESOURCE_IDS,
  emptyStock,
  type ResourceId,
  type ResourceStock,
} from '../core/resources';
import type { PlacedBuilding } from '../state/useColonyStore';
import { serviceOf } from '../world/roads';

/** Per-colonist life support draw, per second. */
export const LIFE_SUPPORT = {
  oxygen: 0.018,
  water: 0.015,
  food: 0.011,
} as const;

/**
 * Energy a single Power Cell Bank holds, in kilowatt-seconds.
 *
 * Night is half of every sol and solar produces nothing through it, so this
 * number decides whether a solar colony is viable at all before the reactor is
 * reachable. At 9,000 it took six banks to carry a modest colony overnight,
 * which no early colony can afford - simulated play sat at 35-49% power
 * satisfaction for a dozen sols and never recovered.
 */
export const BATTERY_CAPACITY = 17000;

export interface ColonyAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

/**
 * Units a single terminal can ship per second, before upgrades.
 *
 * Set against building costs rather than against production: one terminal over
 * a fully supplied mine should be earning enough to put up a structure every
 * couple of sols, because that is the pace at which the game stays moving.
 */
export const EXPORT_THROUGHPUT = 1.4;

export interface ColonyStats {
  population: number;
  /** Credits per second currently being earned by exporting surplus. */
  exportIncome: number;
  /** What is actually being shipped, richest first, for the trade readout. */
  exporting: { resource: ResourceId; rate: number; credits: number }[];
  housing: number;
  jobs: number;
  /** Colonists actually filling a job. */
  workers: number;
  /** 0-1 share of jobs that are staffed. */
  staffing: number;
  happiness: number;

  powerProduction: number;
  powerDemand: number;
  /** 0-1 share of demand being met, including battery discharge. */
  powerSatisfaction: number;
  batteryCharge: number;
  batteryCapacity: number;

  /** Storage ceiling per resource. */
  capacity: ResourceStock;
  /** Net change per second, for HUD trend arrows. */
  rates: ResourceStock;

  alerts: ColonyAlert[];
}

/**
 * Everything outside the colony's own hardware that scales its performance:
 * permanent research gains and temporary event penalties, already combined.
 */
export interface SimModifiers {
  solar: number;
  oxygen: number;
  water: number;
  food: number;
  industry: number;
  powerDraw: number;
  storage: number;
  morale: number;
  /**
   * Multiplies what the crew consume, as opposed to what the colony produces.
   * Below 1 is a saving. Set from mission doctrine, not from research.
   */
  lifeSupportDraw: number;
}

export const NO_MODIFIERS: SimModifiers = {
  solar: 1,
  oxygen: 1,
  water: 1,
  food: 1,
  industry: 1,
  powerDraw: 1,
  storage: 1,
  morale: 0,
  lifeSupportDraw: 1,
};

/** Which modifier applies to a given produced resource. */
function outputScale(resource: ResourceId, mods: SimModifiers): number {
  switch (resource) {
    case 'oxygen':
      return mods.oxygen;
    case 'water':
    case 'ice':
      return mods.water;
    case 'food':
      return mods.food;
    case 'iron':
    case 'aluminium':
    case 'silicon':
    case 'carbon':
    case 'concrete':
    case 'fuel':
      return mods.industry;
    default:
      return 1;
  }
}

export interface ColonyDynamics {
  stock: ResourceStock;
  population: number;
  happiness: number;
  batteryCharge: number;
}

export interface StepResult extends ColonyDynamics {
  stats: ColonyStats;
  /** Colonists lost this step, so the UI can report it. */
  deaths: number;
}

export function emptyStats(): ColonyStats {
  // Capacities start unbounded rather than zero. A zero ceiling would mean
  // "stores are full at nothing", and for the one frame before the first tick
  // the HUD would flash every resource as critically low.
  const capacity = emptyStock();
  for (const id of RESOURCE_IDS) capacity[id] = Infinity;

  return {
    population: 0,
    exportIncome: 0,
    exporting: [],
    housing: 0,
    jobs: 0,
    workers: 0,
    staffing: 1,
    happiness: 0.75,
    powerProduction: 0,
    powerDemand: 0,
    powerSatisfaction: 1,
    batteryCharge: 0,
    batteryCapacity: 0,
    capacity,
    rates: emptyStock(),
    alerts: [],
  };
}

/** Storage ceiling: the baseline plus whatever depots and tanks add. */
export function computeCapacity(
  buildings: PlacedBuilding[],
  storageBonus = 1,
): ResourceStock {
  const capacity = emptyStock();
  for (const id of RESOURCE_IDS) {
    const base = BUILDINGS.lander.storage[id];
    // Economy resources are unbounded; everything physical needs a tank.
    capacity[id] = id === 'money' || id === 'research' || id === 'reputation' ? Infinity : 0;
    if (base) capacity[id] += base;
  }

  for (const building of buildings) {
    if (building.progress < 1) continue;
    const def = BUILDINGS[building.type];
    const tier = upgradeTier(building.level);
    for (const [resource, amount] of Object.entries(def.storage) as [ResourceId, number][]) {
      capacity[resource] += amount * tier.storage * storageBonus;
    }
  }

  // The lander's own stores were counted once above as the baseline; make sure
  // a colony that somehow loses it still has a floor to work with.
  for (const id of RESOURCE_IDS) {
    if (capacity[id] < 60 && Number.isFinite(capacity[id])) capacity[id] = 60;
  }

  return capacity;
}

/**
 * Advances the colony by `dt` seconds of game time.
 *
 * `dt` is already scaled by the speed multiplier before it gets here.
 */
export function stepColony(
  dt: number,
  current: ColonyDynamics,
  buildings: PlacedBuilding[],
  solarFactor: number,
  mods: SimModifiers = NO_MODIFIERS,
): StepResult {
  const stock: ResourceStock = { ...current.stock };
  const before: ResourceStock = { ...current.stock };
  const alerts: ColonyAlert[] = [];

  // ---- Census -----------------------------------------------------------
  let housing = 0;
  let jobs = 0;
  let batteryCapacity = 0;
  let comfortBuildings = 0;
  // Export terminals, counted with everything else rather than re-scanned.
  let exportTerminals = 0;

  const active: PlacedBuilding[] = [];
  const completedTypes = new Set<BuildingId>();

  for (const building of buildings) {
    if (building.progress < 1 || !building.enabled) continue;

    /*
     * A structure only runs if its road is delivering what it needs.
     *
     * This replaces an earlier helper that flood-filled from the hub looking
     * for `entry.type === 'road'` - a building type that has never existed in
     * the catalog. The road set was therefore always empty, and the only
     * structures that counted as connected were the ones physically touching
     * the hub's own footprint. Everything else in the colony was silently
     * producing nothing, with nothing on screen to say why.
     *
     * An unserviced structure still counts as *built* - it keeps its housing,
     * which is a physical fact about it - but it produces nothing and draws no
     * power, and `serviceProblem` tells the player exactly which of road,
     * power or water is missing.
     */
    if (!serviceOf(building.id).operational) {
      housing += BUILDINGS[building.type].housing;
      continue;
    }

    active.push(building);
    completedTypes.add(building.type);

    const def = BUILDINGS[building.type];
    housing += def.housing;
    jobs += def.workers;
    if (building.type === 'battery') batteryCapacity += BATTERY_CAPACITY;
    if (building.type === 'atrium' || building.type === 'medical') comfortBuildings++;
    if (building.type === 'exportpad') exportTerminals += upgradeTier(building.level).output;
  }

  const population = current.population;
  const workers = Math.min(population, jobs);
  const staffing = jobs > 0 ? workers / jobs : 1;

  // ---- Power ------------------------------------------------------------
  // Generation first, because everything downstream is scaled by whether the
  // grid can carry the load.
  let powerProduction = 0;
  let powerDemand = 0;

  for (const building of active) {
    const def = BUILDINGS[building.type];
    const tier = upgradeTier(building.level);
    if (def.power > 0) {
      // Solar tracks the sun; anything else runs flat out. Generation scales
      // with the output multiplier, since that is what the upgrade buys.
      const rated = def.power * tier.output;
      powerProduction +=
        building.type === 'solar' ? rated * solarFactor * mods.solar : rated;
    } else {
      powerDemand += -def.power * tier.power * mods.powerDraw;
    }
  }

  let batteryCharge = current.batteryCharge;
  let powerSatisfaction = 1;

  if (powerDemand > 0.0001) {
    const surplus = powerProduction - powerDemand;
    if (surplus >= 0) {
      // Bank the excess.
      batteryCharge = Math.min(batteryCapacity, batteryCharge + surplus * dt);
      powerSatisfaction = 1;
    } else {
      const deficit = -surplus;
      const drawn = Math.min(batteryCharge, deficit * dt);
      batteryCharge -= drawn;
      const covered = powerProduction + drawn / dt;
      powerSatisfaction = Math.max(0, Math.min(1, covered / powerDemand));
    }
  } else {
    batteryCharge = Math.min(batteryCapacity, batteryCharge + powerProduction * dt);
  }

  batteryCharge = Math.min(batteryCharge, batteryCapacity);

  // ---- Production -------------------------------------------------------
  const capacity = computeCapacity(buildings, mods.storage);
  const efficiency = Math.max(0, Math.min(1, staffing * powerSatisfaction));
  const utilityConnected = buildings.some((entry) => entry.type === 'road' && entry.progress >= 1 && entry.enabled);

  for (const building of active) {
    const def = BUILDINGS[building.type];
    if (efficiency <= 0 || !utilityConnected) break;

    // An upgraded plant processes more of everything, inputs included.
    const scale = upgradeTier(building.level).output;

    // A plant can only run as fast as its scarcest input allows.
    let rate = efficiency;
    for (const [resource, amount] of Object.entries(def.input) as [ResourceId, number][]) {
      const needed = amount * scale * rate * dt;
      if (needed <= 0) continue;
      if (stock[resource] < needed) {
        rate *= needed > 0 ? stock[resource] / needed : 0;
      }
    }
    if (rate <= 0) continue;

    for (const [resource, amount] of Object.entries(def.input) as [ResourceId, number][]) {
      stock[resource] = Math.max(0, stock[resource] - amount * scale * rate * dt);
    }
    for (const [resource, amount] of Object.entries(def.output) as [ResourceId, number][]) {
      // Research and events scale what comes out, not what goes in - an
      // efficiency gain should not also cost you more feedstock.
      stock[resource] = Math.min(
        capacity[resource],
        stock[resource] + amount * scale * rate * outputScale(resource, mods) * dt,
      );
    }
  }

  // ---- Export ------------------------------------------------------------
  /*
   * Selling surplus to Earth.
   *
   * This is where credits come from. Every terminal ships a fixed number of
   * units per second, spent on the most valuable thing available - a colony
   * with fuel to sell should always be shipping fuel rather than gravel.
   *
   * Only stock above `EXPORT_RESERVE` of capacity is eligible, so exporting
   * can never starve the plant that produces the goods. That reserve is the
   * difference between a trade and a leak.
   */
  const exportCapacity = exportTerminals * EXPORT_THROUGHPUT * efficiency;
  let exportIncome = 0;
  const exporting: ColonyStats['exporting'] = [];

  if (exportCapacity > 0) {
    let remaining = exportCapacity * dt;

    for (const resource of EXPORTABLE) {
      if (remaining <= 0) break;

      const price = EXPORT_PRICE[resource] ?? 0;
      const surplus = stock[resource] - EXPORT_RESERVE_UNITS;
      if (surplus <= 0 || price <= 0) continue;

      const shipped = Math.min(surplus, remaining);
      stock[resource] -= shipped;
      stock.money += shipped * price;

      remaining -= shipped;
      exportIncome += (shipped * price) / dt;
      exporting.push({ resource, rate: shipped / dt, credits: (shipped * price) / dt });
    }
  }

  // ---- Life support -----------------------------------------------------
  const consume = (resource: 'oxygen' | 'water' | 'food') => {
    const needed = LIFE_SUPPORT[resource] * population * mods.lifeSupportDraw * dt;
    if (stock[resource] >= needed) {
      stock[resource] -= needed;
      return true;
    }
    stock[resource] = 0;
    return false;
  };

  const hasOxygen = consume('oxygen');
  const hasWater = consume('water');
  const hasFood = consume('food');

  // ---- Population and morale -------------------------------------------
  let happiness = current.happiness;
  let nextPopulation = population;
  let deaths = 0;

  const comfortBonus = population > 0 ? Math.min(0.2, (comfortBuildings * 12) / population * 0.2) : 0;
  const crowding = housing > 0 ? Math.max(0, population - housing) / Math.max(1, housing) : 1;

  let targetHappiness = 0.78 + comfortBonus + mods.morale - crowding * 0.4;
  if (!hasOxygen) targetHappiness -= 0.55;
  if (!hasWater) targetHappiness -= 0.35;
  if (!hasFood) targetHappiness -= 0.3;
  if (powerSatisfaction < 0.95) targetHappiness -= (1 - powerSatisfaction) * 0.3;
  targetHappiness = Math.max(0, Math.min(1, targetHappiness));

  // Morale moves slowly - a brief brownout should not empty the colony.
  happiness += (targetHappiness - happiness) * Math.min(1, dt / 40);

  if (!hasOxygen && population > 0) {
    // Suffocation is fast and is the one thing that actually kills.
    const lost = (dt / 45) * Math.max(1, population * 0.25);
    nextPopulation = Math.max(0, population - lost);
    deaths = population - nextPopulation;
  } else if ((!hasFood || !hasWater) && population > 0) {
    const lost = (dt / 220) * Math.max(1, population * 0.15);
    nextPopulation = Math.max(0, population - lost);
    deaths = population - nextPopulation;
  }

  // Population does not grow on its own.
  //
  // Building housing creates *vacancies*; filling them is a decision the player
  // makes on the crew screen, because who you hire determines what the colony
  // is good at. Automatic growth quietly took that decision away and made
  // habitats feel like a number that went up by itself.

  // ---- Alerts -----------------------------------------------------------
  if (!hasOxygen) {
    alerts.push({ id: 'oxygen', severity: 'critical', message: 'Oxygen exhausted — colonists are dying' });
  } else if (stock.oxygen < capacity.oxygen * 0.15) {
    alerts.push({ id: 'oxygen-low', severity: 'warning', message: 'Oxygen reserves low' });
  }

  if (!hasWater) alerts.push({ id: 'water', severity: 'critical', message: 'Water exhausted' });
  else if (stock.water < capacity.water * 0.15) {
    alerts.push({ id: 'water-low', severity: 'warning', message: 'Water reserves low' });
  }

  if (!hasFood) alerts.push({ id: 'food', severity: 'critical', message: 'Food exhausted' });
  else if (stock.food < capacity.food * 0.15) {
    alerts.push({ id: 'food-low', severity: 'warning', message: 'Food reserves low' });
  }

  if (powerSatisfaction < 0.999) {
    alerts.push({
      id: 'power',
      severity: powerSatisfaction < 0.6 ? 'critical' : 'warning',
      message: `Power shortfall — everything running at ${Math.round(powerSatisfaction * 100)}%`,
    });
  }

  if (jobs > population) {
    alerts.push({
      id: 'crew',
      severity: 'info',
      message: `${Math.ceil(jobs - population)} posts unfilled — build housing to attract crew`,
    });
  }

  if (population >= housing && housing > 0) {
    alerts.push({ id: 'housing', severity: 'info', message: 'No spare housing — colony cannot grow' });
  }

  // ---- Rates ------------------------------------------------------------
  const rates = emptyStock();
  if (dt > 0) {
    for (const id of RESOURCE_IDS) rates[id] = (stock[id] - before[id]) / dt;
  }

  return {
    stock,
    population: nextPopulation,
    happiness,
    batteryCharge,
    deaths,
    stats: {
      population: nextPopulation,
      exportIncome,
      exporting,
      housing,
      jobs,
      workers,
      staffing,
      happiness,
      powerProduction,
      powerDemand,
      powerSatisfaction,
      batteryCharge,
      batteryCapacity,
      capacity,
      rates,
      alerts,
    },
  };
}

/** Descriptive label for a happiness value, for the HUD. */
export function moraleLabel(happiness: number): string {
  if (happiness >= 0.85) return 'Thriving';
  if (happiness >= 0.7) return 'Content';
  if (happiness >= 0.5) return 'Uneasy';
  if (happiness >= 0.3) return 'Unhappy';
  return 'Desperate';
}
