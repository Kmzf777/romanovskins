'use client';

import { useCartStore } from '@/store/cart-store';
import { Ticket } from '@/types';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

interface TicketGridProps {
    tickets: Ticket[];
    raffleId: string;
    userId?: string;
}

export function TicketGrid({ tickets, raffleId, userId }: TicketGridProps) {
    const { selectedNumbers, toggleNumber, setRaffleId, raffleId: storeRaffleId } = useCartStore();

    useEffect(() => {
        // Sync store with current raffle page
        setRaffleId(raffleId);
    }, [raffleId, setRaffleId]);

    return (
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
            {tickets.map((ticket) => {
                const isReservedOrSold = ticket.status !== 'available';
                const isMyReservation = isReservedOrSold && ticket.user_id === userId;
                const isSelected = selectedNumbers.includes(ticket.ticket_number);

                // Determine visual state
                // 1. Reserved by me -> Yellow
                // 2. Sold/Reserved by others -> Red (Disabled)
                // 3. Available:
                //    - Selected -> Green
                //    - Default -> Slate

                let bgClass = 'bg-white/5 hover:bg-white/10 text-white cursor-pointer'; // Default
                let disabled = false;

                if (isMyReservation) {
                    bgClass = 'bg-yellow-400 text-black cursor-default';
                    disabled = true;
                } else if (isReservedOrSold) {
                    bgClass = 'bg-red-500 text-white opacity-50 cursor-not-allowed';
                    disabled = true;
                } else if (isSelected) {
                    bgClass = 'bg-green-500 text-white hover:bg-green-600';
                }

                return (
                    <button
                        key={ticket.id}
                        onClick={() => !disabled && toggleNumber(ticket.ticket_number)}
                        disabled={disabled}
                        className={cn(
                            "h-10 w-full rounded-md text-xs font-bold transition-colors flex items-center justify-center",
                            bgClass
                        )}
                    >
                        {ticket.ticket_number}
                    </button>
                );
            })}
        </div>
    );
}
