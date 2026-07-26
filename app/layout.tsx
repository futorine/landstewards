import type { Metadata } from 'next';
import { Bodoni_Moda, Public_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';
import { LandStateProvider } from '@/components/LandStateProvider';

// Didone — the historic face of engraved security documents and banknotes.
const display = Bodoni_Moda({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  variable: '--font-display',
});

// The US government design system typeface. Official without being sterile.
const body = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
});

// Carries every address, hash, ENS name and slot subname.
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Landstewards — stewardship slots on ENS',
  description:
    'A land project as an ENS name, its stewardship slots as subnames, each pointing at a steward.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <body>
        <Providers>
          <LandStateProvider>{children}</LandStateProvider>
        </Providers>
      </body>
    </html>
  );
}
