import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://fuelwise-adaptive-coach.daneff.chatgpt.site'),
  title: 'Fuelwise — Adaptive Nutrition Coach',
  description: 'An adaptive macro coach that adjusts your nutrition targets based on real progress.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Fuelwise',
  appleWebApp: { capable: true, title: 'Fuelwise', statusBarStyle: 'black-translucent' },
  icons: { apple: '/icon-1024.png', icon: '/icon-1024.png' },
  openGraph: {
    title: 'Fuelwise — Adaptive Nutrition Coach',
    description: 'Adaptive nutrition, built around your progress.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fuelwise — Adaptive Nutrition Coach',
    description: 'Adaptive nutrition, built around your progress.',
    images: ['/og.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#302a56',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
