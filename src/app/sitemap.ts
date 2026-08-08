import type { MetadataRoute } from 'next';

import { siteUrl } from '@/lib/site';

/**
 * The sitemap.
 *
 * One entry, because the game is one page - it is a single canvas application,
 * not a content site. Listing the development routes would only invite crawlers
 * to index a terrain-balance report.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl(),
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
