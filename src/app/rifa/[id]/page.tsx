import { getRaffleDetails, getRaffleTickets } from '@/server/raffle-actions';
import { RaffleDetailClient } from '@/components/raffle/RaffleDetailClient';
import { getCurrentUser } from '@/server/auth-actions';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function RafflePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const raffle = await getRaffleDetails(id);

    if (!raffle) {
        notFound();
    }

    const tickets = await getRaffleTickets(id);
    const user = await getCurrentUser();
    const userId = user?.id;

    return (
        <div className="container mx-auto p-4 max-w-4xl relative z-10">
            <RaffleDetailClient raffle={raffle} tickets={tickets} userId={userId} />
        </div>
    );
}
