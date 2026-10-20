import type { Metadata, Viewport } from 'next';

import { siteUrl } from '@/lib/site';

import './globals.css';

/*
 * The canonical origin comes from one place.
 *
 * `metadataBase` is what turns the relative paths Next generates - the Open
 * Graph image, the icons, the canonical link - into the absolute URLs crawlers
 * and social scrapers require. Without it they resolve to localhost and every
 * share preview breaks.
 *
 * It is imported rather than recomputed because robots.ts and sitemap.ts need
 * the same answer, and a sitemap advertising a different host to the canonical
 * link is worse than having no sitemap at all.
 */
const SITE_URL = siteUrl();

const TAGLINE = 'Build and run a self-sustaining colony on Mars.';

const DESCRIPTION =
  'A free browser-based 3D Mars colony builder. Land in an impact crater with four ' +
  'colonists and a budget, then balance power, oxygen, water and food against dust ' +
  'storms and equipment failure. Runs in your browser - no install, no account.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  // The template lets in-game screens set their own title without repeating
  // the brand, while the bare title still reads correctly on the landing page.
  title: {
    default: 'KRYONIS - 3D Mars Colony Builder, Free in Your Browser',
    template: '%s · KRYONIS',
  },
  description: DESCRIPTION,
  applicationName: 'KRYONIS',
  authors: [{ name: 'Agresh Agrawal', url: 'https://agreshagrawal.com' }],
  creator: 'Agresh Agrawal',
  publisher: 'Agresh Agrawal',
  category: 'games',

  keywords: [
    'Mars colony builder',
    'browser game',
    'colony simulation',
    'space strategy game',
    'city builder',
    'Mars game',
    'base building game',
    'management simulation',
    'WebGL game',
    'free browser strategy game',
    'educational space game',
    'survival colony sim',
  ],

  alternates: { canonical: '/' },

  /*
   * Icons are declared rather than left to convention alone.
   *
   * Next links the files it finds, but being explicit documents which slot each
   * one serves - and the Apple entry matters because iOS cannot use the SVG at
   * all and would otherwise fall back to a screenshot of a black canvas.
   */
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-icon', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/manifest.webmanifest',

  openGraph: {
    type: 'website',
    siteName: 'KRYONIS',
    title: 'KRYONIS - 3D Mars Colony Builder',
    description: DESCRIPTION,
    url: '/',
    locale: 'en_GB',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'KRYONIS - 3D Mars Colony Builder',
    description: DESCRIPTION,
  },

  appleWebApp: {
    capable: true,
    title: 'KRYONIS',
    statusBarStyle: 'black-translucent',
  },

  // Safari turns bare numbers into telephone links, and the HUD is nothing but
  // bare numbers.
  formatDetection: { telephone: false, address: false, email: false },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: '#0c0a09',
  colorScheme: 'dark',
  // The game owns the whole viewport; browser zoom would break the HUD layout.
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

/**
 * Structured data.
 *
 * Search engines and AI assistants both read schema.org JSON-LD, and it is the
 * difference between being described as "a web page" and as a free browser game
 * about running a Mars colony.
 *
 * Three nodes in one graph: the game itself, the person who made it, and a set
 * of questions people actually ask before clicking an unfamiliar game link. The
 * FAQ earns its place because those answers - is it free, does it need
 * installing, what do I need to run it - are precisely what an assistant is
 * asked to summarise, and leaving them to be inferred from prose invites a
 * confidently wrong answer.
 */
const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'VideoGame',
      '@id': `${SITE_URL}/#game`,
      name: 'KRYONIS',
      alternateName: 'KRYONIS - Mars Colony Builder',
      url: SITE_URL,
      description: DESCRIPTION,
      abstract: TAGLINE,
      applicationCategory: 'Game',
      genre: ['Strategy', 'Simulation', 'City Builder', 'Management'],
      gamePlatform: 'Web Browser',
      operatingSystem: 'Any (modern web browser with WebGL 2)',
      browserRequirements: 'Requires WebGL 2 and JavaScript.',
      playMode: 'SinglePlayer',
      numberOfPlayers: { '@type': 'QuantitativeValue', maxValue: 1, minValue: 1 },
      inLanguage: 'en',
      image: `${SITE_URL}/opengraph-image`,
      screenshot: `${SITE_URL}/opengraph-image`,
      author: { '@id': `${SITE_URL}/#author` },
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
      isAccessibleForFree: true,
      license: 'https://opensource.org/licenses/MIT',
      codeRepository: 'https://github.com/agresh-agrawal/kryonis',
      keywords:
        'Mars colony builder, browser game, colony simulation, space strategy, base building',
    },
    {
      '@type': 'Person',
      '@id': `${SITE_URL}/#author`,
      name: 'Agresh Agrawal',
      url: 'https://agreshagrawal.com',
    },
    {
      '@type': 'FAQPage',
      '@id': `${SITE_URL}/#faq`,
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Is KRYONIS free to play?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. KRYONIS is completely free, with no accounts, advertising or purchases of any kind. The source is also open under the MIT licence.',
          },
        },
        {
          '@type': 'Question',
          name: 'Do I need to install anything to play?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'No. KRYONIS runs entirely in the browser as a web page. There is nothing to download and no account to create.',
          },
        },
        {
          '@type': 'Question',
          name: 'What do I need to run KRYONIS?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'A desktop browser with WebGL 2 support. A discrete graphics card is not required - graphics quality is detected automatically and can be overridden in settings.',
          },
        },
        {
          '@type': 'Question',
          name: 'What is the aim of the game?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'You land in a Martian impact crater with four colonists and a budget. You generate power, split the carbon-dioxide atmosphere into breathable oxygen, drill buried ice for water, grow food and hire crew, keeping that chain balanced while dust storms and equipment failures disrupt it. The colony can never be permanently lost - setbacks are survivable.',
          },
        },
        {
          '@type': 'Question',
          name: 'Is there multiplayer?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'No. KRYONIS is single-player only.',
          },
        },
      ],
    },
  ],
} as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          // The payload is a compile-time constant, not user input.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
      </head>
      <body className="h-full overflow-hidden bg-[#0c0a09] antialiased">{children}</body>
    </html>
  );
}
