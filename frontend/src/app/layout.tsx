import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { IBM_Plex_Mono, Inter, Newsreader } from 'next/font/google';

import './globals.css';

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600'],
  // Next.js doesn't ship built-in font-metrics overrides for Newsreader yet.
  // Disabling the override silences a noisy build warning; CLS impact is
  // negligible because the page H1 uses display: swap and the font is small.
  adjustFontFallback: false,
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-ui',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'LedgerLens',
  description: 'AI-assisted transaction categorization for bookkeepers.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${inter.variable} ${ibmPlexMono.variable}`}
    >
      <body className="font-sans">{children}</body>
    </html>
  );
}
