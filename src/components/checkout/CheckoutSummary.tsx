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
        <div className="bg-white p-6 rounded-lg shadow max-w-md mx-auto mt-10">
            <h1 className="text-2xl font-bold mb-4">Resumo do Pedido</h1>
            <div className="border-b pb-4 mb-4">
                <h2 className="font-semibold">{raffle.title}</h2>
                <p className="text-sm text-gray-600">{raffle.description}</p>
            </div>

            <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase">Cotas Reservadas</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                    {tickets.map((t: any) => (
                        <span key={t.id} className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded">
                            {t.ticket_number}
                        </span>
                    ))}
                </div>
            </div>

            <div className="flex justify-between items-center text-lg font-bold mb-6">
                <span>Total</span>
                <span className="text-green-600">R$ {total.toFixed(2)}</span>
            </div>

            <Button onClick={handlePayment} disabled={isPending} className="w-full h-12 text-lg">
                {isPending ? 'Gerando PIX...' : 'Pagar Agora (PIX)'}
            </Button>
        </div>
    );
}
