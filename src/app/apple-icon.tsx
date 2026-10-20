import { ImageResponse } from 'next/og';

import { CraterMark } from './brand';

/**
 * The iOS home-screen icon.
 *
 * iOS does not support SVG touch icons at all, so without this the site had no
 * usable icon when saved to a home screen - Safari falls back to a screenshot
 * of the page, which for a dark WebGL canvas is a black square.
 *
 * 180x180 is the size current iPhones ask for; iOS downsamples it for every
 * other slot it needs.
 */
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  // iOS already applies its own rounded-rectangle mask, so the mark fills more
  // of the canvas here than it does in the maskable Android variant.
  return new ImageResponse(<CraterMark size={180} scale={0.94} />, size);
}
