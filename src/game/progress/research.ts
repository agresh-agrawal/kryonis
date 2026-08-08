/**
 * The research tree.
 *
 * Research is deliberately *not* a second way to unlock buildings - the build
 * tree already does that, and duplicating it would mean two progression systems
 * competing to be the reason a player cannot do something yet. Instead research
 * makes what you already have work better, so the two systems answer different
 * questions: the build tree answers "what can I build", research answers "how
 * well does it run".
 *
 * Effects are multipliers aggregated into a single object the simulation reads
 * once per tick, so adding a node never means touching simulation code.
 */

export type ResearchBranch = 'Energy' | 'Life Support' | 'Industry' | 'Colony';

export type ResearchId =
  | 'panel-coatings'
  | 'dust-mitigation'
  | 'thermal-storage'
  | 'regenerative-scrubbers'
  | 'hydroponic-density'
  | 'closed-loop-water'
  | 'sintering-optics'
  | 'ore-beneficiation'
  | 'autonomous-haulage'
  | 'habitat-ergonomics'
  | 'sealed-roadbed'
  | 'crew-rotation'
  | 'pressurised-transit';

/**
 * The one node that unlocks something rather than improving it.
 *
 * Research is otherwise deliberately not a second unlock tree - the build tree
 * already answers "what can I build". This is the exception, and it earns it by
 * unlocking a better version of a thing the colony already owns rather than a
 * new capability: you can already lay roads, this lets you lay them properly.
 */
export const SEALED_ROAD_RESEARCH: ResearchId = 'sealed-roadbed';

export interface ResearchEffects {
  /** Multiplies solar array output. */
  solarOutput: number;
  /** Multiplies oxygen production. */
  oxygenOutput: number;
  /** Multiplies water production. */
  waterOutput: number;
  /** Multiplies food production. */
  foodOutput: number;
  /** Multiplies mined and fabricated materials. */
  industryOutput: number;
  /** Multiplies power *demand*; below 1 is an efficiency saving. */
  powerDraw: number;
  /** Multiplies every storage ceiling. */
  storage: number;
  /** Added directly to the morale target, 0-1. */
  morale: number;
}

export const NO_EFFECTS: ResearchEffects = {
  solarOutput: 1,
  oxygenOutput: 1,
  waterOutput: 1,
  foodOutput: 1,
  industryOutput: 1,
  powerDraw: 1,
  storage: 1,
  morale: 0,
};

export interface ResearchNode {
  id: ResearchId;
  name: string;
  branch: ResearchBranch;
  /** Cost in research points. */
  cost: number;
  requires: ResearchId[];
  /** The real engineering the node is drawn from. */
  blurb: string;
  effects: Partial<ResearchEffects>;
}

