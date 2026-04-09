'use client';

import { createCheckoutAction } from '@/server/payment-actions';
import { useTransition, useState } from 'react';
import { toast } from 'sonner';
import { CountdownTimer } from './CountdownTimer';
import { Ticket } from 'lucide-react';

function formatCpf(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    return digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function CheckoutSummary({ raffle, tickets, expiresAt }: any) {
    const [isPending, startTransition] = useTransition();
    const [cpf, setCpf] = useState('');

    const handlePayment = () => {
        const digits = cpf.replace(/\D/g, '');
        if (digits.length !== 11) {
            toast.error('Informe um CPF válido (11 dígitos).');
            return;
        }
        startTransition(async () => {
            const res = await createCheckoutAction(raffle.id, digits);
            if (res.error) { toast.error(res.error); }
            else if (res.url) { window.location.href = res.url; }
        });
    };

    const total = (tickets.length * raffle.price_per_ticket).toFixed(2).replace('.', ',');

    return (
        <div className="max-w-md mx-auto py-10 px-4 relative z-10">
            <h1
                className="mb-6"
                style={{ fontFamily: 'var(--font-bebas-neue)', fontSize: '40px', color: '#F0EAD6' }}
            >
                RESUMO DO PEDIDO
            </h1>

            <CountdownTimer expiresAt={expiresAt} raffleId={raffle.id} />

            <div
                className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: '#111114', border: '1px solid #2A2A32' }}
            >
                {/* Raffle header */}
                <div
                    className="p-6"
                    style={{ borderBottom: '1px solid #2A2A32' }}
                >
                    <h2 className="font-bold text-lg leading-tight" style={{ color: '#F0EAD6' }}>
                        {raffle.title}
                    </h2>
                    {raffle.description && (
                        <p className="text-sm mt-1" style={{ color: '#7A7A8A' }}>
                            {raffle.description}
                        </p>
                    )}
                </div>

                {/* Tickets */}
                <div className="p-6" style={{ borderBottom: '1px solid #2A2A32' }}>
                    <p className="text-xs uppercase tracking-widest mb-3 font-bold" style={{ color: '#4A4A5A' }}>
                        Cotas Reservadas
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {tickets.map((t: any) => (
                            <span
                                key={t.id}
                                className="text-xs font-bold px-2.5 py-1.5 rounded-lg"
                                style={{
                                    fontFamily: 'var(--font-geist-mono)',
                                    backgroundColor: 'rgba(245,197,24,0.1)',
                                    color: '#F5C518',
                                    border: '1px solid rgba(245,197,24,0.2)',
                                }}
                            >
                                #{t.ticket_number}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Total */}
                <div className="p-6 flex items-center justify-between" style={{ borderBottom: '1px solid #2A2A32' }}>
                    <span className="font-bold" style={{ color: '#7A7A8A' }}>Total</span>
                    <span
                        className="text-3xl font-black"
                        style={{ fontFamily: 'var(--font-bebas-neue)', color: '#2DC653' }}
                    >
                        R$ {total}
                    </span>
                </div>

                {/* CPF */}
                <div className="p-6" style={{ borderBottom: '1px solid #2A2A32' }}>
                    <label className="block text-xs uppercase tracking-widest font-bold mb-2" style={{ color: '#4A4A5A' }}>
                        CPF do Comprador
                    </label>
                    <input
                        type="text"
                        inputMode="numeric"
                        placeholder="000.000.000-00"
                        value={cpf}
                        onChange={e => setCpf(formatCpf(e.target.value))}
                        disabled={isPending}
                        maxLength={14}
                        className="w-full h-11 rounded-xl px-4 text-sm font-medium outline-none focus:ring-2 disabled:opacity-50"
                        style={{
                            backgroundColor: '#1A1A1E',
                            border: '1px solid #2A2A32',
                            color: '#F0EAD6',
                        }}
                    />
                    <p className="text-xs mt-1" style={{ color: '#4A4A5A' }}>
                        Exigido pela plataforma de pagamento
                    </p>
                </div>

                {/* CTA */}
                <div className="p-6">
                    <button
                        onClick={handlePayment}
                        disabled={isPending}
                        className="w-full h-14 rounded-xl font-black uppercase tracking-widest text-base flex items-center justify-center gap-3 transition-all hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{
                            backgroundColor: '#F5C518',
                            color: '#0A0A0B',
                            boxShadow: '0 0 30px rgba(245,197,24,0.25)',
                        }}
                    >
                        {isPending ? 'Gerando PIX...' : (
                            <>
                                Pagar via PIX <Ticket size={20} />
                            </>
                        )}
                    </button>
                    <p className="text-center text-xs mt-3" style={{ color: '#4A4A5A' }}>
                        Confirmação instantânea · Entrega garantida
                    </p>
                </div>
            </div>
        </div>
    );
}
