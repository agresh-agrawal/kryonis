/**
 * The building catalog.
 *
 * One entry per structure, holding everything the rest of the game needs to
 * know about it: what it costs, how much ground it takes, what terrain it
 * demands, how many colonists it employs, and what it does to the resource
 * economy once it is running.
 *
 * Production numbers are expressed per second at full staffing and full power.
 * The simulation in the next milestone scales them by worker coverage and grid
 * satisfaction; keeping them here as plain data means balance can be tuned
 * without touching any systems code.
 */

import type { ResourceBundle } from '../core/resources';
import { DepositKind, TerrainKind } from '../world/terrain';
import { getImportedModel } from './importedModels';
import { buildModel, type BuildingModel } from './model';
import {
  atriumParts,
  batteryParts,
  commsParts,
  corridorParts,
  factoryParts,
  fuelPlantParts,
  greenhouseParts,
  habitatParts,
  iceExtractorParts,
  labParts,
  landerParts,
  medicalParts,
  mineParts,
  oxygenPlantParts,
  reactorParts,
  roadParts,
  solarFarmParts,
  spaceportParts,
  storageParts,
  exportPadParts,
} from './models';

export type BuildingId =
  | 'lander'
  | 'habitat'
  | 'corridor'
  | 'road'
  | 'atrium'
  | 'solar'
  | 'battery'
  | 'reactor'
  | 'oxygen'
  | 'water'
  | 'greenhouse'
  | 'mine'
  | 'storage'
  | 'exportpad'
  | 'factory'
  | 'fuelplant'
  | 'lab'
  | 'medical'
  | 'comms'
  | 'spaceport';

export type BuildingCategory =
  | 'Habitation'
  | 'Power'
  | 'Life Support'
  | 'Industry'
  | 'Science'
  | 'Logistics';

export const BUILDING_CATEGORIES: BuildingCategory[] = [
  'Habitation',
  'Power',
  'Life Support',
  'Industry',
  'Science',
  'Logistics',
];

export interface BuildingDef {
  id: BuildingId;
  name: string;
  category: BuildingCategory;
  /** One line shown on the build-tray card. */
  summary: string;
  /** Longer text for the inspector, including the real-science hook. */
  description: string;

  /** Footprint in tiles, before rotation. */
  footprint: [width: number, depth: number];

  cost: ResourceBundle;
  /** Seconds of construction at full crew. */
  buildTime: number;

  /** Colonists needed to run it at full output. */
  workers: number;
  /** Housing provided, if any. */
  housing: number;

  /** Kilowatts produced (positive) or drawn (negative). */
  power: number;

  /** Continuous consumption per second at full output. */
  input: ResourceBundle;
  /** Continuous production per second at full output. */
  output: ResourceBundle;
  /** Added storage capacity. */
  storage: ResourceBundle;

  /** Restricts placement to these surface types. */
  requiresTerrain?: TerrainKind[];
  /** Requires a mineral deposit under the footprint. */
  requiresDeposit?: DepositKind[];

  /**
   * Maximum height difference tolerated across the footprint, in world units.
   * Large structures need flatter ground than small ones.
   */
  maxRelief: number;

  /** False for structures that can only exist as the colony's starting lander. */
  placeable: boolean;

  /**
   * Structures that must already be standing before this one can be built.
   *
   * Progression is expressed as a build tree rather than a separate tech tree
   * so that the thing you unlock and the thing you do to unlock it are the same
   * activity. A player who wants a reactor is told to build a laboratory, which
   * is a concrete instruction, not an abstract cost.
   */
  requires: BuildingId[];

