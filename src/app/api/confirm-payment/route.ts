import { createAdminClient, createClient } from '@/lib/supabase/server';
import { abacatePay } from '@/lib/abacatepay';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tid = searchParams.get('tid');

  if (!tid) {
    return NextResponse.json({ error: 'Missing tid' }, { status: 400 });
  }

  // Require the caller to be the authenticated owner of the transaction,
  // OR an internal server-side call (same origin / no-cors fetch from success page).
  // We verify by checking that the transaction's user_id matches the session user.
  // Internal calls from the success page SSR are allowed because they use the
  // service-role client to read the transaction first, then call this endpoint
  // from server-side. We accept those by checking the Referer or a shared secret header.
  const internalSecret = request.headers.get('x-internal-secret');
  const expectedInternal = process.env.INTERNAL_API_SECRET ?? '';

  let callerUserId: string | null = null;
  if (expectedInternal && internalSecret === expectedInternal) {
    // Trusted internal server-to-server call (e.g., from success page SSR)
    callerUserId = null; // will skip ownership check below
  } else {
    // Verify Supabase session from cookies
    const supabaseUser = await createClient();
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    callerUserId = user.id;
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

  // Ownership check: authenticated users may only query their own transactions
  if (callerUserId !== null && transaction.user_id !== callerUserId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (transaction.status === 'paid') {
    return NextResponse.json({ status: 'paid' });
  }

  if (!transaction.external_id || transaction.external_id === 'unknown') {
    console.error('⚠️ Transaction has no valid external_id:', transaction.id);
    return NextResponse.json({ status: 'pending' });
  }

  try {
    // Correct endpoint: GET /billing/list (not /billing/listAll, not /billing/{id})
    const response = await abacatePay.get('/billing/list');
    const list: any[] = response.data?.data ?? response.data ?? [];

    if (!Array.isArray(list)) {
      console.error('❌ Unexpected /billing/list response shape:', JSON.stringify(response.data).slice(0, 200));
      return NextResponse.json({ status: 'pending' });
    }

    const billing = list.find((b: any) => b.id === transaction.external_id);

    if (!billing) {
      console.warn('⚠️ Billing not found in list for external_id:', transaction.external_id,
        '| Total billings returned:', list.length);
      return NextResponse.json({ status: 'pending' });
    }

    const billingStatus: string = (billing.status ?? '').toUpperCase();
    console.log('📥 AbacatePay billing status for', transaction.external_id, ':', billingStatus);

    if (billingStatus === 'PAID') {
      // Mark transaction paid
      const { data: updatedRows } = await supabase
        .from('transactions')
        .update({ status: 'paid' })
        .eq('id', transaction.id)
        .eq('status', 'pending')
        .select('id');

      if (!updatedRows || updatedRows.length === 0) {
        return NextResponse.json({ status: 'paid' });
      }

      // Mark tickets sold
      const { error: ticketErr } = await supabase
        .from('tickets')
        .update({ status: 'sold', expires_at: null })
        .eq('raffle_id', transaction.raffle_id)
        .in('ticket_number', transaction.ticket_numbers)
        .eq('user_id', transaction.user_id);

      if (ticketErr) {
        console.error('❌ Error updating tickets:', ticketErr);
      } else {
        console.log('✅ confirm-payment: tickets sold for transaction', transaction.id);
      }

      revalidatePath(`/rifa/${transaction.raffle_id}`);
      revalidatePath('/');
      revalidatePath('/meus-tickets');

      return NextResponse.json({ status: 'paid' });
    }

    return NextResponse.json({ status: 'pending' });
  } catch (e: any) {
    console.error('❌ Error querying AbacatePay:', e.response?.data || e.message);
    return NextResponse.json({ status: 'pending' });
  }
}
