export const CHEESE_PWA_MANIFEST = {
  name: 'Cheese Pay',
  short_name: 'Cheese',
  theme_color: '#d4a843',
  background_color: '#0a0a0a',
  display: 'standalone',
  start_url: '/',
  icons: [
    {
      src: '/icons/icon-192x192.png',
      sizes: '192x192',
      type: 'image/png',
    },
    {
      src: '/icons/icon-512x512.png',
      sizes: '512x512',
      type: 'image/png',
    },
    {
      src: '/icons/icon-512x512-maskable.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
} as const;
