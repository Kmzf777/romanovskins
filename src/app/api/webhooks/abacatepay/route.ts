import { createAdminClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

function verifyWebhookSignature(payload: string, signature: string | null, secret: string): boolean {
  if (!secret || secret === 'whsec_...') {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Webhook signature verification skipped in development - configure ABACATEPAY_WEBHOOK_SECRET');
      return true;
    }
    console.error('❌ ABACATEPAY_WEBHOOK_SECRET not configured in production — rejecting webhook');
    return false;
  }

  if (!signature) {
    console.error('❌ Webhook received without signature');
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

async function confirmPayment(supabase: ReturnType<typeof createAdminClient>, billingId: string) {
  console.log('🔍 Looking up transaction for billingId:', billingId);

  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .eq('external_id', billingId)
    .maybeSingle();

  if (txError) {
    console.error('❌ Transaction lookup error:', txError);
    return { error: 'Transaction lookup error' };
  }

  if (!transaction) {
    console.error('❌ No transaction found with external_id:', billingId);
    const { data: recent } = await supabase
      .from('transactions')
      .select('id, external_id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    console.log('📋 Recent transactions:', JSON.stringify(recent, null, 2));
    return { error: 'Transaction not found' };
  }

  if (transaction.status === 'paid') {
    console.log('ℹ️ Transaction already paid, skipping:', transaction.id);
    return { ok: true };
  }

  console.log('✅ Found transaction:', transaction.id, '| tickets:', transaction.ticket_numbers);

  const { data: updatedRows, error: updateTxError } = await supabase
    .from('transactions')
    .update({ status: 'paid' })
    .eq('id', transaction.id)
    .eq('status', 'pending')
    .select('id');

  if (updateTxError) {
    console.error('❌ Error updating transaction:', updateTxError);
    return { error: 'Failed to update transaction' };
  }

  if (!updatedRows || updatedRows.length === 0) {
    console.log('ℹ️ Transaction already paid by concurrent request, skipping tickets update:', transaction.id);
    return { ok: true };
  }

  const { data: updatedTickets, error: updateTicketsError } = await supabase
    .from('tickets')
    .update({ status: 'sold', expires_at: null })
    .eq('raffle_id', transaction.raffle_id)
    .in('ticket_number', transaction.ticket_numbers)
    .select('ticket_number, status');

  if (updateTicketsError) {
    console.error('❌ Error updating tickets:', updateTicketsError);
    return { error: 'Failed to update tickets' };
  }

  console.log('✅ Updated tickets to sold:', updatedTickets?.map((t: any) => t.ticket_number));
  return { ok: true };
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const headerPayload = await headers();
  const signature = headerPayload.get('x-webhook-signature') || headerPayload.get('abacatepay-signature');

  const webhookSecret = process.env.ABACATEPAY_WEBHOOK_SECRET || '';
  if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    console.error('❌ Invalid webhook signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch (e) {
    console.error('❌ Failed to parse webhook body:', e);
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = body.event;
  console.log('📥 Webhook event:', event);
  console.log('📥 Webhook body:', JSON.stringify(body, null, 2));

  if (event === 'billing.paid' || event === 'BILLING_PAID') {
    const data = body.data ?? body;
    const billingId: string =
      data?.id ??
      data?.billing?.id ??
      data?.billingId ??
      body?.id;

    if (!billingId) {
      console.error('❌ Could not extract billingId from webhook body:', JSON.stringify(body, null, 2));
      return NextResponse.json({ error: 'Missing billing ID' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const result = await confirmPayment(supabase, billingId);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.error === 'Transaction not found' ? 404 : 500 }
      );
    }
  }

  return NextResponse.json({ received: true });
}
