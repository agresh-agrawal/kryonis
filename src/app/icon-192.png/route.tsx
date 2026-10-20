import { ImageResponse } from 'next/og';

import { CraterMark } from '../brand';

/**
 * The 192px install icon.
 *
 * The manifest needs a non-maskable raster icon of at least 192px before Chrome
 * will treat the site as installable. It previously advertised the 180px Apple
 * icon for that slot, which is twelve pixels short, so the install prompt was
 * relying on the SVG entry being accepted - which older installers skip.
 *
 * Unlike the maskable variant this one is not cropped by the launcher, so the
 * mark can use nearly the whole canvas.
 */
export const dynamic = 'force-static';

export function GET() {
  return new ImageResponse(<CraterMark size={192} scale={0.94} />, { width: 192, height: 192 });
}
