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
    title: 'Keep the Lights On',
    detail: 'Put up two solar arrays. Nothing here works without power — not the air, not the heat, not you.',
    target: 2,
    reward: { money: 1800 },
    measure: (ctx) => count(ctx, 'solar'),
  },
  {
    id: 'breathe',
    title: 'Make Some Air',
    detail: 'Build an oxygen plant. The air outside is almost all carbon dioxide — so turn it into something you can breathe.',
    target: 1,
    reward: { money: 2200, research: 20 },
    measure: (ctx) => count(ctx, 'oxygen'),
  },
  {
    id: 'first-export',
    title: 'Start Earning',
    detail:
      'Build an Export Terminal. Anything you stockpile above a safe reserve gets sold to Earth - that is where credits come from.',
    target: 1,
    reward: { money: 2400 },
    measure: (ctx) => count(ctx, 'exportpad'),
  },
  {
    id: 'shelter',
    title: 'Get Everyone Indoors',
    detail: 'Two habitat domes. Your crew are still sleeping in the lander, and they have noticed.',
    target: 2,
    reward: { money: 2600, concrete: 40 },
    measure: (ctx) => count(ctx, 'habitat'),
  },
  {
    id: 'water',
    title: 'Find Water',
    detail: 'Put an ice extractor on an ice field. Look for the pale blue ground.',
    target: 1,
    reward: { money: 3000, research: 25 },
    measure: (ctx) => count(ctx, 'water'),
  },
  {
    id: 'feed',
    title: 'Grow Your Own Food',
    detail: 'Build a greenhouse. The rations you landed with will not last, and nobody is bringing more.',
    target: 1,
    reward: { money: 3200, research: 30 },
    measure: (ctx) => count(ctx, 'greenhouse'),
  },
  {
    id: 'crew-12',
    title: 'Twelve People',
    detail: 'Grow to twelve colonists. Build housing first — nobody moves in without a bed.',
    target: 12,
    reward: { money: 4500, reputation: 5 },
    measure: (ctx) => ctx.population,
  },
  {
    id: 'science',
    title: 'Start Researching',
    detail: 'Build a research lab. It earns the points that pay for every upgrade you unlock later.',
    target: 1,
    reward: { money: 4000, research: 40 },
    measure: (ctx) => count(ctx, 'lab'),
  },
  {
    id: 'stockpile',
    title: 'Stock Up',
    detail: 'Bank 400 concrete. Big builds go much faster when you are not waiting on materials.',
    target: 400,
    reward: { money: 5000 },
    measure: (ctx) => ctx.stock.concrete,
  },
  {
    id: 'industry',
    title: 'Start Making Things',
    detail: 'Run a mine and a fabrication plant together. Dig it up, then turn it into something useful.',
    target: 2,
    reward: { money: 6000, research: 45 },
    measure: (ctx) => Math.min(count(ctx, 'mine'), 1) + Math.min(count(ctx, 'factory'), 1),
  },
  {
    id: 'grid-200',
    title: 'Power Up',
    detail: 'Reach 200 MW of generation. Everything you build from here is hungrier than what came before.',
    target: 200,
    reward: { money: 7500, research: 50 },
    measure: (ctx) => ctx.powerProduction,
  },
  {
    id: 'content',
    title: 'Keep Everyone Happy',
    detail: 'Hold morale above 85%. Room to live, food worth eating, and a job that is not miserable.',
    target: 85,
    reward: { money: 8000, reputation: 10 },
    measure: (ctx) => ctx.happiness * 100,
  },
  {
    id: 'crew-30',
    title: 'Thirty People',
    detail: 'Grow to thirty colonists. This stopped being a camp a while ago.',
    target: 30,
    reward: { money: 12000, reputation: 15 },
    measure: (ctx) => ctx.population,
  },
  {
    id: 'gateway',
    title: 'Reach for Earth',
    detail: 'Finish a spaceport. Once ships can land here, you are on the map for good.',
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
      title: 'Keep Growing',
      detail: `Grow to ${target} colonists.`,
      target,
      reward: { money: 9000 * tier, reputation: 8 },
      measure: (state) => state.population,
    };
  }

  if (cycle === 1) {
    const target = ctx.totalBuildings + 6;
    return {
      id: `endless-build-${index}`,
      title: 'Build It Out',
      detail: `Get ${target} structures running across the crater.`,
      target,
      reward: { money: 10000 * tier, research: 60 },
      measure: (state) => state.totalBuildings,
    };
  }

  const target = Math.round(ctx.powerProduction + 120);
  return {
    id: `endless-power-${index}`,
    title: 'More Power',
    detail: `Reach ${target} MW of generation.`,
    target,
    reward: { money: 11000 * tier, research: 70 },
    measure: (state) => state.powerProduction,
  };
}
