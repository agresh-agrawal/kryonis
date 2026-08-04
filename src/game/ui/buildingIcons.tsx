'use client';

import type { BuildingId } from '../buildings/catalog';

/**
 * Silhouette icons for the build deck.
 *
 * These replaced rendered 3D thumbnails. The thumbnails looked better, but they
 * needed a second WebGL context to draw into, and browsers cap how many a page
 * may hold - when that cap was hit the *game's* canvas was the one handed a
 * degraded context, and shaders started failing to compile. A card illustration
 * is not worth risking the renderer.
 *
 * Each icon is a recognisable profile rather than a generic box, so the deck
 * can still be scanned by shape instead of by reading every label.
 */

type IconProps = { className?: string };

const icon = (paths: React.ReactNode) =>
  function BuildingIcon({ className = 'h-10 w-10' }: IconProps) {
    return (
      <svg viewBox="0 0 48 48" className={className} fill="currentColor" aria-hidden>
        {paths}
      </svg>
    );
  };

const GROUND = <rect x="4" y="37" width="40" height="1.6" opacity="0.35" />;

const Lander = icon(
  <>
    {GROUND}
    <path d="M24 6l6 8v9H18v-9z" />
    <path d="M17 23h14v6H17z" opacity="0.75" />
    <path d="M14 29l-4 8h3l3.4-8zm20 0l4 8h-3l-3.4-8z" opacity="0.6" />
    <circle cx="24" cy="16" r="2.2" opacity="0.45" />
  </>,
);

const Habitat = icon(
  <>
    {GROUND}
    <path d="M10 37a14 14 0 0128 0z" />
    <path d="M6 37h36v1.6H6z" opacity="0.5" />
    <circle cx="18" cy="28" r="2" opacity="0.4" />
    <circle cx="24" cy="25" r="2" opacity="0.4" />
    <circle cx="30" cy="28" r="2" opacity="0.4" />
  </>,
);

const Corridor = icon(
  <>
    {GROUND}
    <rect x="8" y="24" width="32" height="12" rx="6" />
    <rect x="16" y="24" width="1.6" height="12" opacity="0.4" />
    <rect x="30" y="24" width="1.6" height="12" opacity="0.4" />
  </>,
);

const Road = icon(
  <>
    {GROUND}
    <rect x="10" y="26" width="28" height="8" rx="2" />
    <rect x="15" y="22" width="18" height="4" rx="1.2" opacity="0.7" />
    <rect x="23" y="18" width="2" height="8" opacity="0.55" />
  </>,
);

const Atrium = icon(
  <>
    {GROUND}
    <path d="M10 37a14 14 0 0128 0z" opacity="0.5" />
    <path d="M24 23v14M13 30l22 0M16 26l16 8M32 26l-16 8" opacity="0.55" stroke="currentColor" strokeWidth="1.1" fill="none" />
    <circle cx="24" cy="33" r="3.4" />
  </>,
);

const Solar = icon(
  <>
    {GROUND}
    <path d="M7 30l6-13h22l6 13z" />
    <path d="M14 19h20M12 24h24M10 28h28" stroke="var(--color-void)" strokeWidth="1.2" opacity="0.55" />
    <rect x="22" y="30" width="4" height="7" opacity="0.7" />
  </>,
);

const Battery = icon(
  <>
    {GROUND}
    <rect x="9" y="18" width="12" height="19" rx="1.6" />
    <rect x="27" y="18" width="12" height="19" rx="1.6" />
    <rect x="12" y="15" width="6" height="3" opacity="0.7" />
    <rect x="30" y="15" width="6" height="3" opacity="0.7" />
    <path d="M15 24l-2 5h3l-1 4 3-6h-3z" opacity="0.55" />
  </>,
);

const Reactor = icon(
  <>
    {GROUND}
    <path d="M18 37V20a6 6 0 0112 0v17z" />
    <path d="M6 22h9v11H6zm27 0h9v11h-9z" opacity="0.55" />
    <circle cx="24" cy="16" r="3" opacity="0.8" />
  </>,
);

const Oxygen = icon(
  <>
    {GROUND}
    <rect x="8" y="20" width="13" height="17" rx="1.4" />
    <rect x="25" y="15" width="7" height="22" rx="3.5" />
    <rect x="34" y="22" width="6" height="15" rx="3" opacity="0.7" />
    <circle cx="14.5" cy="17" r="3" opacity="0.6" />
  </>,
);

const Water = icon(
  <>
    {GROUND}
    <path d="M24 8l3 6h-6z" />
    <rect x="22.6" y="12" width="2.8" height="21" />
    <path d="M14 37l6-16m14 16l-6-16" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.6" />
    <rect x="30" y="26" width="10" height="11" rx="2" opacity="0.65" />
  </>,
);

