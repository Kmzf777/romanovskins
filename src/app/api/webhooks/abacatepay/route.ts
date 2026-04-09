import { createAdminClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { revalidatePath } from 'next/cache';

// AbacatePay's fixed public key used to sign all webhook payloads
// Source: https://docs.abacatepay.com/pages/webhooks
const ABACATEPAY_PUBLIC_KEY =
  't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9';

function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) {
    console.warn('⚠️ Webhook received without X-Webhook-Signature header');
    return false;
  }
  try {
    const expected = crypto
      .createHmac('sha256', ABACATEPAY_PUBLIC_KEY)
      .update(Buffer.from(rawBody, 'utf8'))
      .digest('base64');
    const A = Buffer.from(expected);
    const B = Buffer.from(signature);
    return A.length === B.length && crypto.timingSafeEqual(A, B);
  } catch {
    return false;
  }
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
    return { error: 'Transaction not found' };
  }

  if (transaction.status === 'paid') {
    console.log('ℹ️ Transaction already paid, skipping:', transaction.id);
    return { ok: true };
  }

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
    console.log('ℹ️ Transaction already paid by concurrent request:', transaction.id);
    return { ok: true };
  }

  const { data: updatedTickets, error: updateTicketsError } = await supabase
    .from('tickets')
    .update({ status: 'sold', expires_at: null })
    .eq('raffle_id', transaction.raffle_id)
    .in('ticket_number', transaction.ticket_numbers)
    .eq('user_id', transaction.user_id)
    .select('ticket_number, status');

  if (updateTicketsError) {
    console.error('❌ Error updating tickets:', updateTicketsError);
    return { error: 'Failed to update tickets' };
  }

  console.log('✅ Tickets sold:', updatedTickets?.map((t: any) => t.ticket_number));

  revalidatePath(`/rifa/${transaction.raffle_id}`);
  revalidatePath('/');
  revalidatePath('/meus-tickets');

  return { ok: true };
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const headerPayload = await headers();

  // Layer 1: query string secret (required — register webhook URL with ?webhookSecret=...)
  const url = new URL(request.url);
  const querySecret = url.searchParams.get('webhookSecret');
  const webhookSecret = process.env.ABACATEPAY_WEBHOOK_SECRET ?? '';

  if (!webhookSecret || querySecret !== webhookSecret) {
    console.error('❌ Invalid webhookSecret in query string. Received:', querySecret);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Layer 2: HMAC signature with AbacatePay public key
  const signature = headerPayload.get('x-webhook-signature');
  const sigValid = verifyWebhookSignature(rawBody, signature);

  if (!sigValid) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Signature check skipped in development');
    } else {
      console.error('❌ Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = body.event;
  console.log('📥 Webhook event:', event, '| devMode:', body.devMode);
  console.log('📥 Webhook data:', JSON.stringify(body.data, null, 2));

  // Accept both old (billing.paid) and new (checkout.completed) event names
  const isPaidEvent =
    event === 'checkout.completed' ||
    event === 'billing.paid' ||
    event === 'BILLING_PAID';

  if (isPaidEvent) {
    const data = body.data ?? body;
    const billingId: string | undefined =
      data?.id ??
      data?.billing?.id ??
      data?.checkout?.id ??
      data?.billingId ??
      body?.id;

    if (!billingId) {
      console.error('❌ Could not extract billingId from webhook:', JSON.stringify(body, null, 2));
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
