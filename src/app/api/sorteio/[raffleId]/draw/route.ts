import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getLotoFederalByConcurso, getLatestLotoFederal, calcularNumeroVencedor } from '@/lib/loterias';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ raffleId: string }> }
) {
  const { raffleId } = await params;
  const supabase = createAdminClient();

  // 1. Find waiting session with draw_at <= now()
  const { data: session } = await supabase
    .from('draw_sessions')
    .select('*')
    .eq('raffle_id', raffleId)
    .eq('status', 'waiting')
    .lte('draw_at', new Date().toISOString())
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // 2. Atomically claim the session (only 1 concurrent request wins)
  const { data: claimed, error: claimError } = await supabase
    .from('draw_sessions')
    .update({ status: 'drawing' })
    .eq('id', session.id)
    .eq('status', 'waiting')
    .select()
    .maybeSingle();

  if (claimError || !claimed) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    // 3. Fetch raffle
    const { data: raffle } = await supabase
      .from('raffles')
      .select('*')
      .eq('id', raffleId)
      .single();

    if (!raffle || raffle.status !== 'closed') {
      throw new Error('Rifa não encontrada ou não está fechada.');
    }

    // 4. Fetch sold tickets
    const { data: soldTickets } = await supabase
      .from('tickets')
      .select('ticket_number, user_id')
      .eq('raffle_id', raffleId)
      .eq('status', 'sold');

    if (!soldTickets || soldTickets.length === 0) {
      throw new Error('Nenhuma cota vendida.');
    }

    // 5. Fetch the specific committed concurso result
    //    Falls back to latest if target_concurso is not set (legacy sessions)
    let lotoResult;
    try {
      if (session.target_concurso) {
        lotoResult = await getLotoFederalByConcurso(session.target_concurso);
      } else {
        lotoResult = await getLatestLotoFederal();
      }
    } catch (err) {
      if (String(err).includes('CONCURSO_NOT_AVAILABLE')) {
        // Result not published yet — revert to waiting so client can retry
        await supabase
          .from('draw_sessions')
          .update({ status: 'waiting' })
          .eq('id', session.id);
        return NextResponse.json(
          { ok: false, error: 'CONCURSO_NOT_AVAILABLE' },
          { status: 503 }
        );
      }
      throw err;
    }

    let winnerTicketNumber = calcularNumeroVencedor(
      lotoResult.primeiroPremio,
      raffle.total_numbers
    );

    // 6. Find ticket owner (with fallback to nearest sold ticket)
    let winnerTicket = soldTickets.find(t => t.ticket_number === winnerTicketNumber);
    if (!winnerTicket) {
      winnerTicket = soldTickets.reduce((closest, t) => {
        const diffT = Math.abs(t.ticket_number - winnerTicketNumber);
        const diffC = Math.abs(closest.ticket_number - winnerTicketNumber);
        return diffT < diffC ? t : closest;
      });
      winnerTicketNumber = winnerTicket.ticket_number;
    }

    // 7. Fetch winner name
    const { data: winnerUser } = await supabase
      .from('users')
      .select('name')
      .eq('id', winnerTicket.user_id)
      .single();

    const winnerName = winnerUser?.name ?? 'Desconhecido';

    // 8. Mark raffle as drawn
    await supabase
      .from('raffles')
      .update({
        status: 'drawn',
        drawn_at: new Date().toISOString(),
        winner_ticket_number: winnerTicketNumber,
        winner_user_id: winnerTicket.user_id,
      })
      .eq('id', raffleId);

    // 9. Update draw_session as drawn (triggers Realtime for all viewers)
    await supabase
      .from('draw_sessions')
      .update({
        status: 'drawn',
        winner_ticket_number: winnerTicketNumber,
        winner_name: winnerName,
        concurso: lotoResult.concurso,
        primeiro_premio: lotoResult.primeiroPremio,
      })
      .eq('id', session.id);

    return NextResponse.json({ ok: true, winnerTicketNumber });
  } catch (err) {
    console.error('Draw error:', err);
    // Revert to waiting to allow retry
    await supabase
      .from('draw_sessions')
      .update({ status: 'waiting' })
      .eq('id', session.id);

    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
