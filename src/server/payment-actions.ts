'use server';

import { abacatePay } from '@/lib/abacatepay';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function createCheckoutAction(raffleId: string) {
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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://romanovdasrifas.vercel.app';

    try {
        // Formatar telefone para padrão E.164 (remover caracteres especiais)
        const formattedPhone = user.whatsapp.replace(/\D/g, '');

        const payload = {
            frequency: 'ONE_TIME',
            methods: ['PIX'],
            products: [
                {
                    externalId: raffleId,
                    name: `Rifa: ${raffle.title}`,
                    quantity: tickets.length,
                    price: Math.round(raffle.price_per_ticket * 100), // Valor em centavos
                }
            ],
            returnUrl: `${appUrl}/rifa/${raffleId}`,
            completionUrl: `${appUrl}/rifa/${raffleId}?success=true`,
            customer: {
                name: user.name,
                cellPhone: formattedPhone,
                email: `${formattedPhone}@romanov.com.br`,
                taxId: '00000000000'
            }
        };

        console.log('📤 Creating billing:', JSON.stringify(payload, null, 2));

        const response = await abacatePay.post('/billing/create', payload);

        console.log('📥 AbacatePay response:', JSON.stringify(response.data, null, 2));

        // A resposta pode ter diferentes estruturas dependendo da versão da API
        const billingData = response.data.data || response.data;
        const billingId = billingData.id || billingData.billing?.id;
        const billingUrl = billingData.url || billingData.billing?.url || billingData.payment_url;

        if (!billingUrl) {
            console.error('❌ No billing URL in response:', response.data);
            return { error: 'Erro ao obter link de pagamento. Tente novamente.' };
        }

        // Salvar transação no banco
        const { error: insertError } = await supabase.from('transactions').insert({
            user_id: userId,
            raffle_id: raffleId,
            external_id: billingId || 'unknown',
            amount: totalAmount,
            status: 'pending',
            ticket_numbers: tickets.map(t => t.ticket_number)
        });

        if (insertError) {
            console.error('❌ Error saving transaction:', insertError);
        }

        return { url: billingUrl };

    } catch (e: any) {
        console.error('❌ Payment Error:', e.response?.data || e.message);

        // Retornar mensagem de erro mais específica se disponível
        const errorMessage = e.response?.data?.error?.message
            || e.response?.data?.message
            || 'Erro ao gerar pagamento. Tente novamente mais tarde.';

        return { error: errorMessage };
    }
}
