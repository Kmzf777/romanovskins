'use client';
import { TicketGrid } from './TicketGrid';
import { useCartStore } from '@/store/cart-store';
import { Button } from '@/components/ui/button';
import { reserveTicketsAction } from '@/server/raffle-actions';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, Ticket } from 'lucide-react';

export function RaffleDetailClient({ raffle, tickets, userId }: any) {
    const { selectedNumbers, clearCart } = useCartStore();
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const sold = tickets.filter((t: any) => t.status !== 'available').length;
    const soldPercent = raffle.total_numbers > 0
        ? Math.round((sold / raffle.total_numbers) * 100)
        : 0;
    const isUrgent = soldPercent >= 80;
    const progressColor = isUrgent ? '#E63946' : soldPercent >= 50 ? '#F5C518' : '#2DC653';

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

    const totalPrice = (selectedNumbers.length * raffle.price_per_ticket).toFixed(2).replace('.', ',');

    return (
        <div className="pb-32 relative z-10">
            {/* Breadcrumb */}
            <div className="py-4 mb-6">
                <Link
                    href="/"
                    className="inline-flex items-center gap-1 text-sm transition-colors hover:text-white"
                    style={{ color: '#7A7A8A' }}
                >
                    <ChevronLeft size={14} /> Voltar às rifas
                </Link>
            </div>

            {/* Main layout */}
            <div className="flex flex-col lg:flex-row gap-8">
                {/* Left: Image */}
                <div className="lg:w-96 shrink-0">
                    <div
                        className="rounded-2xl overflow-hidden aspect-square relative"
                        style={{ backgroundColor: '#111114', border: '1px solid #2A2A32' }}
                    >
                        <Image
                            src={raffle.image_url}
                            alt={raffle.title}
                            fill
                            className="object-cover"
                            sizes="(max-width: 1024px) 100vw, 384px"
                            style={{ filter: 'drop-shadow(0 0 30px rgba(245,197,24,0.2))' }}
                            priority
                        />
                        {/* Badges */}
                        <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
                            {raffle.wear_condition && (
                                <span
                                    className="px-2 py-1 rounded text-xs font-bold uppercase"
                                    style={{
                                        backgroundColor: 'rgba(10,10,11,0.85)',
                                        color: '#F5C518',
                                        border: '1px solid rgba(245,197,24,0.3)',
                                    }}
                                >
                                    {raffle.wear_condition}
                                </span>
                            )}
                            {raffle.float_value && (
                                <span
                                    className="px-2 py-1 rounded text-xs font-mono"
                                    style={{
                                        backgroundColor: 'rgba(10,10,11,0.85)',
                                        color: '#7A7A8A',
                                        border: '1px solid #2A2A32',
                                    }}
                                >
                                    {raffle.float_value}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Info + CTA */}
                <div className="flex-1 space-y-6">
                    <div>
                        <h1
                            className="leading-tight"
                            style={{
                                fontFamily: 'var(--font-bebas-neue)',
                                fontSize: 'clamp(32px, 4vw, 52px)',
                                color: '#F0EAD6',
                            }}
                        >
                            {raffle.title}
                        </h1>
                        {raffle.description && (
                            <p className="mt-2 text-sm leading-relaxed" style={{ color: '#7A7A8A' }}>
                                {raffle.description}
                            </p>
                        )}
                    </div>

                    {/* Price */}
                    <div className="flex items-baseline gap-3">
                        <span
                            className="text-5xl font-black"
                            style={{ fontFamily: 'var(--font-bebas-neue)', color: '#F5C518' }}
                        >
                            R$ {raffle.price_per_ticket.toFixed(2).replace('.', ',')}
                        </span>
                        <span className="text-sm" style={{ color: '#7A7A8A' }}>por cota</span>
                    </div>

                    {/* Progress */}
                    <div
                        className="p-4 rounded-xl space-y-3"
                        style={{ backgroundColor: '#111114', border: '1px solid #2A2A32' }}
                    >
                        <div className="flex justify-between text-xs" style={{ color: '#7A7A8A', fontFamily: 'var(--font-geist-mono)' }}>
                            <span>{sold} de {raffle.total_numbers} cotas vendidas</span>
                            <span style={{ color: isUrgent ? '#E63946' : '#7A7A8A' }}>{soldPercent}%</span>
                        </div>
                        <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: '#2A2A32' }}>
                            <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${soldPercent}%`, backgroundColor: progressColor }}
                            />
                        </div>
                        {isUrgent && (
                            <p className="text-xs font-bold" style={{ color: '#E63946' }}>
                                ⚡ Poucas cotas restantes!
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Ticket Grid */}
            <div
                className="mt-10 p-6 rounded-2xl"
                style={{ backgroundColor: '#111114', border: '1px solid #2A2A32' }}
            >
                <h2
                    className="mb-6"
                    style={{ fontFamily: 'var(--font-bebas-neue)', fontSize: '28px', color: '#F0EAD6' }}
                >
                    ESCOLHA SEUS NÚMEROS
                </h2>
                <div className="flex flex-wrap gap-2 text-xs mb-4">
                    {[
                        { color: '#2DC653', label: 'Disponível' },
                        { color: '#F5C518', label: 'Selecionado' },
                        { color: '#4A4A5A', label: 'Vendido' },
                    ].map(item => (
                        <div key={item.label} className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
                            <span style={{ color: '#7A7A8A' }}>{item.label}</span>
                        </div>
                    ))}
                </div>
                <TicketGrid tickets={tickets} raffleId={raffle.id} userId={userId} />
            </div>

            {/* Sticky CTA */}
            {selectedNumbers.length > 0 && (
                <div
                    className="fixed bottom-0 left-0 w-full flex items-center justify-between gap-4 px-6 py-4 z-[9999]"
                    style={{
                        backgroundColor: 'rgba(10,10,11,0.95)',
                        backdropFilter: 'blur(16px)',
                        borderTop: '1px solid #2A2A32',
                        pointerEvents: 'auto',
                    }}
                >
                    <div>
                        <p className="text-lg font-black" style={{ color: '#F0EAD6' }}>
                            {selectedNumbers.length} cota{selectedNumbers.length > 1 ? 's' : ''}
                        </p>
                        <p
                            className="text-sm"
                            style={{ fontFamily: 'var(--font-geist-mono)', color: '#F5C518' }}
                        >
                            R$ {totalPrice}
                        </p>
                    </div>
                    <Button
                        onClick={handleReserve}
                        disabled={isPending}
                        className="flex items-center gap-2 h-12 px-8 font-black uppercase tracking-wider rounded-xl"
                        style={{
                            backgroundColor: '#F5C518',
                            color: '#0A0A0B',
                            boxShadow: '0 0 20px rgba(245,197,24,0.3)',
                        }}
                    >
                        {isPending ? 'Reservando...' : 'Reservar Agora'}
                        <Ticket size={18} />
                    </Button>
                </div>
            )}
        </div>
    );
}
