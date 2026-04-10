import { MetadataRoute } from 'next';
import { getRaffles } from '@/server/raffle-actions';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://romanovdasrifas.vercel.app';

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/como-funciona`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/ganhadores`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
  ];

  try {
    const raffles = await getRaffles();
    const rafflePages: MetadataRoute.Sitemap = raffles.map((raffle: any) => ({
      url: `${baseUrl}/rifa/${raffle.id}`,
      lastModified: new Date(raffle.created_at),
      changeFrequency: 'hourly' as const,
      priority: 0.9,
    }));
    return [...staticPages, ...rafflePages];
  } catch {
    return staticPages;
  }
}
