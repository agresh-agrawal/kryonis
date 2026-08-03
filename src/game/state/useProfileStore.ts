'use client';

import { create } from 'zustand';

import { DEFAULT_DOCTRINE, getDoctrine, type Doctrine, type DoctrineId } from '../progress/doctrine';

/**
 * Who is running this colony, and on what terms.
 *
 * Set once on the opening screen and then read all over the game. Kept in its
 * own store rather than folded into the colony store because it is the one thing
 * that must survive a colony being reset without being reset with it - the
 * player is still the same person.
 */
export interface Profile {
  /** What the game calls the player. */
  commander: string;
  /** The programme's name, shown in the HUD. */
  corporation: string;
  doctrine: DoctrineId;
}

export const DEFAULT_PROFILE: Profile = {
  commander: 'Commander',
  corporation: 'Kryonis Industries',
  doctrine: DEFAULT_DOCTRINE,
};

interface ProfileState extends Profile {
  set: (profile: Partial<Profile>) => void;
  reset: () => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  ...DEFAULT_PROFILE,

  set: (profile) => set(profile),
  reset: () => set({ ...DEFAULT_PROFILE }),
}));

/** The doctrine currently in force, outside React. */
export function currentDoctrine(): Doctrine {
  return getDoctrine(useProfileStore.getState().doctrine);
}
