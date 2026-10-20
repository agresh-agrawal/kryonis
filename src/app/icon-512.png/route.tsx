import { ImageResponse } from 'next/og';

import { CraterMark } from '../brand';

/**
 * The 512px install icon.
 *
 * Paired with the 192px variant because that is the size pair the manifest spec
 * recommends: 192 for the launcher, 512 for splash screens and store listings,
 * where an upscaled 192 would visibly soften.
 */
export const dynamic = 'force-static';

export function GET() {
  return new ImageResponse(<CraterMark size={512} scale={0.94} />, { width: 512, height: 512 });
}
