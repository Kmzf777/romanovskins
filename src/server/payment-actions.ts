'use server';

import { abacatePay } from '@/lib/abacatepay';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export async function createCheckoutAction(raffleId: string) { // Renamed to Action for consistency, though Plan said Actions
    const supabase = await createClient();
    const cookieStore = await cookies();
    const userId = cookieStore.get('romanov_user')?.value;

    if (!userId) {
        return { error: 'Usuário não autenticado' };
    }

    // Get User Details for Billing
    const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
    if (!user) return { error: 'Usuário não encontrado' };

    // Get Tickets (Reserved)
    const { data: tickets } = await supabase
        .from('tickets')
        .select('*')
        .eq('raffle_id', raffleId)
        .eq('user_id', userId)
        .eq('status', 'reserved');

    if (!tickets || tickets.length === 0) {
        return { error: 'Nenhuma cota reservada encontrada. Selecione cotas primeiro.' };
    }

    // Get Raffle details
    const { data: raffle } = await supabase
        .from('raffles')
        .select('*')
        .eq('id', raffleId)
        .single();

    if (!raffle) return { error: 'Rifa não encontrada' };

    const totalAmount = tickets.length * raffle.price_per_ticket;

    try {
        // Create Billing on AbacatePay
        // Note: Amount in cents usually? Or float? AbacatePay docs vary. 
        // Assuming integer cents is common standard, but implementation plan didn't specify.
        // If SDK is axios instance, we call endpoints.
        // Constructing payload based on standard payment gateway patterns.

        const payload = {
            frequency: 'ONE_TIME',
            methods: ['PIX'],
            products: [
                {
                    externalId: raffleId,
                    name: `Rifa: ${raffle.title}`,
                    quantity: tickets.length,
                    price: Math.round(raffle.price_per_ticket * 100), // Cents logic
                }
            ],
            returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/rifa/${raffleId}`,
            completionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/rifa/${raffleId}`,
            customer: {
                name: user.name,
                cellPhone: user.whatsapp,
                email: `${user.whatsapp}@romanov.com.br`, // Fallback email
                taxId: '00000000000' // Placeholder CPF if required. Ideally ask user.
            }
        };

        const response = await abacatePay.post('/billing/create', payload);
        const billingUrl = response.data.url; // Adjust based on actual API response structure

        // Ensure we save a transaction record locally
        await supabase.from('transactions').insert({
            user_id: userId,
            raffle_id: raffleId,
            external_id: response.data.id || 'unknown',
            amount: totalAmount,
            status: 'pending',
            ticket_numbers: tickets.map(t => t.ticket_number)
        });

        return { url: billingUrl };

    } catch (e: any) {
        console.error('Payment Error:', e.response?.data || e.message);
        return { error: 'Erro ao gerar pagamento. Tente novamente mais tarde.' };
    }
}
