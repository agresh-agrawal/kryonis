/**
 * Who each colonist is.
 *
 * The roster used to be five names and a skill label, which is a list, not a
 * crew. A colonist becomes a person when three things are true about them that
 * are not true of anybody else: they have a job title, they are posted
 * somewhere specific, and they are paid.
 *
 * Wages matter beyond flavour. They are the colony's only recurring cost, which
 * is what stops credits being a number that only ever goes up once the export
 * terminal is running - and it gives hiring a consequence beyond the one-off
 * fee.
 */

import { BUILDINGS, type BuildingId } from '../buildings/catalog';
import type { CrewMember, CrewSkill } from './useCrewStore';

/**
 * Job titles by speciality and rank.
 *
 * Rank 1 is the person doing the work, 2 runs a shift, 3 runs the department.
 * Reading "Chief Engineer" instead of "Engineering, rank 3" is the entire
 * difference between a stat block and a colleague.
 */
const TITLES: Record<CrewSkill, [string, string, string]> = {
  Engineering: ['Technician', 'Systems Engineer', 'Chief Engineer'],
  Biology: ['Horticulturist', 'Life Support Officer', 'Chief Biologist'],
  Geology: ['Driller', 'Survey Geologist', 'Chief Geologist'],
  Operations: ['Logistics Hand', 'Operations Officer', 'Colony Manager'],
  Medicine: ['Medic', 'Flight Surgeon', 'Chief Medical Officer'],
};

export function jobTitle(member: CrewMember): string {
  const rank = Math.max(1, Math.min(3, Math.round(member.rank)));
  return TITLES[member.skill][rank - 1];
}

/**
 * Wage per sol, in credits.
 *
 * Deliberately modest against export income - a working colony should be able
 * to carry its payroll comfortably, and a stalled one should feel the drain.
 * Rank costs more because rank does more.
 */
export function wageOf(member: CrewMember): number {
  const base = 55;
  const rankStep = 22;
  const speciality = member.skill === 'Medicine' ? 14 : member.skill === 'Engineering' ? 9 : 0;
  return base + (member.rank - 1) * rankStep + speciality;
}

export function payrollOf(roster: CrewMember[]): number {
  return roster.reduce((total, member) => total + wageOf(member), 0);
}

/**
 * Which structures a speciality is qualified to run.
 *
 * Used to post crew somewhere that makes sense rather than at random. A
 * geologist belongs at the mine, not in the greenhouse, and seeing that on the
 * roster is what makes the assignment read as deliberate.
 */
const POSTINGS: Record<CrewSkill, BuildingId[]> = {
  Engineering: ['reactor', 'solar', 'battery', 'factory', 'fuelplant', 'exportpad'],
  Biology: ['greenhouse', 'oxygen', 'atrium'],
  Geology: ['mine', 'water', 'storage'],
  Operations: ['exportpad', 'storage', 'spaceport', 'comms', 'lander'],
  Medicine: ['medical', 'lander', 'atrium'],
};

export interface Posting {
  /** The structure this colonist works at, or null when unassigned. */
  buildingId: string | null;
  /** Its type, for the label. */
  buildingType: BuildingId | null;
  label: string;
}

/**
 * Assigns every colonist to a workplace.
 *
 * A stable, deterministic pass rather than a live simulation of people walking
 * to jobs: the roster is small, this runs whenever it or the colony changes,
 * and the result has to be the same every time or the crew screen would
 * reshuffle itself while being read.
 *
 * Preference order is specialists into their own field first, then anyone into
 * anything with a vacancy, then unassigned. That means a colony short of
 * geologists puts an engineer on the drill, which is exactly what a real
 * outpost does.
 */
export function assignPostings(
  roster: CrewMember[],
  buildings: { id: string; type: BuildingId; progress: number; enabled: boolean }[],
): Map<string, Posting> {
  const postings = new Map<string, Posting>();

  // Seats available per structure, from the catalog.
  const seats = new Map<string, { type: BuildingId; free: number }>();
  for (const building of buildings) {
    if (building.progress < 1 || !building.enabled) continue;
    const workers = BUILDINGS[building.type].workers;
    if (workers > 0) seats.set(building.id, { type: building.type, free: workers });
  }

  const take = (member: CrewMember, preferred: boolean): boolean => {
    const wanted = POSTINGS[member.skill];
    for (const [buildingId, seat] of seats) {
      if (seat.free <= 0) continue;
      if (preferred && !wanted.includes(seat.type)) continue;
      seat.free -= 1;
      postings.set(member.id, {
        buildingId,
        buildingType: seat.type,
        label: BUILDINGS[seat.type].name,
      });
      return true;
    }
    return false;
  };

  // Two passes: specialists claim their own field before anyone fills a gap.
  const unplaced = roster.filter((member) => !take(member, true));
  for (const member of unplaced) {
    if (!take(member, false)) {
      postings.set(member.id, {
        buildingId: null,
        buildingType: null,
        label: 'Off duty',
      });
    }
  }

  return postings;
}
