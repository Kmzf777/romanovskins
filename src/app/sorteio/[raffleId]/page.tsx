import { createClient } from '@/lib/supabase/server';
import { DrawRoom } from './DrawRoom';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface DrawSession {
  id: string;
  raffle_id: string;
  draw_at: string;
  countdown_minutes: number;
  status: 'waiting' | 'drawing' | 'drawn';
  winner_ticket_number: number | null;
  winner_name: string | null;
  concurso: number | null;
  primeiro_premio: string | null;
}

interface Raffle {
  id: string;
  title: string;
  image_url: string;
  total_numbers: number;
  status: string;
}

export default async function SorteioPage({
  params,
}: {
  params: Promise<{ raffleId: string }>;
}) {
  const { raffleId } = await params;
  const supabase = await createClient();

  const [{ data: raffle }, { data: session }] = await Promise.all([
    supabase
      .from('raffles')
      .select('id, title, image_url, total_numbers, status')
      .eq('id', raffleId)
      .single(),
    supabase
      .from('draw_sessions')
      .select('*')
      .eq('raffle_id', raffleId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!raffle) notFound();

  return (
    <DrawRoom
      raffle={raffle as Raffle}
      initialSession={session as DrawSession | null}
    />
  );
}
