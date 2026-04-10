import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/adminromanovskins/', '/checkout/', '/meus-tickets/'],
      },
    ],
    sitemap: 'https://romanovdasrifas.vercel.app/sitemap.xml',
  };
}
