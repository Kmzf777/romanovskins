import { Trophy } from 'lucide-react';
import { Winner } from '@/types';

interface WinnerHallCardProps {
    winner: Winner;
}

export function WinnerHallCard({ winner }: WinnerHallCardProps) {
    const maskedName = (() => {
        const parts = winner.name.split(' ');
        if (parts.length === 1) return parts[0].charAt(0) + '***';
        return `${parts[0]} ${parts[1].charAt(0)}.`;
    })();

    return (
        <div
            className="rounded-2xl overflow-hidden transition-transform hover:scale-[1.02]"
            style={{ backgroundColor: '#111114', border: '1px solid #2A2A32' }}
        >
            {/* Image */}
            <div className="relative aspect-square overflow-hidden">
                <img
                    src={winner.raffle_image}
                    alt={winner.raffle_title}
                    className="w-full h-full object-cover"
                />
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: 'linear-gradient(to top, #111114 0%, transparent 60%)' }}
                />
                {/* Trophy badge */}
                <div
                    className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center"
                    style={{
                        backgroundColor: 'rgba(10,10,11,0.9)',
                        border: '1px solid rgba(245,197,24,0.5)',
                        boxShadow: '0 0 15px rgba(245,197,24,0.2)',
                    }}
                >
                    <Trophy size={16} style={{ color: '#F5C518' }} />
                </div>
            </div>

            {/* Info */}
            <div className="p-4 space-y-2">
                <h3
                    className="font-bold text-sm line-clamp-1"
                    style={{ color: '#F0EAD6' }}
                >
                    {winner.raffle_title}
                </h3>
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium" style={{ color: '#7A7A8A' }}>
                        {maskedName}
                    </span>
                    <span
                        className="text-xs font-black px-2 py-0.5 rounded"
                        style={{
                            fontFamily: 'var(--font-geist-mono)',
                            backgroundColor: 'rgba(245,197,24,0.1)',
                            color: '#F5C518',
                        }}
                    >
                        #{winner.ticket_number}
                    </span>
                </div>
                <p
                    className="text-xs"
                    style={{ color: '#4A4A5A', fontFamily: 'var(--font-geist-mono)' }}
                >
                    {winner.draw_date}
                </p>
            </div>
        </div>
    );
}
