'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { cookies } from 'next/headers';

// MOCK DATA
const MOCK_RAFFLES = [
    {
        id: 'mock-1',
        title: '[DEMO] AK-47 | Redline',
        description: 'Rifa demonstrativa (Sem conexão com banco de dados)',
        image_url: 'https://steamcommunity-a.akamaihd.net/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpot7HxfDhjxszJemkV09-5lpKKqPv9NLPF2D4Ju5wg272W8Iqg21G2_xJvZD-lINKTcwA8aFvS_VK5k-y70J60vMicwSQ3vSAi4C7D30vgn-Jz0f4/360fx360f',
        price_per_ticket: 0.50,
        total_numbers: 100,
        status: 'active',
        created_at: new Date().toISOString()
    },
    {
        id: 'mock-2',
        title: '[DEMO] AWP | Asiimov',
        description: 'Esta rifa é apenas um exemplo visual.',
        image_url: 'https://steamcommunity-a.akamaihd.net/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpot621FAR17PLfYQJD_9W7m5a0mvLwOq7c2D1SvcN3ib6V89zz3gHt-xVuMD-mI4PBcAE9MlqC-lfqlO_o0JW0s87Lz3Jk6Sdz-z-DyPjCd1k/360fx360f',
        price_per_ticket: 2.00,
        total_numbers: 50,
        status: 'active',
        created_at: new Date().toISOString()
    }
];

const MOCK_PAST_RAFFLES = [
    {
        id: 'mock-past-1',
        title: '[ENCERRADO] Karambit | Fade',
        description: 'Sorteio realizado com sucesso!',
        image_url: 'https://steamcommunity-a.akamaihd.net/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpovbSsLwJf2b1+CE81492zkL-HnvD8J_WAz2lV7cAh3r2V8Nzz3QHt_hA4Ym2hLdKQIQM6ZwvS-ADqwua7g5S8v57MzXoyvyFw4WGdwUKYzhVpTg/360fx360f',
        price_per_ticket: 5.00,
        total_numbers: 200,
        status: 'drawn',
        winner_id: 'user-1',
        winner_ticket: 42,
        draw_date: new Date(Date.now() - 86400000).toISOString() // 1 day ago
    },
    {
        id: 'mock-past-2',
        title: '[ENCERRADO] M4A4 | Howl',
        description: 'O ganhador já recebeu o prêmio.',
        image_url: 'https://steamcommunity-a.akamaihd.net/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpou-6kejhz2v_Nfz5H_uO1gb-Gw_alIITfn3p-58xOh-zF_Jn4xlQxrUZqYGv2LI_Bd1RvYgnT_Fm6x-i818W8uJ_Pynp9-n10V_ixwEQ/360fx360f',
        price_per_ticket: 10.00,
        total_numbers: 1000,
        status: 'drawn',
        winner_id: 'user-2',
        winner_ticket: 777,
        draw_date: new Date(Date.now() - 172800000).toISOString() // 2 days ago
    }
];

const MOCK_WINNERS = [
    {
        id: 'win-1',
        name: 'Rafael Silva',
        raffle_title: 'Karambit | Fade',
        raffle_image: 'https://steamcommunity-a.akamaihd.net/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpovbSsLwJf2b1+CE81492zkL-HnvD8J_WAz2lV7cAh3r2V8Nzz3QHt_hA4Ym2hLdKQIQM6ZwvS-ADqwua7g5S8v57MzXoyvyFw4WGdwUKYzhVpTg/360fx360f',
        ticket_number: 42,
        draw_date: '02/02/2026'
    },
    {
        id: 'win-2',
        name: 'João Souza',
        raffle_title: 'M4A4 | Howl',
        raffle_image: 'https://steamcommunity-a.akamaihd.net/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpou-6kejhz2v_Nfz5H_uO1gb-Gw_alIITfn3p-58xOh-zF_Jn4xlQxrUZqYGv2LI_Bd1RvYgnT_Fm6x-i818W8uJ_Pynp9-n10V_ixwEQ/360fx360f',
        ticket_number: 777,
        draw_date: '01/02/2026'
    },
    {
        id: 'win-3',
        name: 'Maria Oliveira',
        raffle_title: 'Dragon Lore',
        raffle_image: 'https://steamcommunity-a.akamaihd.net/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpot621FAR17PLfYQJD_9W7m5a0mvLwOq7c2D1SvcN3ib6V89zz3gHt-xVuMD-mI4PBcAE9MlqC-lfqlO_o0JW0s87Lz3Jk6Sdz-z-DyPjCd1k/360fx360f',
        ticket_number: 123,
        draw_date: '30/01/2026'
    }
];

