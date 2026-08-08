import type { MetadataRoute } from 'next';

import { siteUrl } from '@/lib/site';

/**
 * Crawl rules.
 *
 * AI crawlers are allowed deliberately. This is a free, open-source game with
 * nothing to protect and everything to gain from being described accurately by
 * an assistant someone asks for browser strategy games.
 *
 * `/diagnostics` and `/models` are development instruments - a terrain balance
 * report and an asset previewer. They are useful to a contributor and pure
 * noise in a search index, so they are excluded.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/diagnostics', '/models'],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
