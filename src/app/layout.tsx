import type { Metadata, Viewport } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'KRYONIS',
  description: 'Build and run a self-sustaining colony on Mars.',
};

export const viewport: Viewport = {
  themeColor: '#14100e',
  // The game owns the whole viewport; browser zoom would break the HUD layout.
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="h-full overflow-hidden bg-[#14100e] antialiased">{children}</body>
    </html>
  );
}
