/**
 * The canonical origin, resolved once.
 *
 * Metadata, robots and the sitemap all need the same absolute origin, and they
 * are generated in three different places. Deriving it here stops them drifting
 * apart - a sitemap that advertises a different host to the canonical link is
 * worse than having no sitemap at all.
 *
 * Vercel sets `VERCEL_URL` per deployment, so preview builds describe
 * themselves instead of claiming to be production.
 */
export const PRODUCTION_URL = 'https://kryonis.agreshagrawal.com';

export function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_ENV === 'production') return PRODUCTION_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}
