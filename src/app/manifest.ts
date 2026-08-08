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
      'Build and run a self-sustaining colony on Mars. Free, in your browser.',
    start_url: '/',
    display: 'fullscreen',
    orientation: 'landscape',
    background_color: '#0c0a09',
    theme_color: '#0c0a09',
    categories: ['games', 'entertainment', 'education'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
