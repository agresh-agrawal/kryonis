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
       * Four entries, because installers disagree about what they accept.
       *
       * The SVG is preferred wherever it is understood and scales to any slot.
       * The 192 and 512 PNGs are the pair the spec recommends and the reason
       * Chrome treats the site as installable at all - the Apple icon used to
       * fill that slot is 180px, twelve short of the threshold. The maskable
       * entry exists because Android crops install icons to the launcher's own
       * shape and would otherwise shave the crater rim off.
       */
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/maskable-icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],

    /*
     * Screenshots turn Chrome's install prompt from a one-line permission bar
     * into a card showing what is being installed. `form_factor: wide` is what
     * makes it eligible on desktop; the game is landscape-only, so there is no
     * narrow variant to offer.
     */
    screenshots: [
      {
        src: '/opengraph-image',
        sizes: '1200x630',
        type: 'image/png',
        form_factor: 'wide',
        label: 'A colony under construction on the floor of a Martian crater',
      },
    ],
  };
}