const Greenhouse = icon(
  <>
    {GROUND}
    <path d="M8 37V24a16 8 0 0132 0v13z" opacity="0.45" />
    <path d="M14 37V26m10 11V22m10 15V26" stroke="currentColor" strokeWidth="1.4" fill="none" opacity="0.75" />
    <rect x="10" y="32" width="28" height="5" opacity="0.8" />
  </>,
);

const Mine = icon(
  <>
    {GROUND}
    <path d="M9 37l7-14 6 5 5-9 5 8 7 10z" />
    <path d="M30 12l8 5-2 3-8-5z" opacity="0.65" />
    <circle cx="16" cy="30" r="2" opacity="0.4" />
  </>,
);

const Storage = icon(
  <>
    {GROUND}
    <rect x="8" y="17" width="9" height="20" rx="4.5" />
    <rect x="19.5" y="21" width="9" height="16" rx="4.5" opacity="0.8" />
    <rect x="31" y="15" width="9" height="22" rx="4.5" opacity="0.65" />
  </>,
);

const Factory = icon(
  <>
    {GROUND}
    <rect x="7" y="22" width="34" height="15" rx="1.6" />
    <path d="M13 22v-8h4v8zm9 0v-6h4v6z" opacity="0.7" />
    <rect x="12" y="27" width="5" height="5" opacity="0.35" />
    <rect x="21" y="27" width="5" height="5" opacity="0.35" />
    <rect x="30" y="27" width="5" height="5" opacity="0.35" />
  </>,
);

const FuelPlant = icon(
  <>
    {GROUND}
    <rect x="9" y="13" width="10" height="24" rx="5" />
    <rect x="23" y="21" width="8" height="16" rx="4" opacity="0.8" />
    <rect x="34" y="24" width="7" height="13" rx="3.5" opacity="0.65" />
    <path d="M19 26h4M31 28h3" stroke="currentColor" strokeWidth="1.6" opacity="0.6" />
  </>,
);

const Lab = icon(
  <>
    {GROUND}
    <rect x="7" y="19" width="34" height="9" rx="4.5" />
    <rect x="7" y="29" width="34" height="8" rx="4" opacity="0.75" />
    <circle cx="15" cy="23.5" r="1.8" opacity="0.45" />
    <circle cx="24" cy="23.5" r="1.8" opacity="0.45" />
    <circle cx="33" cy="23.5" r="1.8" opacity="0.45" />
  </>,
);

const Medical = icon(
  <>
    {GROUND}
    <path d="M11 37a13 13 0 0126 0z" />
    <path d="M21.6 20h4.8v4.6H31v4.8h-4.6V34h-4.8v-4.6H17v-4.8h4.6z" fill="var(--color-void)" opacity="0.8" />
  </>,
);

const Comms = icon(
  <>
    {GROUND}
    <path d="M24 30a11 11 0 0111-11 11 11 0 01-11 11z" transform="rotate(-38 24 30)" />
    <rect x="22.8" y="24" width="2.4" height="13" />
    <rect x="8" y="28" width="10" height="9" rx="1.6" opacity="0.7" />
  </>,
);

const Spaceport = icon(
  <>
    {GROUND}
    <ellipse cx="24" cy="31" rx="18" ry="6" opacity="0.45" />
    <ellipse cx="24" cy="31" rx="10" ry="3.4" opacity="0.6" />
    <path d="M24 6c3 4 4.4 8.4 4.4 12.6L24 24l-4.4-5.4C19.6 14.4 21 10 24 6z" />
    <path d="M8 26v-4M40 26v-4" stroke="currentColor" strokeWidth="1.6" opacity="0.6" />
  </>,
);

/** Export Terminal: a canister on a pad with a cargo container beside it. */
const ExportPad = icon(
  <>
    {GROUND}
    <ellipse cx="17" cy="31" rx="11" ry="4" opacity="0.4" />
    <path d="M17 9c2.4 3.2 3.5 6.8 3.5 10.2V27h-7v-7.8C13.5 15.8 14.6 12.2 17 9z" />
    <path d="M11 27l2.5-3M23 27l-2.5-3" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
    <rect x="30" y="20" width="12" height="8" rx="1" opacity="0.75" />
    <path d="M30 24h12" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
    <path d="M36 20v-4h8" stroke="currentColor" strokeWidth="1.6" fill="none" opacity="0.6" />
  </>,
);

export const BUILDING_ICONS: Record<BuildingId, (props: IconProps) => React.ReactElement> = {
  lander: Lander,
  exportpad: ExportPad,
  habitat: Habitat,
  corridor: Corridor,
  road: Road,
  atrium: Atrium,
  solar: Solar,
  battery: Battery,
  reactor: Reactor,
  oxygen: Oxygen,
  water: Water,
  greenhouse: Greenhouse,
  mine: Mine,
  storage: Storage,
  factory: Factory,
  fuelplant: FuelPlant,
  lab: Lab,
  medical: Medical,
  comms: Comms,
  spaceport: Spaceport,
};
