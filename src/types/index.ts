export type RaffleStatus = 'active' | 'closed' | 'cancelled';
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
    created_at: string;
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