  buildParts: () => ReturnType<typeof habitatParts>;
}

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  lander: {
    id: 'lander',
    name: 'Colony Hub',
    category: 'Habitation',
    summary: 'The craft that brought you here.',
    description:
      'The landing tower. Its roof is the pad every supply run sets down on, and its gate is where the crew walk out onto Mars. Everything the colony buys or sells passes through here, and every road runs back to it.',
    footprint: [4, 4],
    cost: {},
    buildTime: 0,
    workers: 0,
    housing: 4,
    power: 6,
    input: {},
    output: { research: 0.02 },
    storage: { oxygen: 380, water: 360, food: 320, fuel: 160, iron: 220, aluminium: 200, silicon: 140, carbon: 120, concrete: 280, ice: 100 },
    maxRelief: 1.6,
    placeable: false,
    requires: [],
    buildParts: landerParts,
  },

  habitat: {
    id: 'habitat',
    name: 'Habitat Dome',
    category: 'Habitation',
    summary: 'Pressurised housing for eight colonists.',
    description:
      'An inflatable pressure shell bermed with regolith. The soil piled against it is not decoration - a few metres of Martian dirt is the cheapest radiation shielding available.',
    footprint: [3, 3],
    cost: { money: 4200, concrete: 55 },
    buildTime: 26,
    workers: 0,
    housing: 8,
    power: -4,
    input: { oxygen: 0.05 },
    output: {},
    storage: { oxygen: 60, water: 60 },
    maxRelief: 1.5,
    placeable: true,
    requires: [],
    buildParts: habitatParts,
  },

  corridor: {
    id: 'corridor',
    name: 'Pressurised Corridor',
    category: 'Habitation',
    summary: 'Links structures so crews move under pressure.',
    description:
      'A short connecting tunnel. Colonists moving between linked buildings skip suit-up time, which meaningfully raises how much work actually gets done.',
    footprint: [1, 1],
    cost: { money: 320 },
    buildTime: 4,
    workers: 0,
    housing: 0,
    power: -0.2,
    input: {},
    output: {},
    storage: {},
    maxRelief: 0.9,
    placeable: true,
    requires: [],
    buildParts: corridorParts,
  },

  road: {
    id: 'road',
    name: 'Service Road',
    category: 'Logistics',
    summary: 'Connects sectors to the colony spine and carries utility runs.',
    description:
      'A surfaced service road with embedded conduits. Every sector that needs power, water or crew movement has to tie into this spine to become truly functional.',
    footprint: [1, 1],
    cost: { money: 45 },
    buildTime: 0,
    workers: 0,
    housing: 0,
    power: 0,
    input: {},
    output: {},
    storage: {},
    maxRelief: 1.0,
    placeable: true,
    requires: [],
    buildParts: roadParts,
  },

  atrium: {
    id: 'atrium',
    name: 'Recreation Atrium',
    category: 'Habitation',
    summary: 'Green space under glass. Keeps morale up.',
    description:
      'A glazed garden dome. Confinement in cramped metal rooms is one of the best documented hazards of long-duration spaceflight, and somewhere to stand under open sky is not a luxury - it is life support for the mind.',
    footprint: [3, 3],
    cost: { money: 5400, concrete: 40 },
    buildTime: 30,
    workers: 1,
    housing: 0,
    power: -9,
    input: { water: 0.08 },
    output: { oxygen: 0.08 },
    storage: {},
    maxRelief: 1.4,
    placeable: true,
    requires: ['habitat', 'greenhouse'],
    buildParts: atriumParts,
  },

  solar: {
    id: 'solar',
    name: 'Solar Array',
    category: 'Power',
    summary: 'Cheap daytime power. Produces nothing at night.',
    description:
      'Tracking photovoltaic rows. Mars receives about 43% of the sunlight Earth does, and dust settling on the panels steadily cuts output - so build more than the maths suggests.',
    footprint: [2, 2],
    cost: { money: 1500 },
    buildTime: 12,
    workers: 0,
    housing: 0,
    power: 26,
    input: {},
    output: {},
    storage: {},
    maxRelief: 1.0,
    placeable: true,
    requires: [],
    buildParts: solarFarmParts,
  },

  battery: {
    id: 'battery',
    name: 'Power Cell Bank',
    category: 'Power',
    summary: 'Stores daytime surplus to cover the night.',
    description:
      'Racked battery cells. Solar output falls to nothing for roughly half of every sol, so without storage a solar colony goes dark every single night - and life support does not get to take the night off.',
    footprint: [2, 2],
    cost: { money: 2800 },
    buildTime: 16,
    workers: 0,
    housing: 0,
    power: 0,
    input: {},
    output: {},
    storage: {},
    maxRelief: 1.0,
    placeable: true,
    requires: ['solar'],
    buildParts: batteryParts,
  },

  reactor: {
    id: 'reactor',
    name: 'Fission Reactor',
    category: 'Power',
    summary: 'Constant power, day or night. Expensive.',
    description:
      'A compact fission plant in the Kilopower mould. Most of what you see is radiator area - in vacuum-thin atmosphere, getting rid of waste heat is harder than making the power.',
    footprint: [2, 2],
    cost: { money: 9800 },
    buildTime: 40,
    workers: 2,
    housing: 0,
    power: 65,
    input: {},
    output: {},
    storage: {},
    maxRelief: 1.0,
    placeable: true,
    requires: ['lab'],
    buildParts: reactorParts,
  },

  oxygen: {
    id: 'oxygen',
    name: 'Oxygen Plant',
    category: 'Life Support',
    summary: 'Splits atmospheric CO2 into breathable oxygen.',
    description:
      'Solid-oxide electrolysis, scaled up from the MOXIE experiment that ran on Perseverance. The Martian atmosphere is 95% carbon dioxide, which makes the air itself your oxygen mine.',
    footprint: [2, 2],
    cost: { money: 2600 },
    buildTime: 18,
    workers: 1,
    housing: 0,
    power: -14,
    input: {},
    output: { oxygen: 0.55, carbon: 0.08 },
    storage: { oxygen: 80 },
    maxRelief: 1.0,
    placeable: true,
    requires: [],
    buildParts: oxygenPlantParts,
  },

  water: {
    id: 'water',
    name: 'Ice Extractor',
    category: 'Life Support',
    summary: 'Mines subsurface ice. Must sit on an ice field.',
    description:
      'Drills into buried water ice and sublimates it straight to vapour, condensing the result. Water is the colony bottleneck: it is drinking supply, crop irrigation and rocket propellant feedstock all at once.',
    footprint: [2, 2],
    cost: { money: 3100 },
    buildTime: 20,
    workers: 1,
    housing: 0,
    power: -16,
    input: {},
    output: { water: 0.5, ice: 0.15 },
    storage: { water: 80 },
    requiresTerrain: [TerrainKind.Ice],
    maxRelief: 1.1,
    placeable: true,
    requires: ['storage'],
    buildParts: iceExtractorParts,
  },

  greenhouse: {
    id: 'greenhouse',
    name: 'Greenhouse',
    category: 'Life Support',
    summary: 'Grows food. Drinks water and power.',
    description:
      'A glazed vault under artificial light. Crops also scrub carbon dioxide and release oxygen, so a well-fed colony breathes a little easier too.',
    footprint: [3, 2],
    cost: { money: 3400, concrete: 30 },
    buildTime: 22,
    workers: 1,
    housing: 0,
    power: -12,
    input: { water: 0.22 },
    output: { food: 0.42, oxygen: 0.12 },
    storage: { food: 90 },
    maxRelief: 1.2,
    placeable: true,
    requires: ['oxygen'],
    buildParts: greenhouseParts,
  },

  mine: {
    id: 'mine',
    name: 'Regolith Mine',
    category: 'Industry',
    summary: 'Extracts metals. Must sit on a mineral deposit.',
    description:
      'A bucket-wheel excavator feeding an ore hopper. Output depends on what the survey found underneath - iron oxide gives the planet its colour and your colony its structural steel.',
    footprint: [2, 2],
    cost: { money: 2400, concrete: 20 },
    buildTime: 18,
    workers: 2,
    housing: 0,
    power: -15,
    input: {},
    /*
     * Ore. This used to be empty.
     *
     * A mine that employs four people, draws fifteen kilowatts, demands a
     * mineral deposit under it and produces nothing was the root of a dead
     * economy: iron had no source, so the fabrication plant could never run,
     * so concrete could never be made, so after the starting stock ran out the
     * colony could not build anything that needed it. Every downstream
     * shortage traced back to this one empty object.
     *
     * The blend is deliberately mixed rather than keyed to the deposit type.
     * A single mine feeding all three industrial metals means one building
     * unblocks the whole chain, which is the right shape for the first
     * industry a player puts up.
     */
    output: { iron: 0.22, aluminium: 0.13, silicon: 0.07 },
    storage: { iron: 60, aluminium: 60, silicon: 40 },
    requiresDeposit: [
      DepositKind.Iron,
      DepositKind.Aluminium,
      DepositKind.Silicon,
      DepositKind.Carbon,
      DepositKind.RareMinerals,
    ],
    maxRelief: 1.2,
    placeable: true,
    requires: ['storage'],
    buildParts: mineParts,
  },

  storage: {
    id: 'storage',
    name: 'Storage Depot',
    category: 'Industry',
    summary: 'Raises the ceiling on everything you stockpile.',
    description:
      'Insulated tank farm. Without storage, surplus production is simply thrown away the moment your stores top out.',
    footprint: [2, 2],
    cost: { money: 1200, concrete: 25 },
    buildTime: 10,
    workers: 0,
    housing: 0,
    power: -1,
    input: {},
    output: {},
    storage: { oxygen: 150, water: 150, food: 120, iron: 150, aluminium: 150, concrete: 150, silicon: 100 },
    maxRelief: 1.0,
    placeable: true,
    requires: [],
    buildParts: storageParts,
  },

  /*
   * The Export Terminal.
   *
   * The building the economy was missing. Before it existed only three
   * structures earned credits and all three were late, so a colony could mine
   * ore and grow food for hours and still go broke - the goods had nowhere to
   * go. This is where they go.
   *
   * Deliberately cheap and early. It is the answer to "how do I make money",
   * and an answer the player cannot afford is not an answer.
   */
  exportpad: {
    id: 'exportpad',
    name: 'Export Terminal',
    category: 'Industry',
    summary: 'Ships surplus to Earth. This is how you earn credits.',
    description:
      'A launch cradle and cargo handler. Anything you are holding above a safe reserve gets packed and sold to Earth, most valuable cargo first. Fuel pays best by a wide margin - propellant made on Mars is the whole reason anyone funds a colony here.',
    footprint: [3, 2],
    cost: { money: 1900, concrete: 30 },
    buildTime: 12,
    workers: 1,
    housing: 0,
    power: -6,
    input: {},
    output: {},
    storage: { fuel: 80, iron: 80, aluminium: 80 },
    maxRelief: 0.9,
    placeable: true,
    requires: ['storage'],
    buildParts: exportPadParts,
  },

  factory: {
    id: 'factory',
    name: 'Fabrication Plant',
    category: 'Industry',
    summary: 'Turns raw ore into concrete and parts.',
    description:
      'Sinters regolith into construction-grade material. Martian concrete needs no water to cure, which is exactly why it is the colony standard.',
    footprint: [3, 2],
    cost: { money: 4600 },
    buildTime: 28,
    workers: 2,
    housing: 0,
    power: -22,
    // Alloy is the high-value export; concrete is what the colony builds with.
    // Producing both means the plant is worth running even when you are not
    // building, which is what keeps a mature colony earning.
    input: { iron: 0.18, silicon: 0.04 },
    output: { concrete: 0.4, aluminium: 0.09 },
    storage: { concrete: 120 },
    maxRelief: 1.2,
    placeable: true,
    requires: ['mine'],
    buildParts: factoryParts,
  },

  fuelplant: {
    id: 'fuelplant',
    name: 'Propellant Plant',
    category: 'Industry',
    summary: 'Makes methane fuel from CO2 and water.',
    description:
      'A Sabatier reactor: carbon dioxide from the air plus hydrogen split from your water yields methane and more water back. It is the process every crewed Mars architecture depends on, because it means the return vehicle can be fuelled without shipping a drop from Earth.',
    footprint: [3, 2],
    cost: { money: 6400 },
    buildTime: 34,
    workers: 2,
    housing: 0,
    power: -26,
    input: { water: 0.18, carbon: 0.06 },
    output: { fuel: 0.24 },
    storage: { fuel: 120 },
    maxRelief: 1.1,
    placeable: true,
    requires: ['factory'],
    buildParts: fuelPlantParts,
  },

  lab: {
    id: 'lab',
    name: 'Research Laboratory',
    category: 'Science',
    summary: 'Generates research points and Earth contracts.',
    description:
      'Twin pressurised modules of instruments. Research is the colony currency of the future - and Earth agencies pay well for data nobody else can collect.',
    footprint: [3, 2],
    cost: { money: 5200 },
    buildTime: 30,
    workers: 2,
    housing: 0,
    power: -18,
    input: {},
    output: { research: 0.3, money: 0.9 },
    storage: {},
    maxRelief: 1.2,
    placeable: true,
    requires: ['habitat'],
    buildParts: labParts,
  },

  medical: {
    id: 'medical',
    name: 'Medical Bay',
    category: 'Science',
    summary: 'Treats injury and illness. Raises happiness.',
    description:
      'Low gravity weakens bone and muscle, and there is no evacuation flight. A staffed medical bay is the difference between a setback and a funeral.',
    footprint: [2, 2],
    cost: { money: 3800 },
    buildTime: 24,
    workers: 1,
    housing: 0,
    power: -10,
    input: { water: 0.05 },
    output: {},
    storage: {},
    maxRelief: 1.1,
    placeable: true,
    requires: ['lab'],
    buildParts: medicalParts,
  },

  comms: {
    id: 'comms',
    name: 'Deep Space Relay',
    category: 'Science',
    summary: 'Sells data to Earth. Builds reputation.',
    description:
      'A steerable high-gain dish pointed at Earth. Signals take between 3 and 22 minutes each way depending on where the two planets are in their orbits, so nothing here is a live conversation - it is all recorded, queued and sold.',
    footprint: [2, 2],
    cost: { money: 4400 },
    buildTime: 26,
    workers: 1,
    housing: 0,
    power: -13,
    input: {},
    output: { money: 1.8, research: 0.12, reputation: 0.01 },
    storage: {},
    maxRelief: 1.0,
    placeable: true,
    requires: ['lab'],
    buildParts: commsParts,
  },

  spaceport: {
    id: 'spaceport',
    name: 'Spaceport',
    category: 'Logistics',
    summary: 'Trade with Earth. Receive colonists and tourists.',
    description:
      'A blast-hardened pad with propellant handling. Methane is manufactured on-site from Martian carbon dioxide and water, so departing ships never need fuel shipped from Earth.',
    footprint: [4, 4],
    cost: { money: 14000, concrete: 120 },
    buildTime: 55,
    workers: 3,
    housing: 0,
    power: -20,
    input: { water: 0.1, carbon: 0.05 },
    output: { fuel: 0.15, money: 2.2 },
    storage: { fuel: 150 },
    maxRelief: 0.9,
    placeable: true,
    requires: ['factory', 'lab'],
    buildParts: spaceportParts,
  },
};

