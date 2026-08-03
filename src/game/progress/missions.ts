/**
 * Directives - the colony's rolling objectives.
 *
 * The design brief calls for no ending, so this is a queue rather than a
 * campaign: finish one and the next is issued, with the later entries scaling
 * off whatever the colony has already achieved. Two run at once - one building
 * goal and one economic goal - so a player who is blocked on materials always
 * still has something to push toward.
 *
 * Each directive measures itself from a snapshot of colony state, which keeps
 * them pure data with no hooks into the simulation.
 */

import type { BuildingId } from '../buildings/catalog';
import type { ResourceBundle, ResourceId } from '../core/resources';

export interface MissionContext {
  population: number;
  housing: number;
  /** Count of completed structures by type. */
  counts: Partial<Record<BuildingId, number>>;
  totalBuildings: number;
  stock: Record<ResourceId, number>;
  happiness: number;
  powerProduction: number;
  researchUnlocked: number;
  sols: number;
}

export interface Mission {
  id: string;
  title: string;
  detail: string;
  target: number;
  reward: ResourceBundle;
  measure: (ctx: MissionContext) => number;
}

const count = (ctx: MissionContext, id: BuildingId) => ctx.counts[id] ?? 0;

/**
 * The directive queue.
 *
 * Ordered so the opening few teach the core loop - power, air, water, food -
 * before anything asks for scale.
 */
export const MISSIONS: Mission[] = [
  {
    id: 'first-power',
    title: 'Establish Generation',
    detail: 'Erect two solar arrays. Nothing else in the colony runs without power.',
    target: 2,
    reward: { money: 1800 },
    measure: (ctx) => count(ctx, 'solar'),
  },
  {
    id: 'breathe',
    title: 'Close the Air Loop',
    detail: 'Build an oxygen plant. The atmosphere here is 95% carbon dioxide - use it.',
    target: 1,
    reward: { money: 2200, research: 20 },
    measure: (ctx) => count(ctx, 'oxygen'),
  },
  {
    id: 'shelter',
    title: 'Raise Shelter',
    detail: 'Build two habitat domes so the crew are not living in the lander.',
    target: 2,
    reward: { money: 2600, concrete: 40 },
    measure: (ctx) => count(ctx, 'habitat'),
  },
  {
    id: 'water',
    title: 'Secure Water',
    detail: 'Site an ice extractor on an ice field.',
    target: 1,
    reward: { money: 3000, research: 25 },
    measure: (ctx) => count(ctx, 'water'),
  },
  {
    id: 'feed',
    title: 'Grow Food',
    detail: 'Raise a greenhouse. Shipped rations do not last forever.',
    target: 1,
    reward: { money: 3200, research: 30 },
    measure: (ctx) => count(ctx, 'greenhouse'),
  },
  {
    id: 'crew-12',
    title: 'A Real Settlement',
    detail: 'Grow the colony to twelve residents.',
    target: 12,
    reward: { money: 4500, reputation: 5 },
    measure: (ctx) => ctx.population,
  },
  {
    id: 'science',
    title: 'Begin Science',
    detail: 'Build a research laboratory and start earning research points.',
    target: 1,
    reward: { money: 4000, research: 40 },
    measure: (ctx) => count(ctx, 'lab'),
  },
  {
    id: 'stockpile',
    title: 'Build Reserves',
    detail: 'Hold 400 units of concrete for the next expansion.',
    target: 400,
    reward: { money: 5000 },
    measure: (ctx) => ctx.stock.concrete,
  },
  {
    id: 'industry',
    title: 'Industrialise',
    detail: 'Run a mine and a fabrication plant together.',
    target: 2,
    reward: { money: 6000, research: 45 },
    measure: (ctx) => Math.min(count(ctx, 'mine'), 1) + Math.min(count(ctx, 'factory'), 1),
  },
  {
    id: 'grid-200',
    title: 'Scale the Grid',
    detail: 'Reach 200 MW of generating capacity.',
    target: 200,
    reward: { money: 7500, research: 50 },
    measure: (ctx) => ctx.powerProduction,
  },
  {
    id: 'content',
    title: 'A Place Worth Living',
    detail: 'Hold colony morale above 85%.',
    target: 85,
    reward: { money: 8000, reputation: 10 },
    measure: (ctx) => ctx.happiness * 100,
  },
  {
    id: 'crew-30',
    title: 'City on the Plain',
    detail: 'Grow the colony to thirty residents.',
    target: 30,
    reward: { money: 12000, reputation: 15 },
    measure: (ctx) => ctx.population,
  },
  {
    id: 'gateway',
    title: 'Open the Gateway',
    detail: 'Complete a spaceport and connect the colony to Earth trade.',
    target: 1,
    reward: { money: 15000, reputation: 20 },
    measure: (ctx) => count(ctx, 'spaceport'),
  },
];

/**
 * Endless scaling directives, issued once the authored queue runs out.
 *
 * The brief asks for no fixed ending, so progression has to keep producing
 * goals forever. These grow with the colony rather than repeating a fixed
 * number.
 */
export function generateMission(index: number, ctx: MissionContext): Mission {
  const cycle = index % 3;
  const tier = Math.floor(index / 3) + 1;

  if (cycle === 0) {
    const target = Math.ceil((ctx.population + 12) / 5) * 5;
    return {
      id: `endless-pop-${index}`,
      title: 'Continued Growth',
      detail: `Grow the colony to ${target} residents.`,
      target,
      reward: { money: 9000 * tier, reputation: 8 },
      measure: (state) => state.population,
    };
  }

  if (cycle === 1) {
    const target = ctx.totalBuildings + 6;
    return {
      id: `endless-build-${index}`,
      title: 'Expand the Works',
      detail: `Operate ${target} structures across the crater.`,
      target,
      reward: { money: 10000 * tier, research: 60 },
      measure: (state) => state.totalBuildings,
    };
  }

  const target = Math.round(ctx.powerProduction + 120);
  return {
    id: `endless-power-${index}`,
    title: 'Reinforce the Grid',
    detail: `Reach ${target} MW of generating capacity.`,
    target,
    reward: { money: 11000 * tier, research: 70 },
    measure: (state) => state.powerProduction,
  };
}
