import { ImageResponse } from 'next/og';

import { CraterMark } from '../brand';

/**
 * The Android maskable install icon.
 *
 * Android crops an installed icon to whatever shape the launcher uses - circle,
 * squircle, teardrop - and anything outside the inner 80% can be cut away. A
 * normal icon handed to that crop loses its outer ring; this variant is padded
 * into the safe zone so the crater rim survives whatever shape it lands in.
 *
 * Served as a route rather than a committed PNG to keep the repository free of
 * binary art, in line with the rest of the project.
 */
export const dynamic = 'force-static';

export function GET() {
  return new ImageResponse(
    <CraterMark size={512} scale={0.66} background="#12100e" />,
    { width: 512, height: 512 },
  );
}
