'use client';

import { create } from 'zustand';

import type { ResearchBranch } from '../progress/research';

export type CrewSkill = 'Engineering' | 'Biology' | 'Geology' | 'Operations' | 'Medicine';

export interface CrewMember {
  id: string;
  name: string;
  skill: CrewSkill;
  rank: number;
  hiredAtSol: number;
  role: string;
}

export interface CrewSnapshot {
  roster: CrewMember[];
  assignedResearcherId: string | null;
}

const STARTING_CREW: CrewMember[] = [
  { id: 'c1', name: 'Mira Vale', skill: 'Engineering', rank: 2, hiredAtSol: 1, role: 'Power Lead' },
  { id: 'c2', name: 'Jonas Okafor', skill: 'Biology', rank: 2, hiredAtSol: 1, role: 'Life Support Lead' },
  { id: 'c3', name: 'Ilya Chen', skill: 'Geology', rank: 1, hiredAtSol: 1, role: 'Mining Lead' },
  { id: 'c4', name: 'Nadia Solheim', skill: 'Operations', rank: 1, hiredAtSol: 1, role: 'Colony Ops' },
];

const NAME_POOL: Record<CrewSkill, string[]> = {
  Engineering: ['Ari Sen', 'Elena Cruz', 'Tom Beck', 'Rina Holt'],
  Biology: ['Priya Nair', 'Samir West', 'Leah Novak', 'Tala Moreno'],
  Geology: ['Kenji Voss', 'Amara Stone', 'Noor Hadi', 'Felix Arden'],
  Operations: ['Sofia Marin', 'Owen Park', 'Maya Reese', 'Rafi Cole'],
  Medicine: ['Eva Ward', 'Malik Rhys', 'Anya Frost', 'Noah Vale'],
};

export const CREW_SKILLS = Object.keys(NAME_POOL) as CrewSkill[];

export const SKILL_RESEARCH_BRANCH: Record<CrewSkill, ResearchBranch | 'Any'> = {
  Engineering: 'Energy',
  Biology: 'Life Support',
  Geology: 'Industry',
  Operations: 'Colony',
  Medicine: 'Any',
};

let nextCrewId = STARTING_CREW.length + 1;

function cloneStartingCrew(): CrewMember[] {
  return STARTING_CREW.map((member) => ({ ...member }));
}

function nextName(skill: CrewSkill, index: number): string {
  const pool = NAME_POOL[skill];
  return pool[index % pool.length];
}

interface CrewState {
  roster: CrewMember[];
  assignedResearcherId: string | null;

  hire: (skill: CrewSkill, sol: number) => CrewMember;
  assignResearcher: (id: string | null) => void;
  reconcilePopulation: (population: number) => void;
  restore: (snapshot?: Partial<CrewSnapshot>) => void;
  reset: () => void;
}

export const useCrewStore = create<CrewState>((set, get) => ({
  roster: cloneStartingCrew(),
  assignedResearcherId: null,

  hire: (skill, sol) => {
    const id = `c${nextCrewId++}`;
    const member: CrewMember = {
      id,
      name: nextName(skill, get().roster.length),
      skill,
      rank: 1 + (get().roster.length % 3 === 0 ? 1 : 0),
      hiredAtSol: Math.floor(sol) + 1,
      role: `${skill} Specialist`,
    };
    set((state) => ({ roster: [...state.roster, member] }));
    return member;
  },

  assignResearcher: (id) => {
    const exists = id === null || get().roster.some((member) => member.id === id);
    if (exists) set({ assignedResearcherId: id });
  },

  reconcilePopulation: (population) => {
    const target = Math.max(0, Math.floor(population));
    set((state) => {
      if (state.roster.length <= target) return state;
      const roster = state.roster.slice(0, target);
      return {
        roster,
        assignedResearcherId: roster.some((member) => member.id === state.assignedResearcherId)
          ? state.assignedResearcherId
          : null,
      };
    });
  },

  restore: (snapshot) => {
    const roster = snapshot?.roster?.length ? snapshot.roster.map((member) => ({ ...member })) : cloneStartingCrew();
    nextCrewId =
      roster.reduce((highest, member) => {
        const numeric = Number.parseInt(member.id.replace(/^c/, ''), 10);
        return Number.isFinite(numeric) ? Math.max(highest, numeric) : highest;
      }, 0) + 1;
    set({
      roster,
      assignedResearcherId: roster.some((member) => member.id === snapshot?.assignedResearcherId)
        ? snapshot?.assignedResearcherId ?? null
        : null,
    });
  },

  reset: () => {
    nextCrewId = STARTING_CREW.length + 1;
    set({ roster: cloneStartingCrew(), assignedResearcherId: null });
  },
}));

export function hiringCost(rosterSize: number, skill: CrewSkill): number {
  const skillPremium = skill === 'Medicine' ? 300 : skill === 'Engineering' ? 220 : 170;
  /*
   * Deliberately cheap, and rising slowly.
   *
   * The old curve started at roughly 4,000 credits for the fifth colonist and
   * climbed 420 per hire after that, against an income of a few hundred a sol.
   * A colony therefore could not afford to staff the buildings it had already
   * paid for: everything ran at a fraction of capacity, oxygen production fell
   * below what the crew breathed, and the colony suffocated. Simulating
   * fourteen sols of ordinary play ended with the entire crew dead, every time.
   *
   * Crew are the thing that makes every other investment work. They should be
   * the easy purchase, not the hardest one.
   */
  return 620 + rosterSize * 140 + skillPremium;
}

export function researchDiscount(member: CrewMember | undefined, branch: ResearchBranch): number {
  if (!member) return 0;
  const affinity = SKILL_RESEARCH_BRANCH[member.skill];
  const base = affinity === branch || affinity === 'Any' ? 0.12 : 0.05;
  return Math.min(0.35, base + member.rank * 0.04);
}

/**
 * How fast a project runs, as a multiplier on the baseline.
 *
 * The assigned lead affects research twice - `researchDiscount` makes a project
 * cheaper, this makes it finish sooner. Two separate levers rather than one
 * bigger discount, because they answer different player questions: "can I
 * afford this yet" and "will it land before I need it".
 *
 * Unled research still progresses. A colony that has not thought about staffing
 * should be slow, not stopped - a hard block would just be a hidden
 * prerequisite the player was never told about.
 */
export function researchSpeed(member: CrewMember | undefined, branch: ResearchBranch): number {
  if (!member) return 0.55;
  const affinity = SKILL_RESEARCH_BRANCH[member.skill];
  const matched = affinity === branch || affinity === 'Any';
  return (matched ? 1.15 : 0.85) + member.rank * (matched ? 0.18 : 0.09);
}

/** Plain-English summary of what a member brings to a branch, for the console. */
export function describeAffinity(
  member: CrewMember,
  branch: ResearchBranch,
): { matched: boolean; text: string } {
  const affinity = SKILL_RESEARCH_BRANCH[member.skill];
  if (affinity === 'Any') return { matched: true, text: `Adapts to any branch` };
  if (affinity === branch) return { matched: true, text: `Specialist in ${branch}` };
  return { matched: false, text: `Trained in ${affinity}, not ${branch}` };
}
