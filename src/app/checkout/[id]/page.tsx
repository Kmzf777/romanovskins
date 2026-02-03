import { getRaffleDetails } from '@/server/raffle-actions'; // Ensure this uses src path automatically via alias
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

    // Verify reserved tickets
    const { data: tickets } = await supabase
        .from('tickets')
        .select('*')
        .eq('raffle_id', id)
        .eq('user_id', userId)
        .eq('status', 'reserved'); // Must be reserved

    if (!tickets || tickets.length === 0) {
        // Maybe expired? Redirect back to raffle
        redirect(`/rifa/${id}`);
    }

    return (
        <div className="container mx-auto p-4 min-h-screen relative z-10">
            <CheckoutSummary raffle={raffle} tickets={tickets} />
        </div>
    );
}
