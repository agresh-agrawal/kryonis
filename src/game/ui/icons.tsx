'use client';

import type { ResourceId } from '../core/resources';

/**
 * The interface icon set.
 *
 * Hand-drawn SVG paths rather than an icon font or a sprite sheet: the project
 * ships no binary assets, icons need to inherit `currentColor` to work in the
 * accent/cyan/red states the HUD uses, and at these sizes a 24-unit viewBox is
 * plenty of resolution.
 */

type IconProps = { className?: string };

const svg = (paths: React.ReactNode) =>
  function Icon({ className = 'h-4 w-4' }: IconProps) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
        {paths}
      </svg>
    );
  };

// --- Resources -------------------------------------------------------------

export const CreditsIcon = svg(
  <>
    <circle cx="12" cy="12" r="9" opacity="0.25" />
    <path d="M12 5a7 7 0 100 14 7 7 0 000-14zm.9 10.9v1.1h-1.6v-1.1c-1.2-.2-2.1-.9-2.2-2h1.6c.1.5.6.8 1.4.8.7 0 1.2-.3 1.2-.8s-.4-.7-1.5-.9c-1.5-.3-2.5-.8-2.5-2.1 0-1 .8-1.8 2-2V7.9h1.6V9c1.1.2 1.9.9 2 2h-1.6c-.1-.5-.5-.8-1.2-.8s-1.1.3-1.1.7c0 .5.4.6 1.5.9 1.6.3 2.5.9 2.5 2.2 0 1-.8 1.8-2.1 1.9z" />
  </>,
);

export const OxygenIcon = svg(
  <>
    <circle cx="12" cy="12" r="9" opacity="0.25" />
    <path d="M12 4a8 8 0 100 16 8 8 0 000-16zm0 2.6a5.4 5.4 0 110 10.8 5.4 5.4 0 010-10.8zm0 1.8a3.6 3.6 0 100 7.2 3.6 3.6 0 000-7.2z" />
  </>,
);

export const WaterIcon = svg(
  <path d="M12 2.7c3.6 4.3 6.2 7.7 6.2 10.7A6.2 6.2 0 0112 19.6a6.2 6.2 0 01-6.2-6.2c0-3 2.6-6.4 6.2-10.7zm-3.6 11a3.6 3.6 0 003.6 3.6v-1.8a1.8 1.8 0 01-1.8-1.8z" />,
);

export const FoodIcon = svg(
  <path d="M12 3c3.9 0 7 3.4 7 7.6 0 4.9-3.6 8.6-7 10.4-3.4-1.8-7-5.5-7-10.4C5 6.4 8.1 3 12 3zm0 2.4c-.1 2 .4 3.4 1.5 4.4 1 1 1.6 2.2 1.7 3.7.9-1.2 1.4-2.5 1.4-3.9 0-2.8-2-4.2-4.6-4.2zm-.9.2C9 6.2 7.4 7.7 7.4 9.9c0 2.9 2 5.5 4.6 7.2V11c-.9-1.3-1.3-3-.9-5.4z" />,
);

export const ConcreteIcon = svg(
  <>
    <path d="M3 7.4l9-4.2 9 4.2v9.2l-9 4.2-9-4.2z" opacity="0.28" />
    <path d="M12 3.2l9 4.2-9 4.2-9-4.2zm-9 5.9l8.1 3.8v7.6L3 16.6zm18 0v7.5l-8.1 3.8V13z" />
  </>,
);

export const ResearchIcon = svg(
  <path d="M9.4 2.6h5.2v2h-.9v4.1l4.6 8.3c.9 1.6-.3 3.6-2.1 3.6H7.8c-1.8 0-3-2-2.1-3.6l4.6-8.3V4.6h-.9zm2.1 2v4.6l-1.6 2.9h4.2l-1.6-2.9V4.6z" />,
);

export const PowerIcon = svg(<path d="M13.6 2L5.4 13.2h5l-1.4 8.6 8.6-11.6h-5.2z" />);

export const ColonistsIcon = svg(
  <path d="M9 5.6a2.9 2.9 0 115.8 0 2.9 2.9 0 01-5.8 0zM4.8 8.4a2.2 2.2 0 114.4 0 2.2 2.2 0 01-4.4 0zm10 0a2.2 2.2 0 114.4 0 2.2 2.2 0 01-4.4 0zM12 10.2c2.8 0 5 1.5 5 3.4V19H7v-5.4c0-1.9 2.2-3.4 5-3.4zM5.4 12c.6 0 1.2.1 1.7.3-.7.8-1.1 1.8-1.1 2.9V19H2v-4.2c0-1.6 1.5-2.8 3.4-2.8zm13.2 0c1.9 0 3.4 1.2 3.4 2.8V19h-4v-3.8c0-1.1-.4-2.1-1.1-2.9.5-.2 1.1-.3 1.7-.3z" />,
);

export const RESOURCE_ICONS: Partial<Record<ResourceId, (props: IconProps) => React.ReactElement>> = {
  money: CreditsIcon,
  oxygen: OxygenIcon,
  water: WaterIcon,
  food: FoodIcon,
  concrete: ConcreteIcon,
  research: ResearchIcon,
};

// --- Navigation ------------------------------------------------------------

export const DashboardIcon = svg(
  <path d="M3.3 11.3L12 3.4l8.7 7.9-1.3 1.5-1-.9v8.2H5.6v-8.2l-1 .9zM10 19h4v-5h-4z" />,
);