const checkEnv = () => {
    return !!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://your-project.supabase.co";
}

const createRaffleSchema = z.object({
    title: z.string().min(3, 'Título muito curto'),
    description: z.string().optional(),
    image_url: z.string().url('URL da imagem inválida'),
    price_per_ticket: z.number().min(0.01, 'Preço deve ser maior que 0'),
    total_numbers: z.number().int().min(1).max(100000, 'Máximo de 100.000 cotas'),
    float_value: z.string().optional(),
    wear_condition: z.string().optional(),
});

export async function createRaffleAction(prevState: any, formData: FormData) {
    if (!checkEnv()) return { error: 'Modo Demo: Alterações não salvas.' };

    const supabase = await createClient();

    // TODO: Add Admin Check here using cookie/middleware logic if needed for stricter security

    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const image_url = formData.get('image_url') as string;
    const price_per_ticket = parseFloat(formData.get('price_per_ticket') as string);
    const total_numbers = parseInt(formData.get('total_numbers') as string);
    const float_value = (formData.get('float_value') as string) || null;
    const wear_condition = (formData.get('wear_condition') as string) || null;

    const validation = createRaffleSchema.safeParse({
        title, description, image_url, price_per_ticket, total_numbers
    });

    if (!validation.success) {
        return { error: 'Dados inválidos. Verifique os campos.' };
    }

    // 1. Create Raffle
    const { data: raffle, error: raffleError } = await supabase
        .from('raffles')
        .insert({
            title,
            description,
            image_url,
            price_per_ticket,
            total_numbers,
            status: 'active',
            float_value: float_value || null,
            wear_condition: wear_condition || null,
        })
        .select()
        .single();

    if (raffleError || !raffle) {
        console.error('Error creating raffle:', raffleError);
        return { error: 'Erro ao criar rifa no banco de dados' };
    }

    // 2. Generate Tickets
    // For really large numbers, we might want to defer this or use a stored procedure.
    // But for < 10k, this is fine.
    const tickets = [];
    for (let i = 1; i <= total_numbers; i++) {
        tickets.push({
            raffle_id: raffle.id,
            ticket_number: i,
            status: 'available'
        });
    }

    // Batch insert
    const chunkSize = 5000;
    for (let i = 0; i < tickets.length; i += chunkSize) {
        const chunk = tickets.slice(i, i + chunkSize);
        const { error: ticketError } = await supabase
            .from('tickets')
            .insert(chunk);

        if (ticketError) {
            console.error('Error creating tickets chunk:', ticketError);
            // In a real app we'd rollback the raffle here
            return { error: 'Erro ao gerar cotas. Algumas cotas podem ter falhado.' };
        }
    }

    revalidatePath('/');
    redirect('/');
}

export async function getRaffles() {
    if (!checkEnv()) return MOCK_RAFFLES;

    const supabase = await createClient();
    const { data: raffles, error } = await supabase
        .from('raffles')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

    if (error || !raffles || raffles.length === 0) {
        if (error) console.error('Error fetching raffles:', error);
        return [];
    }

    // Buscar contagens reais de tickets por rifa
    const { data: counts } = await supabase.rpc('get_raffle_ticket_counts', {
        raffle_ids: raffles.map(r => r.id)
    });

    const countMap: Record<string, { available_count: number; sold_count: number }> = {};
    (counts || []).forEach((c: any) => {
        countMap[c.raffle_id] = {
            available_count: Number(c.available_count),
            sold_count: Number(c.sold_count)
        };
    });

    return raffles.map(r => ({
        ...r,
        available_count: countMap[r.id]?.available_count ?? r.total_numbers,
        sold_count: countMap[r.id]?.sold_count ?? 0,
    }));
}

