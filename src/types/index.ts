export type RaffleStatus = 'active' | 'closed' | 'drawn' | 'cancelled';
export type TicketStatus = 'available' | 'reserved' | 'sold';

export interface User {
    id: string;
    name: string;
    whatsapp: string;
    created_at: string;
}

export interface Raffle {
    id: string;
    title: string;
    description: string | null;
    image_url: string;
    price_per_ticket: number;
    total_numbers: number;
    status: RaffleStatus;
    winner_number: number | null;
    winner_ticket_number: number | null;
    winner_user_id: string | null;
    drawn_at: string | null;
    float_value: string | null;
    wear_condition: string | null;
    featured: boolean;
    original_price: number | null;
    created_at: string;
    // Computed by getRaffles()
    available_count?: number;
    sold_count?: number;
}

export interface Ticket {
    id: number;
    raffle_id: string;
    ticket_number: number;
    status: TicketStatus;
    user_id: string | null;
    reserved_at: string | null;
    expires_at: string | null;
}

export interface Transaction {
    id: string;
    user_id: string;
    raffle_id: string;
    external_id: string | null;
    amount: number;
    status: 'pending' | 'paid' | 'failed';
    ticket_numbers: number[];
    created_at: string;
}

export interface AdminStats {
    totalRaffles: number;
    activeRaffles: number;
    soldTickets: number;
    totalRevenue: number;
    totalUsers: number;
}

export interface Winner {
    id: string;
    name: string;
    raffle_title: string;
    raffle_image: string;
    ticket_number: number;
    draw_date: string;
}
