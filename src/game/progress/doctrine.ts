/**
 * Mission doctrine.
 *
 * The opening screen used to ask two questions, one of which - the corporation
 * name - changed nothing. Doctrine is the one that earns its place: it is asked
 * once, before landing, and it moves numbers for the rest of the game.
 *
 * The three are balanced against each other rather than against a baseline, so
 * none is the "easy" one. Each is straightforwardly better at something and
 * straightforwardly worse at something else, and the player can read exactly
 * which from the screen before committing.
 */

import type { ResearchId } from './research';

export type DoctrineId = 'scientific' | 'industrial' | 'sustainer';

export interface Doctrine {
  id: DoctrineId;
  name: string;
  /** One line, shown on the card. */
  premise: string;
  /** The trade, in the player's words. */
  strengths: string[];
  weaknesses: string[];
  /** Added to (or subtracted from) the standard starting stock. */
  startingStock: Partial<{
    money: number;
    research: number;
    metal: number;
    water: number;
    food: number;
    oxygen: number;
  }>;
  /** Multiplies research point cost of every project. */
  researchCostScale: number;
  /** Multiplies construction time. */
  buildTimeScale: number;
  /** Multiplies life-support consumption. */
  lifeSupportScale: number;
  /** Granted free at landing, so the first hour already feels different. */
  freeResearch: ResearchId | null;
}

export const DOCTRINES: Record<DoctrineId, Doctrine> = {
  scientific: {
    id: 'scientific',
    name: 'Scientific',
    premise: 'A research station that happens to need a colony around it.',
    strengths: ['Research projects cost 20% less', 'Starts with research banked'],
    weaknesses: ['Less starting capital', 'Nothing built faster'],
    startingStock: { money: -5000, research: 120 },
    researchCostScale: 0.8,
    buildTimeScale: 1,
    lifeSupportScale: 1,
    freeResearch: 'panel-coatings',
  },
  industrial: {
    id: 'industrial',
    name: 'Industrial',
    premise: 'Get the foundry running and everything else follows.',
    strengths: ['Construction is 25% faster', 'Extra metal and capital to land with'],
    weaknesses: ['Research is no cheaper', 'Crew consume at the standard rate'],
    startingStock: { money: 6000, metal: 400 },
    researchCostScale: 1,
    buildTimeScale: 0.75,
    lifeSupportScale: 1,
    freeResearch: null,
  },
  sustainer: {
    id: 'sustainer',
    name: 'Sustainer',
    premise: 'Nobody dies. Everything else is negotiable.',
    strengths: ['Life support drains 20% slower', 'Deep starting reserves of air, water and food'],
    weaknesses: ['Least starting capital', 'Builds at the standard rate'],
    startingStock: { money: -3000, water: 400, food: 350, oxygen: 400 },
    researchCostScale: 1,
    buildTimeScale: 1,
    lifeSupportScale: 0.8,
    freeResearch: 'regenerative-scrubbers',
  },
};

export const DOCTRINE_IDS = Object.keys(DOCTRINES) as DoctrineId[];

export const DEFAULT_DOCTRINE: DoctrineId = 'industrial';

export function getDoctrine(id: DoctrineId | undefined): Doctrine {
  return DOCTRINES[id ?? DEFAULT_DOCTRINE] ?? DOCTRINES[DEFAULT_DOCTRINE];
}
