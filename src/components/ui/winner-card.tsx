'use client';

import { Card } from '@/components/ui/card';
import { Trophy, Calendar } from 'lucide-react';

interface WinnerCardProps {
    winner: {
        id: string;
        name: string;
        raffle_title: string;
        raffle_image: string;
        ticket_number: number;
        draw_date: string;
    };
}

export function WinnerCard({ winner }: WinnerCardProps) {
    return (
        <Card className="group relative overflow-hidden bg-zinc-900 border-zinc-800 hover:border-primary/50 transition-all duration-300">
            <div className="flex">
                {/* Left Side - Image Area (Small width as requested) */}
                <div className="relative w-28 sm:w-32 shrink-0 border-r border-zinc-800">
                    <div className="w-full h-full relative overflow-hidden">
                        <img
                            src={winner.raffle_image}
                            alt={winner.raffle_title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-zinc-900/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                </div>

                {/* Right Side - Content */}
                <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] uppercase font-bold text-primary/80 tracking-widest border border-primary/20 px-1.5 py-0.5 rounded bg-primary/10">
                                Ganhador
                            </span>
                            <span className="text-xs text-zinc-500 truncate flex-1 text-right font-mono">
                                {winner.draw_date}
                            </span>
                        </div>

                        <h3 className="font-bold text-white text-lg truncate group-hover:text-primary transition-colors">
                            {winner.name}
                        </h3>

                        <p className="text-sm text-zinc-400 truncate mt-0.5">
                            Ganhou: <span className="text-zinc-300">{winner.raffle_title}</span>
                        </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-zinc-800/50 pt-3">
                        <div className="flex items-center gap-2">
                            <div className="bg-yellow-500/10 p-1 rounded-md text-yellow-500">
                                <Trophy className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs font-medium text-zinc-300">
                                Bilhete Premiado
                            </span>
                        </div>
                        <span className="font-mono font-bold text-primary text-sm bg-primary/5 px-2 py-1 rounded border border-primary/10">
                            #{winner.ticket_number}
                        </span>
                    </div>
                </div>
            </div>
        </Card>
    );
}
