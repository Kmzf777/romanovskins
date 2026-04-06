'use client';
import { TicketGrid } from './TicketGrid';
import { useCartStore } from '@/store/cart-store';
import { Button } from '@/components/ui/button';
import { reserveTicketsAction } from '@/server/raffle-actions';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function RaffleDetailClient({ raffle, tickets, userId }: any) {
    const { selectedNumbers, clearCart } = useCartStore();
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    // Calcular progresso
    const sold = tickets.filter((t: any) => t.status !== 'available').length;
    const soldPercent = raffle.total_numbers > 0
        ? Math.round((sold / raffle.total_numbers) * 100)
        : 0;
    const progressColor =
        soldPercent >= 80 ? 'bg-red-500' :
        soldPercent >= 50 ? 'bg-yellow-500' :
        'bg-green-500';

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
                toast.error(result.error || 'Erro ao reservar cotas.');
                router.refresh();
            }
        });
    };

    return (
        <div className="pb-24">
            <div className="mb-6 bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-lg shadow-sm">
                <div className="aspect-square relative mb-4 rounded-lg overflow-hidden bg-zinc-900/50 max-w-md mx-auto">
                    <img src={raffle.image_url} alt={raffle.title} className="w-full h-full object-cover" />
                </div>
                <h1 className="text-3xl font-bold text-white">{raffle.title}</h1>
                <p className="text-zinc-400 mt-2">{raffle.description}</p>
                <div className="mt-4 flex items-center gap-4">
                    <span className="text-2xl font-bold text-green-500">R$ {raffle.price_per_ticket.toFixed(2)}</span>
                    <span className="text-sm text-zinc-500">por cota</span>
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                    <div className="flex justify-between text-xs text-zinc-500 mb-1">
                        <span>{sold} de {raffle.total_numbers} cotas vendidas</span>
                        <span>{soldPercent}%</span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                            style={{ width: `${soldPercent}%` }}
                        />
                    </div>
                </div>
            </div>

            <div className="bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-lg shadow-sm">
                <h2 className="text-xl font-semibold mb-4 text-white">Escolha seus números</h2>
                <TicketGrid tickets={tickets} raffleId={raffle.id} userId={userId} />
            </div>

            {selectedNumbers.length > 0 && (
                <div className="fixed bottom-0 left-0 w-full bg-zinc-900/90 backdrop-blur-xl border-t border-white/10 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.5)] flex justify-between items-center z-50 px-4 md:px-8">
                    <div>
                        <p className="font-bold text-lg text-white">{selectedNumbers.length} cota(s)</p>
                        <p className="text-sm text-zinc-400">Total: R$ {(selectedNumbers.length * raffle.price_per_ticket).toFixed(2)}</p>
                    </div>
                    <Button onClick={handleReserve} disabled={isPending} size="lg" className="bg-green-600 hover:bg-green-700 text-white border-0">
                        {isPending ? 'Reservando...' : 'Reservar Agora'}
                    </Button>
                </div>
            )}
        </div>
    );
}
