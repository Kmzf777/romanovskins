'use client';
import { TicketGrid } from './TicketGrid';
import { useCartStore } from '@/store/cart-store';
import { Button } from '@/components/ui/button';
import { reserveTicketsAction } from '@/server/raffle-actions';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function RaffleDetailClient({ raffle, tickets, userId }: any) {
    const { selectedNumbers, clearCart } = useCartStore();
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleReserve = () => {
        if (!userId) {
            router.push(`/login?next=/rifa/${raffle.id}`);
            return;
        }
        startTransition(async () => {
            const result = await reserveTicketsAction(raffle.id, selectedNumbers);
            if (result.success) {
                clearCart();
                router.push(`/checkout/${raffle.id}`);
            } else {
                alert(result.error);
                router.refresh();
            }
        });
    };

    return (
        <div className="pb-24">
            <div className="mb-6 bg-white p-6 rounded-lg shadow-sm">
                <div className="h-64 relative mb-4 rounded-lg overflow-hidden bg-gray-100">
                    <img src={raffle.image_url} alt={raffle.title} className="w-full h-full object-cover" />
                </div>
                <h1 className="text-3xl font-bold">{raffle.title}</h1>
                <p className="text-gray-600 mt-2">{raffle.description}</p>
                <div className="mt-4 flex items-center gap-4">
                    <span className="text-2xl font-bold text-green-600">R$ {raffle.price_per_ticket.toFixed(2)}</span>
                    <span className="text-sm text-gray-500">por cota</span>
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm">
                <h2 className="text-xl font-semibold mb-4">Escolha seus números</h2>
                <TicketGrid tickets={tickets} raffleId={raffle.id} userId={userId} />
            </div>

            {selectedNumbers.length > 0 && (
                <div className="fixed bottom-0 left-0 w-full bg-white border-t p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex justify-between items-center z-50 px-4 md:px-8">
                    <div>
                        <p className="font-bold text-lg">{selectedNumbers.length} cota(s)</p>
                        <p className="text-sm text-gray-500">Total: R$ {(selectedNumbers.length * raffle.price_per_ticket).toFixed(2)}</p>
                    </div>
                    <Button onClick={handleReserve} disabled={isPending} size="lg" className="bg-green-600 hover:bg-green-700">
                        {isPending ? 'Reservando...' : 'Reservar Agora'}
                    </Button>
                </div>
            )}
        </div>
    );
}
