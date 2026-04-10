import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cuca AI',
    short_name: 'Cuca AI',
    description: 'AI Workspace e Segundo Cérebro',
    start_url: '/',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#09090b',
    orientation: 'portrait',
    icons: [
      {
        src: '/cuca_logo.png',
        sizes: 'any',
        type: 'image/png',
      },
    ],
  };
}
