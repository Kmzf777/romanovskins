import { getRaffleDetails } from '@/server/raffle-actions';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { CheckoutSummary } from '@/components/checkout/CheckoutSummary';

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const raffle = await getRaffleDetails(id);

    if (!raffle) redirect('/');

    const supabase = await createClient();
    const cookieStore = await cookies();
    const userId = cookieStore.get('romanov_user')?.value;

    if (!userId) redirect('/login');

    const { data: tickets } = await supabase
        .from('tickets')
        .select('*')
        .eq('raffle_id', id)
        .eq('user_id', userId)
        .eq('status', 'reserved');

    if (!tickets || tickets.length === 0) {
        redirect(`/rifa/${id}`);
    }

    // Pegar expires_at do primeiro ticket (todos têm o mesmo)
    const expiresAt = tickets[0].expires_at ?? new Date(Date.now() + 20 * 60 * 1000).toISOString();

    return (
        <div className="container mx-auto p-4 min-h-screen relative z-10">
            <CheckoutSummary raffle={raffle} tickets={tickets} expiresAt={expiresAt} />
        </div>
    );
}
