import { getRaffleDetails } from '@/server/raffle-actions';
import { getCurrentUser } from '@/server/auth-actions';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CheckoutSummary } from '@/components/checkout/CheckoutSummary';

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raffle = await getRaffleDetails(id);
  if (!raffle) redirect('/');

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/checkout/${id}`);

  const supabase = await createClient();
  const { data: tickets } = await supabase
    .from('tickets')
    .select('*')
    .eq('raffle_id', id)
    .eq('user_id', user.id)
    .eq('status', 'reserved');

  if (!tickets || tickets.length === 0) {
    redirect(`/rifa/${id}`);
  }

  const expiresAt = tickets[0].expires_at ?? new Date(Date.now() + 20 * 60 * 1000).toISOString();

  return (
    <div className="container mx-auto p-4 min-h-screen relative z-10">
      <CheckoutSummary raffle={raffle} tickets={tickets} expiresAt={expiresAt} />
    </div>
  );
}
