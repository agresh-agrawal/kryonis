import type { Metadata, Viewport } from 'next';

import './globals.css';

/**
 * Canonical origin.
 *
 * `metadataBase` is what turns the relative asset paths Next generates - the
 * Open Graph image, the icons, the canonical link - into the absolute URLs
 * crawlers and social scrapers require. Without it they resolve to localhost
 * and every share preview breaks.
 *
 * Vercel exposes the deployment host, so preview builds advertise themselves
 * rather than claiming to be production.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_ENV === 'production'
    ? 'https://kryonis.agreshagrawal.com'
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

const DESCRIPTION =
  'A free browser-based 3D Mars colony builder. Land in an impact crater with four ' +
  'colonists and a budget, then balance power, oxygen, water and food to make the ' +
  'settlement self-sustaining. No install, no account.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  // The template lets in-game screens set their own title without repeating
  // the brand, while the bare title still reads correctly on the landing page.
  title: {
    default: 'KRYONIS — 3D Mars Colony Builder, Free in Your Browser',
    template: '%s · KRYONIS',
  },
  description: DESCRIPTION,
  applicationName: 'KRYONIS',
  authors: [{ name: 'Agresh Agrawal' }],
  creator: 'Agresh Agrawal',
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
  ],

  alternates: { canonical: '/' },

  openGraph: {
    type: 'website',
    siteName: 'KRYONIS',
    title: 'KRYONIS — 3D Mars Colony Builder',
    description: DESCRIPTION,
    url: '/',
    locale: 'en_GB',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'KRYONIS — 3D Mars Colony Builder',
    description: DESCRIPTION,
  },

  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};

export const viewport: Viewport = {
  themeColor: '#0c0a09',
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
 * difference between being described as "a web page" and being described as a
 * free browser game about running a Mars colony. VideoGame is the precise type;
 * the offer states the price explicitly because "free" is the single most
 * useful fact about it.
 */
const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@type': 'VideoGame',
  name: 'KRYONIS',
  url: SITE_URL,
  description: DESCRIPTION,
  applicationCategory: 'Game',
  genre: ['Strategy', 'Simulation', 'City Builder'],
  gamePlatform: 'Web Browser',
  operatingSystem: 'Any (modern web browser with WebGL 2)',
  playMode: 'SinglePlayer',
  inLanguage: 'en',
  author: { '@type': 'Person', name: 'Agresh Agrawal' },
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  isAccessibleForFree: true,
  keywords:
    'Mars colony builder, browser game, colony simulation, space strategy, base building',
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
