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
  /** Credits on hand, so the advisor can spot a colony that is stuck broke. */
  credits: number;
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
    return { text: 'Out of air! Build an oxygen plant now', tone: 'critical' };
  }
  if (stock.water <= 0) {
    return { text: 'Out of water! Build an ice extractor now', tone: 'critical' };
  }
  if (stock.food <= 0) {
    return { text: 'Out of food! Build a greenhouse now', tone: 'critical' };
  }

  // --- Then power, because it is what keeps life support running. ---------
  if (stats.powerProduction <= 0 && ctx.totalBuildings > 1) {
    return { text: 'No power at all — put up a solar array', tone: 'critical' };
  }
  if (stats.powerDemand > stats.powerProduction) {
    return { text: 'You are using more power than you make — add solar or batteries', tone: 'warn' };
  }

  // --- Then the things that are about to become life support problems. ----
  if (!counts.oxygen) {
    return { text: 'Build an oxygen plant before the tanks empty', tone: 'warn' };
  }
  if (!counts.water) {
    return { text: 'Build an ice extractor — no one is shipping you water', tone: 'warn' };
  }
  if (!counts.greenhouse) {
    return { text: 'Build a greenhouse before the food runs out', tone: 'warn' };
  }

  /*
   * Then money, before growth.
   *
   * A colony with no income is not slow, it is stopped - every remaining
   * action costs credits it will never get. This sits above the growth advice
   * because telling somebody to hire crew they cannot pay for is worse than
   * saying nothing.
   */
  if (!counts.exportpad) {
    if (ctx.credits < 4000) {
      return {
        text: 'Running out of credits - build an Export Terminal to start earning',
        tone: 'critical',
      };
    }
    return { text: 'Build an Export Terminal to sell surplus to Earth', tone: 'warn' };
  }
  if (ctx.stats.exportIncome <= 0.001) {
    return {
      text: 'Nothing to export yet - mine ore or make fuel and it sells itself',
      tone: 'warn',
    };
  }

  // --- Then growth. -------------------------------------------------------
  if (ctx.vacancies > 0) {
    return {
      text: `${ctx.vacancies} ${ctx.vacancies === 1 ? 'quarter is' : 'quarters are'} empty — hire crew`,
      tone: 'info',
    };
  }
  if (stats.jobs > stats.population) {
    return { text: 'Jobs going spare — build housing, then hire', tone: 'info' };
  }
  if (!counts.lab) {
    return { text: 'Build a research lab to start earning research', tone: 'info' };
  }
  if (!ctx.researchRunning && ctx.researchPoints > 0) {
    return { text: 'Research points piling up — go spend them', tone: 'info' };
  }
  if (!ctx.hasResearchLead) {
    return { text: 'Put someone in charge of research', tone: 'info' };
  }
  if (stats.happiness < 0.5) {
    return { text: 'People are unhappy — they need more room', tone: 'warn' };
  }

  return { text: 'All steady. Claim more land and keep growing', tone: 'good' };
}
