/**
 * "What should I do next?"
 *
 * A colony sim can present a player with twenty legal actions and no way to
 * rank them. The directive list says what the game wants; this says what the
 * *colony* needs, which is often something else entirely - a directive asking
 * for a second greenhouse is not the most useful advice while the batteries are
 * flat.
 *
 * Rules are ordered by urgency and the first match wins. Deliberately a plain
 * ordered list rather than anything cleverer: the ranking is the design, and it
 * needs to be readable and arguable at a glance.
 */

import type { ColonyStats } from '../sim/simulation';
import type { ResourceStock } from '../core/resources';

export interface NextStep {
  /** The instruction, in the imperative. */
  text: string;
  tone: 'critical' | 'warn' | 'info' | 'good';
}

export interface NextStepContext {
  stats: ColonyStats;
  stock: ResourceStock;
  counts: Record<string, number>;
  totalBuildings: number;
  vacancies: number;
  hasResearchLead: boolean;
  researchRunning: boolean;
  researchPoints: number;
}

export function suggestNextStep(ctx: NextStepContext): NextStep {
  const { stats, stock, counts } = ctx;

  // --- Life support first. Nothing else matters if people are dying. ------
  if (stock.oxygen <= 0) {
    return { text: 'Oxygen is out — build an oxygen plant now', tone: 'critical' };
  }
  if (stock.water <= 0) {
    return { text: 'Water is out — build an ice extractor now', tone: 'critical' };
  }
  if (stock.food <= 0) {
    return { text: 'Food is out — build a greenhouse now', tone: 'critical' };
  }

  // --- Then power, because it is what keeps life support running. ---------
  if (stats.powerProduction <= 0 && ctx.totalBuildings > 1) {
    return { text: 'Nothing is generating power — build a solar array', tone: 'critical' };
  }
  if (stats.powerDemand > stats.powerProduction) {
    return { text: 'Demand exceeds supply — add generation or a battery bank', tone: 'warn' };
  }

  // --- Then the things that are about to become life support problems. ----
  if (!counts.oxygen) {
    return { text: 'Build an oxygen plant before the tanks run down', tone: 'warn' };
  }
  if (!counts.water) {
    return { text: 'Build an ice extractor — water cannot be shipped in', tone: 'warn' };
  }
  if (!counts.greenhouse) {
    return { text: 'Build a greenhouse before the food reserve runs out', tone: 'warn' };
  }

  // --- Then growth. -------------------------------------------------------
  if (ctx.vacancies > 0) {
    return {
      text: `${ctx.vacancies} ${ctx.vacancies === 1 ? 'quarter is' : 'quarters are'} empty — hire crew`,
      tone: 'info',
    };
  }
  if (stats.jobs > stats.population) {
    return { text: 'Posts are unfilled — build housing, then hire', tone: 'info' };
  }
  if (!counts.lab) {
    return { text: 'Build a research laboratory to start generating research', tone: 'info' };
  }
  if (!ctx.researchRunning && ctx.researchPoints > 0) {
    return { text: 'Research points are idle — start a project', tone: 'info' };
  }
  if (!ctx.hasResearchLead) {
    return { text: 'Assign a crew member to lead research', tone: 'info' };
  }
  if (stats.happiness < 0.5) {
    return { text: 'Morale is low — more housing and space per colonist', tone: 'warn' };
  }

  return { text: 'The colony is stable — expand the perimeter and grow', tone: 'good' };
}
