import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'sheetPress',
    short_name: 'sheetPress',
    description: 'Make an invoice. Get a PDF. Track who paid. That’s it.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fbf9f4',
    theme_color: '#fbf9f4',
    icons: [
      {
        src: '/icon',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
