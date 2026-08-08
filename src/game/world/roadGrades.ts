/**
 * Road grades.
 *
 * There are two ways to connect a sector, and choosing between them is a real
 * decision rather than a formality:
 *
 *   - A **Service Road** is graded regolith with the conduits laid in a trench
 *     beside it. It is cheap, it is available from the first sol, and it works.
 *   - A **Sealed Transit Way** is the same run built properly: a poured deck,
 *     a pressurised shell and lit walkways. It costs three times as much and
 *     carries exactly the same power and water.
 *
 * What the sealed way buys is how the colony *feels* to live in. Crossing a
 * dust-blown service road in a suit and walking the same distance shirtsleeved
 * are not the same commute, and morale is the number that says so. A colony
 * that seals its network is measurably happier; a colony that never bothers is
 * not punished, it just never gets the bonus.
 *
 * The grade is stored per tile, so a network can be half sealed and the benefit
 * scales with the share that is - there is no threshold to hit and no reason to
 * hold off starting.
 */

import type { ResearchId } from '../progress/research';

/** Grade stored in a tile that has no road. */
export const NO_ROAD = 0;

export type RoadGrade = 1 | 2;

export interface RoadGradeDef {
  grade: RoadGrade;
  name: string;
  /** One line for the build card. */
  summary: string;
  /** The longer version, for the tooltip. */
  description: string;
  /** Credits to lay one tile of bare ground. */
  cost: number;
  /** Credits to raise one tile from a lower grade to this one. */
  upgradeCost: number;
  /**
   * Morale added when the entire network is at this grade, scaled down by the
   * share of tiles that actually are. Added to the happiness target, 0-1.
   */
  morale: number;
  /** Research that has to land first, or null when it is available at once. */
  unlockedBy: ResearchId | null;
}

export const ROAD_GRADES: Record<RoadGrade, RoadGradeDef> = {
  1: {
    grade: 1,
    name: 'Service Road',
    summary: 'Graded track with the conduits trenched alongside.',
    description:
      'Compacted regolith with power and water runs in an open trench beside it. Everything the colony needs to distribute travels on this from the day you land - crews cross it suited up, which is slow and nobody enjoys it, but it connects.',
    cost: 45,
    upgradeCost: 0,
    morale: 0,
    unlockedBy: null,
  },
  2: {
    grade: 2,
    name: 'Sealed Transit Way',
    summary: 'Pressurised, lit and shirtsleeve. Raises colony morale.',
    description:
      'A poured deck under a sealed pressure shell, with the service runs in a proper duct beneath the floor. It carries no more power and no more water than a service road - what it carries is people, without a suit, and a colony that can walk between its own buildings is a colony people stay at.',
    cost: 165,
    upgradeCost: 125,
    morale: 0.08,
    unlockedBy: 'sealed-roadbed',
  },
};

export const ROAD_GRADE_LIST: RoadGradeDef[] = [ROAD_GRADES[1], ROAD_GRADES[2]];

/** Half back on removal, the same salvage rule demolition uses. */
export const ROAD_SALVAGE = 0.5;

export function roadGradeDef(grade: number): RoadGradeDef | null {
  return grade === 1 || grade === 2 ? ROAD_GRADES[grade] : null;
}

/**
 * What laying or upgrading one tile costs.
 *
 * Upgrading is cheaper than laying fresh because the ground is already graded
 * and the conduits are already run - you are paying for the shell, not for the
 * route. Downgrading is not a thing anyone would pay for, so it is refused.
 */
export function roadTileCost(from: number, to: RoadGrade): number | null {
  if (from === to) return null;
  if (from === NO_ROAD) return ROAD_GRADES[to].cost;
  if (from < to) return ROAD_GRADES[to].upgradeCost;
  return null;
}

/**
 * The morale a network's build quality contributes.
 *
 * Linear in the sealed share, so the first sealed tile is worth as much as the
 * last one and there is never a moment where finishing the job is the only way
 * to be paid for it.
 */
export function roadMorale(sealedTiles: number, totalTiles: number): number {
  if (totalTiles <= 0) return 0;
  return ROAD_GRADES[2].morale * Math.min(1, sealedTiles / totalTiles);
}
