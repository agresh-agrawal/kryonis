/**
 * Colony resources.
 *
 * Split into three groups that behave differently:
 *
 *  - **Life support** (oxygen, water, food) is consumed continuously by every
 *    colonist. Running out is what kills people.
 *  - **Industry** is the material stockpile that construction draws on.
 *  - **Economy** is money, research and reputation - unbounded, and earned
 *    rather than mined.
 *
 * Power is deliberately *not* in this list. It cannot be stockpiled without
 * batteries and is resolved every tick as a grid balance, so it is modelled
 * separately in the simulation rather than as a stored amount.
 */

export type ResourceId =
  | 'oxygen'
  | 'water'
  | 'food'
  | 'fuel'
  | 'iron'
  | 'aluminium'
  | 'silicon'
  | 'carbon'
  | 'concrete'
  | 'ice'
  | 'money'
  | 'research'
  | 'reputation';

export type ResourceCategory = 'life' | 'industry' | 'economy';

export interface ResourceDef {
  id: ResourceId;
  label: string;
  /**
   * Short name for tight HUD readouts.
   *
   * Deliberately plain English, never chemical notation. "Oxygen" and "Water"
   * are things a player instantly understands; "O2" and "H2O" make the screen
   * look like a lab report and cost a beat of translation every time they are
   * read. This is a game about running a colony, not a chemistry exam.
   */
  short: string;
  category: ResourceCategory;
  color: string;
  /** Base storage ceiling before any depot is built. Infinity = unbounded. */
  baseCapacity: number;
  /** Shown in the top resource bar rather than only in detail panels. */
  primary: boolean;
}

export const RESOURCES: Record<ResourceId, ResourceDef> = {
  oxygen: { id: 'oxygen', label: 'Oxygen', short: 'Oxygen', category: 'life', color: '#7fd6ff', baseCapacity: 600, primary: true },
  water: { id: 'water', label: 'Water', short: 'Water', category: 'life', color: '#4fa8e0', baseCapacity: 600, primary: true },
  food: { id: 'food', label: 'Food', short: 'Food', category: 'life', color: '#8fd45a', baseCapacity: 500, primary: true },
  fuel: { id: 'fuel', label: 'Fuel', short: 'Fuel', category: 'life', color: '#c98ae0', baseCapacity: 400, primary: false },

  iron: { id: 'iron', label: 'Iron', short: 'Iron', category: 'industry', color: '#c2705a', baseCapacity: 500, primary: true },
  aluminium: { id: 'aluminium', label: 'Alloy', short: 'Alloy', category: 'industry', color: '#b9c3cc', baseCapacity: 500, primary: true },
  silicon: { id: 'silicon', label: 'Silicon', short: 'Silicon', category: 'industry', color: '#9a86c4', baseCapacity: 400, primary: false },
  carbon: { id: 'carbon', label: 'Carbon', short: 'Carbon', category: 'industry', color: '#6f6f78', baseCapacity: 400, primary: false },
  concrete: { id: 'concrete', label: 'Concrete', short: 'Concrete', category: 'industry', color: '#a8977f', baseCapacity: 500, primary: true },
  ice: { id: 'ice', label: 'Ice', short: 'Ice', category: 'industry', color: '#cfe6ef', baseCapacity: 400, primary: false },

  money: { id: 'money', label: 'Credits', short: 'Credits', category: 'economy', color: '#f0c657', baseCapacity: Infinity, primary: true },
  research: { id: 'research', label: 'Research', short: 'Research', category: 'economy', color: '#5ad6c8', baseCapacity: Infinity, primary: true },
  reputation: { id: 'reputation', label: 'Reputation', short: 'Reputation', category: 'economy', color: '#e0a6d8', baseCapacity: Infinity, primary: false },
};

export const RESOURCE_IDS = Object.keys(RESOURCES) as ResourceId[];

/** A partial bundle of resources - used for costs, yields and deltas. */
export type ResourceBundle = Partial<Record<ResourceId, number>>;

/** A full stockpile. */
export type ResourceStock = Record<ResourceId, number>;

export function emptyStock(): ResourceStock {
  const stock = {} as ResourceStock;
  for (const id of RESOURCE_IDS) stock[id] = 0;
  return stock;
}

/**
 * Opening stores, delivered by the landing craft.
 *
 * Generous enough to get several buildings up before the first real squeeze,
 * because the opening minutes should be about learning the controls, not about
 * a life-support emergency.
 */
export function startingStock(): ResourceStock {
  return {
    ...emptyStock(),
    oxygen: 320,
    water: 300,
    food: 260,
    fuel: 120,
    iron: 180,
    aluminium: 160,
    silicon: 90,
    carbon: 60,
    concrete: 220,
    ice: 0,
    money: 25000,
    research: 0,
    reputation: 10,
  };
}

/** True when `stock` covers every line of `cost`. */
export function canAfford(stock: ResourceStock, cost: ResourceBundle): boolean {
  for (const [id, amount] of Object.entries(cost) as [ResourceId, number][]) {
    if (stock[id] < amount) return false;
  }
  return true;
}

/** Resources in `cost` that the colony is short of, with the shortfall amount. */
export function missingResources(stock: ResourceStock, cost: ResourceBundle): ResourceBundle {
  const missing: ResourceBundle = {};
  for (const [id, amount] of Object.entries(cost) as [ResourceId, number][]) {
    const shortfall = amount - stock[id];
    if (shortfall > 0) missing[id] = shortfall;
  }
  return missing;
}

/** Formats an amount for display: 1500 -> "1.5k", 2400000 -> "2.4M". */
export function formatAmount(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${Math.round(value / 1000)}k`;
  if (abs >= 1000) return `${(value / 1000).toFixed(1)}k`;
  if (abs >= 100) return String(Math.round(value));
  return value.toFixed(abs < 10 ? 1 : 0);
}

/** Formats a per-second rate with an explicit sign, e.g. "+2.4/s". */
export function formatRate(value: number): string {
  if (Math.abs(value) < 0.005) return '0/s';
  return `${value > 0 ? '+' : ''}${value.toFixed(value >= 10 || value <= -10 ? 0 : 2)}/s`;
}