export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];

/** Entries the player can actually choose from the build tray. */
export const PLACEABLE_BUILDINGS = BUILDING_IDS.filter((id) => BUILDINGS[id].placeable);

/**
 * Baked geometry per building type.
 *
 * Models are expensive to assemble and identical for every copy, so they are
 * built once on first request and cached for the lifetime of the page.
 */
const modelCache = new Map<BuildingId, BuildingModel>();

export function getBuildingModel(id: BuildingId): BuildingModel {
  let model = modelCache.get(id);
  if (!model) {
    // A downloaded model wins when one loaded for this structure; otherwise the
    // procedural parts are used. Both produce the same shape, so nothing
    // downstream needs to know which it got.
    model = getImportedModel(id) ?? buildModel(BUILDINGS[id].buildParts());
    modelCache.set(id, model);
  }
  return model;
}

/**
 * Drops cached geometry so the next request rebuilds it.
 *
 * Called once after the imported models finish loading. Without it, any
 * structure whose model was requested during the loading screen would keep its
 * procedural version for the rest of the session.
 */
export function invalidateModelCache(): void {
  modelCache.clear();
}

/**
 * Upgrade tiers.
 *
 * Shared by every structure rather than authored per building. A single ladder
 * that always means the same thing - more output, more power draw, rising cost -
 * is something a player learns once and can then apply to all eighteen
 * structures, and it means a new building needs no upgrade data written for it.
 *
 * Each tier costs more than the last while returning less per credit, so
 * upgrading is a real decision against simply building another unit: upgrades
 * buy output without buying land, which is what makes them worth it once the
 * crater starts filling up.
 */
