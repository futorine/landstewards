import type { Metadata } from 'next';
import { Bodoni_Moda, Public_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';

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

// Carries every address, hash and blob ID, plus the machine-readable strip.
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'ZK Credential Attestor — eligibility surfaces',
  description:
    'One on-chain identity, one question any contract can ask: is this wallet allowed?',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
