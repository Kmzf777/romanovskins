'use client';

import { createCheckoutAction } from '@/server/payment-actions';
import { Button } from '@/components/ui/button';
import { useTransition } from 'react';

export function CheckoutSummary({ raffle, tickets }: any) {
    const [isPending, startTransition] = useTransition();

    const handlePayment = () => {
        startTransition(async () => {
            const res = await createCheckoutAction(raffle.id);
            if (res.error) {
                alert(res.error);
            } else if (res.url) {
                window.location.href = res.url;
            }
        });
    };

    const total = tickets.length * raffle.price_per_ticket;

    return (

        <div className="max-w-md mx-auto mt-10">
            <h1 className="text-2xl font-bold mb-4 text-white">Resumo do Pedido</h1>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-sm text-white">
                <div className="border-b border-zinc-800 pb-4 mb-4">
                    <h2 className="font-semibold text-lg">{raffle.title}</h2>
                    <p className="text-sm text-zinc-400">{raffle.description}</p>
                </div>

                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-zinc-500 uppercase">Cotas Reservadas</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {tickets.map((t: any) => (
                            <span key={t.id} className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-xs font-bold px-2 py-1 rounded">
                                {t.ticket_number}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="flex justify-between items-center text-lg font-bold mb-6">
                    <span>Total</span>
                    <span className="text-green-500">R$ {total.toFixed(2)}</span>
                </div>

                <Button onClick={handlePayment} disabled={isPending} className="w-full h-12 text-lg font-bold uppercase tracking-wide">
                    {isPending ? 'Gerando PIX...' : 'Pagar Agora (PIX)'}
                </Button>
            </div>
        </div>
    );

}
