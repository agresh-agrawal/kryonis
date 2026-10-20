import type { MetadataRoute } from 'next';

/**
 * Web app manifest.
 *
 * `fullscreen` rather than `standalone`: the game already takes the entire
 * viewport and hides its own scrollbars, so any browser chrome left on screen
 * is chrome sitting on top of Mars.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KRYONIS — Mars Colony Builder',
    short_name: 'KRYONIS',
    description:
      'Build and run a self-sustaining colony on Mars. Balance power, oxygen, ' +
      'water and food against dust storms and equipment failure. Free, in your browser.',
    start_url: '/',
    scope: '/',
    id: '/',
    display: 'fullscreen',
    orientation: 'landscape',
    background_color: '#0c0a09',
    theme_color: '#0c0a09',
    lang: 'en',
    dir: 'ltr',
    categories: ['games', 'entertainment', 'education'],
    icons: [
      /*
       * Three entries, because installers disagree about what they accept.
       *
       * The SVG is preferred wherever it is understood and scales to any slot.
       * The maskable PNG exists because Android crops install icons to the
       * launcher's own shape and would otherwise shave the crater rim off. The
       * "any" PNG is the fallback for installers that silently skip SVG.
       */
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/maskable-icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
