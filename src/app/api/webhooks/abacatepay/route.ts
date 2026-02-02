import { createAdminClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Verifica assinatura HMAC do webhook
function verifyWebhookSignature(payload: string, signature: string | null, secret: string): boolean {
    if (!signature || !secret || secret === 'whsec_...') {
        // Se não tiver secret configurado, aceita em dev (não recomendado em prod)
        console.warn('⚠️ Webhook signature verification skipped - configure ABACATEPAY_WEBHOOK_SECRET');
        return true;
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

export async function POST(request: Request) {
    const rawBody = await request.text();
    const headerPayload = await headers();
    const signature = headerPayload.get('x-webhook-signature') || headerPayload.get('abacatepay-signature');

    // Verificar assinatura do webhook
    const webhookSecret = process.env.ABACATEPAY_WEBHOOK_SECRET || '';
    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
        console.error('❌ Invalid webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const event = body.event;

    console.log('📥 Webhook received:', event, body);

    if (event === 'billing.paid') {
        const data = body.data;
        const billingId = data.id;

        // Usar cliente admin para bypassar RLS
        const supabase = createAdminClient();

        // 1. Buscar transação pelo external_id
        const { data: transaction, error: txError } = await supabase
            .from('transactions')
            .select('*')
            .eq('external_id', billingId)
            .single();

        if (txError || !transaction) {
            console.error('❌ Transaction not found:', billingId, txError);
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        // 2. Atualizar status da transação para 'paid'
        const { error: updateTxError } = await supabase
            .from('transactions')
            .update({ status: 'paid' })
            .eq('id', transaction.id);

        if (updateTxError) {
            console.error('❌ Error updating transaction:', updateTxError);
        }

        // 3. Atualizar todos os tickets para 'sold' e remover expiração
        const { error: updateTicketsError } = await supabase
            .from('tickets')
            .update({ status: 'sold', expires_at: null })
            .eq('raffle_id', transaction.raffle_id)
            .in('ticket_number', transaction.ticket_numbers);

        if (updateTicketsError) {
            console.error('❌ Error updating tickets:', updateTicketsError);
        }

        console.log('✅ Payment confirmed for transaction:', transaction.id);
    }

    return NextResponse.json({ received: true });
}
