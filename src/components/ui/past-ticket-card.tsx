'use client';

import { Card } from '@/components/ui/card';
import { Trophy } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface PastTicketCardProps {
    raffle: {
        id: string;
        title: string;
        description: string;
        image_url: string;
        price_per_ticket: number;
        total_numbers: number;
        status: string;
        winner_id?: string;
        winner_ticket?: number;
        draw_date?: string;
    };
}

export function PastTicketCard({ raffle }: PastTicketCardProps) {
    const drawDate = raffle.draw_date ? new Date(raffle.draw_date).toLocaleDateString('pt-BR') : 'Data desconhecida';

    return (
        <Card className="group relative overflow-hidden bg-zinc-900 border-zinc-800 transition-all duration-300 opacity-90 hover:opacity-100 hover:border-yellow-500/30">
            <div className="flex flex-col md:flex-row">
                {/* Image Section */}
                <div className="relative w-full md:w-60 aspect-video md:aspect-auto shrink-0">
                    <div className="w-full h-full relative overflow-hidden">
                        <img
                            src={raffle.image_url}
                            alt={raffle.title}
                            className="w-full h-full object-cover filter grayscale group-hover:grayscale-0 transition-all duration-500"
                        />
                        <div className="absolute inset-0 bg-black/40" />
                        <div className="absolute top-2 left-2 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded uppercase">
                            Finalizado
                        </div>
                    </div>
                </div>

                {/* Content Section */}
                <div className="flex-1 p-4 flex flex-col justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-zinc-300 group-hover:text-white transition-colors line-clamp-1">
                            {raffle.title}
                        </h3>
                        <p className="text-sm text-zinc-500 mt-1 line-clamp-2">
                            {raffle.description}
                        </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-4">
                        <div className="flex items-center gap-2 text-yellow-500">
                            <Trophy className="w-5 h-5" />
                            <div className="flex flex-col">
                                <span className="text-xs text-zinc-500 uppercase">Ganhador</span>
                                <span className="text-sm font-bold">Bilhete #{raffle.winner_ticket || '???'}</span>
                            </div>
                        </div>

                        <div className="text-right">
                            <span className="text-xs text-zinc-500 block">Sorteado em</span>
                            <span className="text-sm text-zinc-300 font-mono">{drawDate}</span>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}