export interface UpgradeTier {
  level: number;
  name: string;
  /** Multiplies everything the building produces. */
  output: number;
  /** Multiplies what it draws from the grid. */
  power: number;
  /** Multiplies the storage it contributes. */
  storage: number;
  /** Upgrade price as a fraction of the structure's original build cost. */
  costScale: number;
  /** Seconds of work to install. */
  buildTime: number;
}

export const UPGRADE_TIERS: UpgradeTier[] = [
  { level: 1, name: 'Standard', output: 1, power: 1, storage: 1, costScale: 0, buildTime: 0 },
  { level: 2, name: 'Enhanced', output: 1.45, power: 1.25, storage: 1.5, costScale: 0.85, buildTime: 14 },
  { level: 3, name: 'Optimised', output: 1.95, power: 1.55, storage: 2.1, costScale: 1.7, buildTime: 24 },
];

export const MAX_UPGRADE_LEVEL = UPGRADE_TIERS.length;

export function upgradeTier(level: number): UpgradeTier {
  return UPGRADE_TIERS[Math.max(0, Math.min(UPGRADE_TIERS.length - 1, level - 1))];
}

/** Resource cost of taking a structure from its current level to the next. */
export function upgradeCost(id: BuildingId, currentLevel: number): ResourceBundle {
  const next = UPGRADE_TIERS[currentLevel];
  if (!next) return {};

  const base = BUILDINGS[id].cost;
  const cost: ResourceBundle = {};
  for (const [resource, amount] of Object.entries(base) as [keyof ResourceBundle, number][]) {
    cost[resource] = Math.round(amount * next.costScale);
  }
  return cost;
}

/**
 * Whether a structure is available, given what the colony has already built.
 *
 * Only completed structures count - a laboratory still going up does not yet
 * unlock the reactor, which keeps the unlock moment tied to something the
 * player can actually see finish.
 */
export function unlockState(
  id: BuildingId,
  completedTypes: ReadonlySet<BuildingId>,
): { unlocked: boolean; missing: BuildingId[] } {
  const missing = BUILDINGS[id].requires.filter((required) => !completedTypes.has(required));
  return { unlocked: missing.length === 0, missing };
}

/** Names of the prerequisites a structure is still waiting on. */
export function missingRequirementNames(missing: BuildingId[]): string {
  return missing.map((id) => BUILDINGS[id].name).join(' + ');
}

/** Footprint after rotation, in tiles. Odd quarter-turns swap the axes. */
export function rotatedFootprint(id: BuildingId, rotation: number): [number, number] {
  const [w, d] = BUILDINGS[id].footprint;
  return rotation % 2 === 0 ? [w, d] : [d, w];
}
