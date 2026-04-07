'use client';

import Link from 'next/link';
import { Raffle } from '@/types';

interface TicketCardProps {
    raffle: Raffle;
}

export function TicketCard({ raffle }: TicketCardProps) {
    const sold = raffle.sold_count ?? 0;
    const total = raffle.total_numbers;
    const available = raffle.available_count ?? total;
    const soldPercent = total > 0 ? Math.round((sold / total) * 100) : 0;

    const discount = raffle.original_price && raffle.original_price > 0
        ? Math.round((1 - raffle.price_per_ticket / raffle.original_price) * 100)
        : null;

    const isUrgent = soldPercent >= 80;
    const progressColor = isUrgent ? '#E63946' : soldPercent >= 50 ? '#F5C518' : '#2DC653';

    return (
        <Link
            href={`/rifa/${raffle.id}`}
            className="group block rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-yellow-500"
            style={{
                backgroundColor: '#111114',
                border: '1px solid #2A2A32',
            }}
            onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = '#F5C518';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(245,197,24,0.15)';
            }}
            onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = '#2A2A32';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
        >
            {/* Image */}
            <div className="relative aspect-square overflow-hidden">
                <img
                    src={raffle.image_url}
                    alt={raffle.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div
                    className="absolute bottom-0 left-0 right-0 h-1/2 pointer-events-none"
                    style={{ background: 'linear-gradient(to top, #111114, transparent)' }}
                />
                {/* Badges */}
                <div className="absolute top-2 left-2 right-2 flex justify-between">
                    {raffle.float_value && (
                        <span
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                            style={{
                                backgroundColor: 'rgba(10,10,11,0.8)',
                                color: '#7A7A8A',
                                border: '1px solid #2A2A32',
                                backdropFilter: 'blur(4px)',
                            }}
                        >
                            {raffle.float_value}
                        </span>
                    )}
                    {raffle.wear_condition && (
                        <span
                            className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ml-auto"
                            style={{
                                backgroundColor: 'rgba(10,10,11,0.8)',
                                color: '#F5C518',
                                border: '1px solid rgba(245,197,24,0.3)',
                                backdropFilter: 'blur(4px)',
                            }}
                        >
                            {raffle.wear_condition}
                        </span>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                    <h3
                        className="text-sm font-bold leading-tight line-clamp-2 flex-1"
                        style={{ color: '#F0EAD6' }}
                    >
                        {raffle.title}
                    </h3>
                    {discount && (
                        <span
                            className="text-[10px] font-black px-1.5 py-0.5 rounded shrink-0"
                            style={{ backgroundColor: '#E63946', color: '#fff' }}
                        >
                            -{discount}%
                        </span>
                    )}
                </div>

                <p
                    className="text-xl font-black"
                    style={{ fontFamily: 'var(--font-bebas-neue)', color: '#F5C518' }}
                >
                    R$ {raffle.price_per_ticket.toFixed(2).replace('.', ',')}
                    <span className="text-xs ml-1" style={{ color: '#7A7A8A', fontFamily: 'var(--font-space-grotesk)' }}>
                        / cota
                    </span>
                </p>

                <div className="space-y-1">
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#2A2A32' }}>
                        <div
                            className="h-full rounded-full"
                            style={{ width: `${soldPercent}%`, backgroundColor: progressColor, transition: 'width 0.5s ease' }}
                        />
                    </div>
                    <div
                        className="flex justify-between text-[10px]"
                        style={{ color: '#4A4A5A', fontFamily: 'var(--font-geist-mono)' }}
                    >
                        <span>{soldPercent}% vendido</span>
                        <span>{available} restantes</span>
                    </div>
                </div>

                <div
                    className="flex items-center justify-center w-full py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-300 group-hover:bg-yellow-500/20"
                    style={{
                        backgroundColor: 'rgba(245,197,24,0.08)',
                        border: '1px solid rgba(245,197,24,0.3)',
                        color: '#F5C518',
                    }}
                >
                    PARTICIPAR →
                </div>
            </div>
        </Link>
    );
}
