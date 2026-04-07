'use client';

import Link from 'next/link';
import { Star, Ticket } from 'lucide-react';
import { Raffle } from '@/types';

interface FeaturedRaffleCardProps {
    raffle: Raffle;
}

export function FeaturedRaffleCard({ raffle }: FeaturedRaffleCardProps) {
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
        <div
            className="relative overflow-hidden rounded-2xl animate-pulse-border transition-transform hover:scale-[1.01]"
            style={{ backgroundColor: '#111114', border: '1px solid #F5C518' }}
        >
            <div className="flex flex-col md:flex-row">
                {/* Image section */}
                <div className="relative md:w-96 aspect-square md:aspect-auto shrink-0 overflow-hidden">
                    <img
                        src={raffle.image_url}
                        alt={raffle.title}
                        className="w-full h-full object-cover animate-float-skin"
                        style={{ filter: 'drop-shadow(0 0 30px rgba(245,197,24,0.4))' }}
                    />
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(245,197,24,0.12) 0%, transparent 70%)',
                        }}
                    />
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            background: 'linear-gradient(to right, transparent 70%, #111114 100%)',
                        }}
                    />
                    {/* DESTAQUE badge */}
                    <div
                        className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider"
                        style={{ backgroundColor: '#F5C518', color: '#0A0A0B' }}
                    >
                        <Star size={11} fill="currentColor" /> DESTAQUE
                    </div>
                    {/* Wear + Float badges */}
                    <div className="absolute top-4 right-4 flex flex-col gap-1.5 items-end">
                        {raffle.wear_condition && (
                            <span
                                className="px-2 py-1 rounded text-xs font-bold uppercase tracking-wider"
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
                        {raffle.float_value && (
                            <span
                                className="px-2 py-1 rounded text-xs font-mono"
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
                    </div>
                </div>

                {/* Content section */}
                <div className="flex-1 p-6 md:p-8 flex flex-col justify-between">
                    <div className="space-y-4">
                        <div>
                            <h2
                                className="leading-tight"
                                style={{
                                    fontFamily: 'var(--font-bebas-neue)',
                                    fontSize: 'clamp(28px, 3vw, 40px)',
                                    color: '#F0EAD6',
                                }}
                            >
                                {raffle.title}
                            </h2>
                            {raffle.description && (
                                <p className="text-sm mt-1 line-clamp-2" style={{ color: '#7A7A8A' }}>
                                    {raffle.description}
                                </p>
                            )}
                        </div>

                        {/* Pricing */}
                        <div className="flex items-center gap-3 flex-wrap">
                            {raffle.original_price && (
                                <span
                                    className="text-base line-through"
                                    style={{ fontFamily: 'var(--font-geist-mono)', color: '#4A4A5A' }}
                                >
                                    R$ {raffle.original_price.toFixed(2).replace('.', ',')}
                                </span>
                            )}
                            {discount && (
                                <span
                                    className="text-sm font-black px-2 py-0.5 rounded"
                                    style={{ backgroundColor: '#E63946', color: '#fff' }}
                                >
                                    -{discount}%
                                </span>
                            )}
                        </div>

                        {/* Progress */}
                        <div className="space-y-2">
                            <div
                                className="flex justify-between text-xs"
                                style={{ color: '#7A7A8A', fontFamily: 'var(--font-geist-mono)' }}
                            >
                                <span>{sold} cotas vendidas</span>
                                <span style={{ color: isUrgent ? '#E63946' : '#7A7A8A' }}>{soldPercent}%</span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#2A2A32' }}>
                                <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{ width: `${soldPercent}%`, backgroundColor: progressColor }}
                                />
                            </div>
                            <p className="text-xs" style={{ color: '#4A4A5A' }}>
                                {available} cotas restantes de {total}
                            </p>
                        </div>
                    </div>

                    {/* CTA bottom */}
                    <div className="mt-8 space-y-3">
                        <div className="flex items-baseline gap-2">
                            <span className="text-sm" style={{ color: '#7A7A8A' }}>Cota por apenas</span>
                            <span
                                className="text-4xl font-black"
                                style={{ fontFamily: 'var(--font-bebas-neue)', color: '#F5C518' }}
                            >
                                R$ {raffle.price_per_ticket.toFixed(2).replace('.', ',')}
                            </span>
                        </div>
                        <Link
                            href={`/rifa/${raffle.id}`}
                            className="flex items-center justify-center gap-3 w-full h-14 rounded-xl text-base font-black uppercase tracking-widest transition-all hover:scale-[1.02]"
                            style={{
                                backgroundColor: '#F5C518',
                                color: '#0A0A0B',
                                boxShadow: '0 0 30px rgba(245,197,24,0.25)',
                            }}
                        >
                            PARTICIPAR AGORA <Ticket size={20} />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