export const RESEARCH: Record<ResearchId, ResearchNode> = {
  'panel-coatings': {
    id: 'panel-coatings',
    name: 'Anti-Static Coatings',
    branch: 'Energy',
    cost: 40,
    requires: [],
    blurb:
      'Electrostatic dust removal for photovoltaic glass. Dust accumulation cost the Opportunity rover most of its power budget before a gust cleaned the panels by luck; a colony cannot rely on luck.',
    effects: { solarOutput: 1.18 },
  },
  'dust-mitigation': {
    id: 'dust-mitigation',
    name: 'Storm Hardening',
    branch: 'Energy',
    cost: 90,
    requires: ['panel-coatings'],
    blurb:
      'Sealed bearings and stowable arrays. A planet-encircling dust storm can dim the sky for weeks, and the colonies that survive one are the colonies that planned for it.',
    effects: { solarOutput: 1.15, powerDraw: 0.95 },
  },
  'thermal-storage': {
    id: 'thermal-storage',
    name: 'Molten Salt Buffer',
    branch: 'Energy',
    cost: 150,
    requires: ['dust-mitigation'],
    blurb:
      'Heat banked by day and drawn down at night. Storing energy as heat is far cheaper per kilowatt-hour than storing it as charge.',
    effects: { storage: 1.2, powerDraw: 0.9 },
  },

  'regenerative-scrubbers': {
    id: 'regenerative-scrubbers',
    name: 'Regenerative Scrubbers',
    branch: 'Life Support',
    cost: 50,
    requires: [],
    blurb:
      'Carbon dioxide beds that bake out and reset instead of being replaced. The ISS runs the same principle; consumables you have to ship from Earth are the enemy.',
    effects: { oxygenOutput: 1.22 },
  },
  'hydroponic-density': {
    id: 'hydroponic-density',
    name: 'Vertical Hydroponics',
    branch: 'Life Support',
    cost: 100,
    requires: ['regenerative-scrubbers'],
    blurb:
      'Stacked growing trays under tuned red and blue light. Plants only use a fraction of the visible spectrum, so lighting them white wastes most of the power.',
    effects: { foodOutput: 1.35 },
  },
  'closed-loop-water': {
    id: 'closed-loop-water',
    name: 'Closed-Loop Recovery',
    branch: 'Life Support',
    cost: 170,
    requires: ['hydroponic-density'],
    blurb:
      'Humidity, hygiene and waste water all recovered. Station systems already reclaim above 90%, and every litre reclaimed is a litre you do not have to dig out of the ground.',
    effects: { waterOutput: 1.3, storage: 1.1 },
  },

  'sintering-optics': {
    id: 'sintering-optics',
    name: 'Solar Sintering',
    branch: 'Industry',
    cost: 60,
    requires: [],
    blurb:
      'Concentrated sunlight fuses regolith directly into building slabs. No binder, no water, no kiln - just a very large mirror.',
    effects: { industryOutput: 1.2 },
  },
  'ore-beneficiation': {
    id: 'ore-beneficiation',
    name: 'Magnetic Beneficiation',
    branch: 'Industry',
    cost: 120,
    requires: ['sintering-optics'],
    blurb:
      'Martian dust is strongly magnetic thanks to its iron oxide content, which makes separating the useful fraction unusually easy.',
    effects: { industryOutput: 1.25, powerDraw: 1.05 },
  },
  'autonomous-haulage': {
    id: 'autonomous-haulage',
    name: 'Autonomous Haulage',
    branch: 'Industry',
    cost: 190,
    requires: ['ore-beneficiation'],
    blurb:
      'Driverless ore transport running through the night shift. With a radio round-trip to Earth of up to 44 minutes, anything worth doing out here has to decide for itself.',
    effects: { industryOutput: 1.3, storage: 1.15 },
  },

  'habitat-ergonomics': {
    id: 'habitat-ergonomics',
    name: 'Habitat Ergonomics',
    branch: 'Colony',
    cost: 45,
    requires: [],
    blurb:
      'Private quarters, varied sightlines and circadian lighting. Confinement studies consistently find that crews break down over layout long before they break down over workload.',
    effects: { morale: 0.06 },
  },
  'sealed-roadbed': {
    id: 'sealed-roadbed',
    branch: 'Colony',
    name: 'Sealed Roadbed',
    cost: 85,
    requires: ['habitat-ergonomics'],
    blurb:
      'A poured deck and a pressure shell over the service run, so a crossing between two modules is a corridor rather than an EVA. Unlocks the Sealed Transit Way in the road tray - the sealed share of your network raises colony morale.',
    effects: { morale: 0.02 },
  },
  'crew-rotation': {
    id: 'crew-rotation',
    name: 'Shift Rotation',
    branch: 'Colony',
    cost: 110,
    requires: ['habitat-ergonomics'],
    blurb:
      'Staggered shifts so the colony never fully sleeps and no one works every night.',
    effects: { morale: 0.05, industryOutput: 1.1 },
  },
  'pressurised-transit': {
    id: 'pressurised-transit',
    name: 'Pressurised Transit',
    branch: 'Colony',
    cost: 180,
    requires: ['crew-rotation'],
    blurb:
      'Sealed walkways between every module. Suiting up costs the better part of an hour each way; removing that from the working day is the single largest productivity gain available.',
    effects: { morale: 0.06, oxygenOutput: 1.1, industryOutput: 1.12 },
  },
};

export const RESEARCH_IDS = Object.keys(RESEARCH) as ResearchId[];

export const RESEARCH_BRANCHES: ResearchBranch[] = [
  'Energy',
  'Life Support',
  'Industry',
  'Colony',
];

/** Combines every unlocked node into the multipliers the simulation applies. */
export function aggregateEffects(unlocked: ReadonlySet<ResearchId>): ResearchEffects {
  const total: ResearchEffects = { ...NO_EFFECTS };

  for (const id of unlocked) {
    const node = RESEARCH[id];
    if (!node) continue;
    for (const [key, value] of Object.entries(node.effects) as [
      keyof ResearchEffects,
      number,
    ][]) {
      // Morale is additive; everything else compounds.
      if (key === 'morale') total.morale += value;
      else total[key] *= value;
    }
  }

  return total;
}

/** Whether a node's prerequisites are all satisfied. */
export function isAvailable(id: ResearchId, unlocked: ReadonlySet<ResearchId>): boolean {
  if (unlocked.has(id)) return false;
  return RESEARCH[id].requires.every((required) => unlocked.has(required));
}
