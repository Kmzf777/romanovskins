'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, Ticket } from 'lucide-react';

interface TicketCardProps {
    raffle: {
        id: string;
        title: string;
        description: string;
        image_url: string;
        price_per_ticket: number;
        total_numbers: number;
        status: string;
    };
}

export function TicketCard({ raffle }: TicketCardProps) {
    // Mock data for display purposes
    const floatValue = '0.01231234135';
    const condition = 'Field-Tested';
    const remaining = Math.floor(raffle.total_numbers * 0.4); // Mock remaining

    return (
        <Card className="group relative overflow-hidden bg-zinc-900 border-zinc-800 hover:border-primary/50 transition-all duration-300">
            <div className="flex flex-col md:flex-row">
                {/* Left Side - Image Area */}
                {/* Left Side - Image Area */}
                <div className="relative w-full md:w-80 aspect-square md:aspect-auto shrink-0 md:p-4 p-0">
                    <div className="w-full h-full relative overflow-hidden rounded-xl">
                        <img
                            src={raffle.image_url}
                            alt={raffle.title}
                            className="w-full h-full object-cover transition-transform duration-500"
                        />

                        {/* Overlay Info */}
                        <div className="absolute top-0 left-0 p-2 w-full flex justify-between items-start text-[10px] sm:text-xs font-mono tracking-wider">
                            <span className="bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-zinc-400 border border-zinc-800">
                                {floatValue}
                            </span>
                            <span className="bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-yellow-500 border border-zinc-800 uppercase">
                                {condition}
                            </span>
                        </div>

                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-zinc-900/50" />
                    </div>
                </div>

                {/* Right Side - Content */}
                <div className="flex-1 p-6 flex flex-col justify-between relative">
                    {/* Decorative Perforation Line (Mobile: Horizontal, Desktop: Vertical) */}
                    <div
                        className="hidden md:block absolute left-0 top-6 bottom-6 w-[2px]"
                        style={{
                            backgroundImage: 'linear-gradient(to bottom, #27272a 50%, transparent 50%)',
                            backgroundSize: '2px 14px',
                            backgroundRepeat: 'repeat-y'
                        }}
                    />
                    <div
                        className="md:hidden absolute top-0 left-6 right-6 h-[2px]"
                        style={{
                            backgroundImage: 'linear-gradient(to right, #27272a 50%, transparent 50%)',
                            backgroundSize: '14px 2px',
                            backgroundRepeat: 'repeat-x'
                        }}
                    />

                    <div className="space-y-4">
                        <div className="flex justify-between items-start gap-4">
                            <div>
                                <h3 className="text-xl md:text-2xl font-bold text-white group-hover:text-primary transition-colors line-clamp-1">
                                    {raffle.title}
                                </h3>
                                <p className="text-sm text-zinc-400 mt-1 line-clamp-2">
                                    {raffle.description}
                                </p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-sm text-zinc-500">Cota</p>
                                <p className="text-2xl md:text-3xl font-black text-primary">
                                    R$ {raffle.price_per_ticket.toFixed(2)}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 py-4 border-t border-zinc-800/50 border-b">
                            <div>
                                <p className="text-xs text-zinc-500 uppercase tracking-wider">Total de Cotas</p>
                                <p className="text-lg font-semibold text-zinc-300">{raffle.total_numbers}</p>
                            </div>
                            <div>
                                <p className="text-xs text-zinc-500 uppercase tracking-wider">Cotas Restantes</p>
                                <p className="text-lg font-semibold text-zinc-300">{remaining}</p>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 mt-auto">
                        <Button asChild className="w-full h-14 text-lg bg-primary text-black hover:bg-primary/90 font-black tracking-widest uppercase shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300">
                            <Link href={`/rifa/${raffle.id}`}>
                                Comprar Cota
                                <Ticket className="w-6 h-6 ml-3" />
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </Card>
    );
}
