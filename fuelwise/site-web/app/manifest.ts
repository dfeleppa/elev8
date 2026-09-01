import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fuelwise — Adaptive Nutrition Coach',
    short_name: 'Fuelwise',
    description: 'Track macros, review progress, and adapt nutrition targets.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f6f8',
    theme_color: '#302a56',
    orientation: 'portrait-primary',
    icons: [
      { src: '/icon-1024.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' },
      { src: '/icon-1024.png', sizes: '1024x1024', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
