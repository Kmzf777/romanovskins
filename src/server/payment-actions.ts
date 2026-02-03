'use server';

import { abacatePay } from '@/lib/abacatepay';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

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
        // Validar se o WhatsApp está cadastrado
        if (!user.whatsapp) {
            return { error: 'Número de WhatsApp não cadastrado. Por favor, atualize seu perfil.' };
        }

        // Extrair apenas os dígitos do telefone (formato esperado pela AbacatePay)
        const phoneDigits = user.whatsapp.replace(/\D/g, '');

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
            returnUrl: `${appUrl}/checkout/success`,
            completionUrl: `${appUrl}/checkout/success`,
            customer: {
                name: user.name,
                cellphone: phoneDigits,
                email: `user${phoneDigits}@romanovrifas.com`,
                taxId: '529.982.247-25'  // CPF válido para dev mode
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
        const { data: transaction, error: insertError } = await supabase.from('transactions').insert({
            user_id: userId,
            raffle_id: raffleId,
            external_id: billingId || 'unknown',
            amount: totalAmount,
            status: 'pending',
            ticket_numbers: tickets.map(t => t.ticket_number)
        }).select().single();

        if (insertError) {
            console.error('❌ Error saving transaction:', insertError);
            return { error: 'Erro ao salvar transação.' };
        }

        // Se tivermos a URL de pagamento, mas não conseguimos atualizar a URL de retorno na criação (limitação da API), 
        // o ideal seria que a API aceitasse, mas aqui vamos assumir que o fluxo vai depender do ID estar na sessão ou pegarmos o último.
        // POREM, a melhor prática é tentar incluir na URL se a API permitir update ou se criarmos com ela.
        // Como já criamos o payload antes do ID... vamos fazer diferente:
        // O ID do billing já foi criado. 

        // CORREÇÃO: O payload é enviado ANTES. Precisamos atualizar a URL ou assumir que o parametro será passado de outra forma. 
        // Mas espere, o payload é enviado no POST. Posso gerar um ID UUID antes? 
        // Supabase gera ID.
        // Vamos tentar pegar o ID do insert e atualizar a transaction se possível, mas o link já foi gerado no 'billing/create'.
        // AbacatePay permite atualizar? Talvez não.

        // Alternativa: O user vai para o billingUrl. Quando ele volta, ele volta para cadastrado no payload `returnUrl`.
        // A `returnUrl` no payload estava constante. 
        // Precisamos gerar o ID da transação *antes* ou aceitar que a success page busque a "última transação do usuário".
        // Buscar a última transação do usuário é mais fácil e seguro dado o fluxo atual.

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