export const BuildIcon = svg(
  <path d="M14.7 2.4a5.6 5.6 0 00-5 8.1l-7 7a1.8 1.8 0 002.6 2.6l7-7a5.6 5.6 0 007.3-6.7l-3 3-2.4-2.4 3-3a5.7 5.7 0 00-2.5-1.6z" />,
);

export const ZonesIcon = svg(
  <path d="M12 2.6a9.4 9.4 0 100 18.8 9.4 9.4 0 000-18.8zm0 2a7.4 7.4 0 110 14.8 7.4 7.4 0 010-14.8zm-1 3.4h2v2.6h2.6v2H13v2.6h-2V12.6H8.4v-2H11z" />,
);

export const MissionsIcon = svg(
  <path d="M5 3h9.2l.6 2H20v9h-6.2l-.6-2H7v9H5z" />,
);

export const TradeIcon = svg(
  <path d="M7.2 4.5h11.3l-1.6 8.6H8.4l.3 1.6h9.6v2H7.3a1.4 1.4 0 01-1.4-1.2L4 3.9H2v-2h3.2c.7 0 1.2.5 1.4 1.1zM8.8 17.6a1.8 1.8 0 110 3.6 1.8 1.8 0 010-3.6zm7.6 0a1.8 1.8 0 110 3.6 1.8 1.8 0 010-3.6z" />,
);

export const PlanetIcon = svg(
  <path d="M12 2.6a9.4 9.4 0 109.4 9.4A9.4 9.4 0 0012 2.6zm0 2a7.3 7.3 0 014.6 1.6c-1.1.9-2.6 1.2-4 1.4-2 .3-3.4.8-4.2 2.2-.6 1.1-1.6 1.5-2.8 1.6a7.4 7.4 0 016.4-6.8zm-7.3 8.1c1.4.2 2.6-.2 3.6-1 .5.9 1.4 1.5 2.6 1.8 1.8.4 2.4 1.2 2.4 2.6 0 .9-.3 1.7-.8 2.4a7.4 7.4 0 01-7.8-5.8zm10.2 5a3.9 3.9 0 00.4-1.6c0-1.4.6-2.2 1.7-2.9.7-.4 1.3-1 1.7-1.7a7.4 7.4 0 01-3.8 6.2z" />,
);

export const AlertIcon = svg(
  <path d="M12 2.8l10 17.4H2zm-1 6.1v5.4h2V8.9zm0 6.8v2h2v-2z" />,
);

export const TrophyIcon = svg(
  <path d="M6 3h12v2h3v3.2A4.8 4.8 0 0116.4 13a5 5 0 01-3.4 3.6V19h3.4v2H7.6v-2H11v-2.4A5 5 0 017.6 13 4.8 4.8 0 013 8.2V5h3zm0 4H5v1.2A2.8 2.8 0 006.4 11 12 12 0 016 7.5zm12 0a12 12 0 01-.4 3.5A2.8 2.8 0 0019 8.2V7z" />,
);

export const MailIcon = svg(
  <path d="M3 5.4h18v13.2H3zm2.3 2L12 12l6.7-4.6z" />,
);

export const ChartIcon = svg(
  <path d="M4 19.4h17v2H2V2.6h2zM8 16H6v-5h2zm4 0h-2V7h2zm4 0h-2v-7h2zm4 0h-2V4.6h2z" />,
);

export const MenuIcon = svg(
  <path d="M3.5 5.4h17v2.2h-17zm0 5.5h17v2.2h-17zm0 5.5h17v2.2h-17z" />,
);

export const SunIcon = svg(
  <path d="M12 6.9a5.1 5.1 0 110 10.2 5.1 5.1 0 010-10.2zM11 1.4h2v3.4h-2zm0 17.4h2v3.4h-2zM1.4 11h3.4v2H1.4zm17.8 0h3.4v2h-3.4zM4.2 5.6l1.4-1.4 2.4 2.4-1.4 1.4zm12 12l1.4-1.4 2.4 2.4-1.4 1.4zm3.8-13.4l1.4 1.4-2.4 2.4-1.4-1.4zM6.2 16.2l1.4 1.4-2.4 2.4-1.4-1.4z" />,
);

export const MoonIcon = svg(
  <path d="M14.5 2.6a9.4 9.4 0 106.9 12.7A7.6 7.6 0 0114.5 2.6z" />,
);

export const StormIcon = svg(
  <path d="M4 6.2h11a2.4 2.4 0 100-2.4H4zm0 5h15a2.4 2.4 0 100-2.4H4zm0 5h11.6a2.6 2.6 0 11-2 4.3l1.5-1.3a.7.7 0 10.5-1.2H4z" />,
);

export const SupplyIcon = svg(
  <path d="M12 2.4l8.6 4.3v10.6L12 21.6 3.4 17.3V6.7zm0 2.3L6.2 7.6 12 10.5l5.8-2.9zM5.4 9.3v6.8l5.6 2.8v-6.8zm13.2 0l-5.6 2.8v6.8l5.6-2.8z" />,
);

export const UpgradeIcon = svg(
  <path d="M12 2.6l7.4 7.4-2.1 2.1-3.8-3.8v11.1h-3V8.3l-3.8 3.8L4.6 10z" />,
);

export const CrewIcon = svg(
  <path d="M12 3a3.4 3.4 0 110 6.8A3.4 3.4 0 0112 3zm0 8.4c3.8 0 6.9 2 6.9 4.4V21H5.1v-5.2c0-2.4 3.1-4.4 6.9-4.4z" />,
);

export const ClockIcon = svg(
  <path d="M12 2.6a9.4 9.4 0 100 18.8 9.4 9.4 0 000-18.8zm1 4.4v5.2l3.6 2.1-1 1.7-4.6-2.7V7z" />,
);
