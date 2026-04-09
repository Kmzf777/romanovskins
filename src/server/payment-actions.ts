'use server';

import { abacatePay } from '@/lib/abacatepay';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

export async function createCheckoutAction(raffleId: string) {
    const supabase = await createClient();
    const { getCurrentUser } = await import('@/server/auth-actions');
    const currentUser = await getCurrentUser();
    if (!currentUser) return { error: 'Usuário não autenticado' };
    const userId = currentUser.id;
    const user = currentUser;

    const { data: tickets } = await supabase
        .from('tickets')
        .select('*')
        .eq('raffle_id', raffleId)
        .eq('user_id', userId)
        .eq('status', 'reserved');

    if (!tickets || tickets.length === 0) {
        return { error: 'Nenhuma cota reservada encontrada. Selecione cotas primeiro.' };
    }

    const { data: raffle } = await supabase
        .from('raffles')
        .select('*')
        .eq('id', raffleId)
        .single();

    if (!raffle) return { error: 'Rifa não encontrada' };

    const totalAmount = tickets.length * raffle.price_per_ticket;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://romanovdasrifas.vercel.app';

    // Gerar ID da transação ANTES do POST para poder incluir na returnUrl
    const transactionId = crypto.randomUUID();

    try {
        if (!user.whatsapp) {
            return { error: 'Número de WhatsApp não cadastrado.' };
        }

        const phoneDigits = user.whatsapp.replace(/\D/g, '');

        const payload = {
            frequency: 'ONE_TIME',
            methods: ['PIX'],
            products: [
                {
                    externalId: raffleId,
                    name: `Rifa: ${raffle.title}`,
                    quantity: tickets.length,
                    price: Math.round(raffle.price_per_ticket * 100),
                }
            ],
            returnUrl: `${appUrl}/checkout/success?tid=${transactionId}`,
            completionUrl: `${appUrl}/checkout/success?tid=${transactionId}`,
            customer: {
                name: user.name,
                cellphone: phoneDigits,
                email: `user${phoneDigits}@romanovrifas.com`,
                taxId: '529.982.247-25'
            }
        };

        console.log('📤 Creating billing:', JSON.stringify(payload, null, 2));

        const response = await abacatePay.post('/billing/create', payload);

        console.log('📥 AbacatePay full response:', JSON.stringify(response.data, null, 2));

        const billingData = response.data?.data ?? response.data;

        // Try all known field paths for billing ID
        const billingId: string | undefined =
          billingData?.id ??
          billingData?.billing?.id ??
          billingData?.billingId ??
          response.data?.id;

        // Try all known field paths for payment URL
        const billingUrl: string | undefined =
          billingData?.url ??
          billingData?.billing?.url ??
          billingData?.payment_url ??
          billingData?.checkoutUrl;

        if (!billingId) {
          console.error('❌ Could not extract billingId from response:', JSON.stringify(response.data, null, 2));
          return { error: 'Erro ao processar resposta do pagamento. Contate o suporte.' };
        }

        if (!billingUrl) {
          console.error('❌ No billing URL in response:', JSON.stringify(response.data, null, 2));
          return { error: 'Erro ao obter link de pagamento. Tente novamente.' };
        }

        // Salvar transação com o ID pré-gerado
        const { error: insertError } = await supabase.from('transactions').insert({
            id: transactionId,
            user_id: userId,
            raffle_id: raffleId,
            external_id: billingId,
            amount: totalAmount,
            status: 'pending',
            ticket_numbers: tickets.map(t => t.ticket_number)
        });

        if (insertError) {
            console.error('❌ Error saving transaction:', insertError);
            return { error: 'Erro ao salvar transação.' };
        }

        return { url: billingUrl };

    } catch (e: any) {
        console.error('❌ Payment Error:', e.response?.data || e.message);
        const errorMessage = e.response?.data?.error?.message
            || e.response?.data?.message
            || 'Erro ao gerar pagamento. Tente novamente mais tarde.';
        return { error: errorMessage };
    }
}
