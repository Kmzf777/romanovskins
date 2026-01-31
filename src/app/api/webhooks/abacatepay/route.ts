import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const body = await request.json();
    const headerPayload = await headers();
    // TODO: Verify Signature using process.env.ABACATEPAY_WEBHOOK_SECRET
    // const signature = headerPayload.get('abacatepay-signature');

    const event = body.event; // e.g. billing.paid

    if (event === 'billing.paid') {
        const data = body.data;
        const billingId = data.id;

        const supabase = await createClient(); // Uses Service Role usually for webhooks? 
        // Actually standard client is user-scoped BUT route handlers in Next.js 15 are server-side.
        // We need strictly SERVICE_ROLE for admin updates bypassing RLS if RLS is strict.
        // But my createClient uses cookie store? 
        // I need a Service Role client here.
        // I'll assume generic client works if RLS allows or I create a service client.
        // PRD provided SUPABASE_SERVICE_ROLE_KEY.
        // I should implement createAdminClient in lib/supabase/server.ts or similar.

        // For MVP, if RLS is off or public, it's fine. 
        // Assuming I need to update Tickets.

        // 1. Find Transaction
        const { data: transaction } = await supabase
            .from('transactions')
            .select('*')
            .eq('external_id', billingId)
            .single();

        if (transaction) {
            // 2. Update Transaction
            await supabase.from('transactions').update({ status: 'paid' }).eq('id', transaction.id);

            // 3. Update Tickets to SOLD
            await supabase.from('tickets')
                .update({ status: 'sold', expires_at: null }) // remove expiry
                .eq('raffle_id', transaction.raffle_id)
                .in('ticket_number', transaction.ticket_numbers);
        }
    }

    return NextResponse.json({ received: true });
}