export async function getRaffleDetails(id: string) {
    if (!checkEnv()) {
        return MOCK_RAFFLES.find(r => r.id === id) || null;
    }

    const supabase = await createClient();
    const { data, error } = await supabase
        .from('raffles')
        .select('*')
        .eq('id', id)
        .single();

    if (error) return null;
    return data;
}

export async function getRaffleTickets(raffleId: string) {
    if (!checkEnv()) {
        const raffle = MOCK_RAFFLES.find(r => r.id === raffleId);
        if (!raffle) return [];

        // Mock 100 tickets
        return Array.from({ length: raffle.total_numbers }).map((_, i) => ({
            id: i,
            raffle_id: raffleId,
            ticket_number: i + 1,
            status: 'available',
            user_id: null
        }));
    }

    const supabase = await createClient();
    const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('raffle_id', raffleId)
        .order('ticket_number', { ascending: true });

    if (error) return [];
    return data;
}

export async function reserveTicketsAction(raffleId: string, numbers: number[]) {
    if (!checkEnv()) {
        // Mock success
        return { success: true };
    }

    const supabase = createAdminClient();
    const cookieStore = await cookies();
    const userId = cookieStore.get('romanov_user')?.value;

    if (!userId) {
        return { success: false, error: 'Usuário não autenticado' };
    }

    const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString(); // +20 min

    // Atomic Update: Only update if status is available
    const { data, error } = await supabase
        .from('tickets')
        .update({
            status: 'reserved',
            user_id: userId,
            reserved_at: new Date().toISOString(),
            expires_at: expiresAt
        })
        .eq('raffle_id', raffleId)
        .in('ticket_number', numbers)
        .eq('status', 'available')
        .select();

    if (error) {
        console.error('Reservation error:', JSON.stringify(error, null, 2));
        console.error('Reservation details:', { raffleId, numbers, userId });
        return { success: false, error: `Erro ao tentar reservar cotas: ${error.message || 'Erro desconhecido'}` };
    }

    if (data.length !== numbers.length) {
        // Some tickets were effectively not reserved (race condition lost)
        // Rollback others? Or just keep what we got?
        // PRD says: "Aviso o usuário que alguns números já foram pegos".
        // To be safe/simple, we could enforce ALL or NOTHING, but pure SQL update handles what it can.
        // If we want all-or-nothing, we'd need a function or check count first, but that's not atomic.
        // Actually, if we want all-or-nothing, we can't easily do it with a single Update unless we use pgTAP or stored proc.
        // Let's accept partial reservation for now or fail if incomplete.
        // PRD: "Verifica se conseguiu reservar TODOS os números solicitados... return { success: false ... }"

        // If we want to be strict (fair to user):
        // Cancel the ones we just reserved to be clean?
        if (data.length > 0) {
            const reservedIds = data.map((t: any) => t.id);
            await supabase.from('tickets').update({ status: 'available', user_id: null, reserved_at: null, expires_at: null }).in('id', reservedIds);
        }
        return { success: false, error: 'Algumas cotas selecionadas já foram reservadas por outra pessoa. Tente novamente.' };
    }

    revalidatePath(`/rifa/${raffleId}`);
    return { success: true };
}

export async function getPastRaffles() {
    if (!checkEnv()) return MOCK_PAST_RAFFLES;

    const supabase = await createClient();
    const { data, error } = await supabase
        .from('raffles')
        .select('*, winner_user:users!winner_user_id ( name )')
        .in('status', ['closed', 'drawn'])
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching past raffles:', error);
        return [];
    }
    return data || [];
}

export async function getRecentWinners() {
    if (!checkEnv()) return MOCK_WINNERS;

    const supabase = await createClient();

    const { data, error } = await supabase
        .from('raffles')
        .select(`
            id,
            title,
            image_url,
            winner_ticket_number,
            drawn_at,
            winner_user:users!winner_user_id ( name )
        `)
        .eq('status', 'drawn')
        .not('winner_user_id', 'is', null)
        .order('drawn_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching winners:', error);
        return [];
    }

    return (data || []).map((r: any) => ({
        id: r.id,
        name: r.winner_user?.name ?? 'Desconhecido',
        raffle_title: r.title,
        raffle_image: r.image_url,
        ticket_number: r.winner_ticket_number,
        draw_date: r.drawn_at
            ? new Date(r.drawn_at).toLocaleDateString('pt-BR')
            : '',
    }));
}
