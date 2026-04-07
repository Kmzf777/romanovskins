import { Trophy } from 'lucide-react';
import { Winner } from '@/types';

interface WinnerCardProps {
    winner: Winner;
}

export function WinnerCard({ winner }: WinnerCardProps) {
    const maskedName = (() => {
        const parts = winner.name.split(' ');
        if (parts.length === 1) return parts[0].charAt(0) + '***';
        return `${parts[0]} ${parts[1].charAt(0)}.`;
    })();

    return (
        <div
            className="shrink-0 w-44 rounded-xl overflow-hidden transition-transform hover:scale-105"
            style={{ backgroundColor: '#111114', border: '1px solid #2A2A32' }}
        >
            {/* Skin image */}
            <div className="relative aspect-square overflow-hidden">
                <img
                    src={winner.raffle_image}
                    alt={winner.raffle_title}
                    className="w-full h-full object-cover"
                />
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: 'linear-gradient(to top, #111114 0%, transparent 50%)' }}
                />
                <div
                    className="absolute bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(10,10,11,0.9)', border: '1px solid rgba(245,197,24,0.5)' }}
                >
                    <Trophy size={14} style={{ color: '#F5C518' }} />
                </div>
            </div>

            {/* Info */}
            <div className="p-3 space-y-1">
                <p className="text-xs font-bold line-clamp-1" style={{ color: '#F0EAD6' }}>
                    {winner.raffle_title}
                </p>
                <p className="text-[11px]" style={{ color: '#7A7A8A' }}>
                    {maskedName}
                </p>
                <p
                    className="text-[10px]"
                    style={{ color: '#4A4A5A', fontFamily: 'var(--font-geist-mono)' }}
                >
                    #{winner.ticket_number} · {winner.draw_date}
                </p>
            </div>
        </div>
    );
}
