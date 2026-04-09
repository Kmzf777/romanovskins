import { createAdminClient } from '@/lib/supabase/server';
import { abacatePay } from '@/lib/abacatepay';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tid = searchParams.get('tid');

  if (!tid) {
    return NextResponse.json({ error: 'Missing tid' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', tid)
    .maybeSingle();

  if (txError || !transaction) {
    return NextResponse.json({ status: 'not_found' }, { status: 404 });
  }

  // Already paid — nothing to do
  if (transaction.status === 'paid') {
    return NextResponse.json({ status: 'paid' });
  }

  // Transaction has no valid external_id — can't query AbacatePay
  if (!transaction.external_id || transaction.external_id === 'unknown') {
    console.error('⚠️ Transaction has no valid external_id:', transaction.id);
    return NextResponse.json({ status: 'pending' });
  }

  // Query AbacatePay for current billing status
  try {
    const response = await abacatePay.get(`/billing/${transaction.external_id}`);
    const billingData = response.data?.data ?? response.data;
    const billingStatus: string =
      billingData?.status ??
      billingData?.billing?.status ??
      '';

    console.log('📥 AbacatePay billing status for', transaction.external_id, ':', billingStatus);

    if (billingStatus.toUpperCase() === 'PAID' || billingStatus === 'paid') {
      const { data: updatedRows } = await supabase
        .from('transactions')
        .update({ status: 'paid' })
        .eq('id', transaction.id)
        .eq('status', 'pending')
        .select('id');

      if (!updatedRows || updatedRows.length === 0) {
        // Another request already confirmed payment — just return paid
        return NextResponse.json({ status: 'paid' });
      }

      const { data: updatedTickets, error: ticketErr } = await supabase
        .from('tickets')
        .update({ status: 'sold', expires_at: null })
        .eq('raffle_id', transaction.raffle_id)
        .in('ticket_number', transaction.ticket_numbers)
        .select('ticket_number');

      if (ticketErr) {
        console.error('❌ Error updating tickets in confirm-payment:', ticketErr);
      } else {
        console.log('✅ confirm-payment: tickets sold:', updatedTickets?.map((t: any) => t.ticket_number));
      }

      return NextResponse.json({ status: 'paid' });
    }

    return NextResponse.json({ status: 'pending' });
  } catch (e: any) {
    console.error('❌ Error querying AbacatePay in confirm-payment:', e.response?.data || e.message);
    return NextResponse.json({ status: 'pending' });
  }
}
