import type { Metadata } from 'next';
import { getRaffleDetails, getRaffleTickets } from '@/server/raffle-actions';
import { RaffleDetailClient } from '@/components/raffle/RaffleDetailClient';
import { getCurrentUser } from '@/server/auth-actions';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const raffle = await getRaffleDetails(id);

  if (!raffle) {
    return {
      title: 'Rifa não encontrada',
      description: 'Esta rifa não existe ou foi encerrada.',
    };
  }

  const title = `${raffle.title} — Concorra Agora`;
  const description = raffle.description
    || `Concorra a ${raffle.title} por apenas R$${Number(raffle.price_per_ticket).toFixed(2).replace('.', ',')} por cota. Sorteio pela Loteria Federal.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: raffle.image_url ? [{
        url: raffle.image_url,
        alt: raffle.title,
        width: 600,
        height: 600,
      }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: raffle.image_url ? [raffle.image_url] : undefined,
    },
  };
}

export default async function RafflePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const raffle = await getRaffleDetails(id);

    if (!raffle) {
        notFound();
    }

    const tickets = await getRaffleTickets(id);
    const user = await getCurrentUser();
    const userId = user?.id;

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: raffle.title,
      description: raffle.description || `Rifa de ${raffle.title}`,
      image: raffle.image_url,
      offers: {
        '@type': 'Offer',
        priceCurrency: 'BRL',
        price: raffle.price_per_ticket.toFixed(2),
        availability: 'https://schema.org/InStock',
        url: `https://romanovdasrifas.vercel.app/rifa/${raffle.id}`,
      },
    };

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <div className="container mx-auto p-4 max-w-4xl">
          <RaffleDetailClient raffle={raffle} tickets={tickets} userId={userId} />
        </div>
      </>
    );
}
