import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getLatestLotoFederal, calcularNumeroVencedor } from '@/lib/loterias';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ raffleId: string }> }
) {
  const { raffleId } = await params;
  const supabase = createAdminClient();

  // 1. Buscar draw_session waiting com draw_at <= now()
  const { data: session } = await supabase
    .from('draw_sessions')
    .select('*')
    .eq('raffle_id', raffleId)
    .eq('status', 'waiting')
    .lte('draw_at', new Date().toISOString())
    .maybeSingle();

  if (!session) {
    // Sessão não existe, já foi processada, ou ainda não é hora — ignorar
    return NextResponse.json({ ok: true, skipped: true });
  }

  // 2. Atualizar atomicamente para 'drawing' (apenas 1 request vence)
  const { data: claimed, error: claimError } = await supabase
    .from('draw_sessions')
    .update({ status: 'drawing' })
    .eq('id', session.id)
    .eq('status', 'waiting') // condição atômica: só atualiza se ainda 'waiting'
    .select()
    .maybeSingle();

  if (claimError || !claimed) {
    // Outro request já ganhou a corrida
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    // 3. Buscar raffle
    const { data: raffle } = await supabase
      .from('raffles')
      .select('*')
      .eq('id', raffleId)
      .single();

    if (!raffle || raffle.status !== 'closed') {
      throw new Error('Rifa não encontrada ou não está fechada.');
    }

    // 4. Buscar tickets vendidos
    const { data: soldTickets } = await supabase
      .from('tickets')
      .select('ticket_number, user_id')
      .eq('raffle_id', raffleId)
      .eq('status', 'sold');

    if (!soldTickets || soldTickets.length === 0) {
      throw new Error('Nenhuma cota vendida.');
    }

    // 5. Buscar resultado da Loteria Federal
    const lotoResult = await getLatestLotoFederal();
    let winnerTicketNumber = calcularNumeroVencedor(
      lotoResult.primeiroPremio,
      raffle.total_numbers
    );

    // 6. Encontrar dono do ticket (com fallback para ticket mais próximo)
    let winnerTicket = soldTickets.find(t => t.ticket_number === winnerTicketNumber);
    if (!winnerTicket) {
      winnerTicket = soldTickets.reduce((closest, t) => {
        const diffT = Math.abs(t.ticket_number - winnerTicketNumber);
        const diffC = Math.abs(closest.ticket_number - winnerTicketNumber);
        return diffT < diffC ? t : closest;
      });
      winnerTicketNumber = winnerTicket.ticket_number;
    }

    // 7. Buscar nome do ganhador
    const { data: winnerUser } = await supabase
      .from('users')
      .select('name')
      .eq('id', winnerTicket.user_id)
      .single();

    const winnerName = winnerUser?.name ?? 'Desconhecido';

    // 8. Atualizar raffle como 'drawn'
    await supabase
      .from('raffles')
      .update({
        status: 'drawn',
        drawn_at: new Date().toISOString(),
        winner_ticket_number: winnerTicketNumber,
        winner_user_id: winnerTicket.user_id,
      })
      .eq('id', raffleId);

    // 9. Atualizar draw_session como 'drawn' com resultado (dispara Realtime para todos)
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
    // Reverter status para 'waiting' em caso de erro para permitir retry
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
