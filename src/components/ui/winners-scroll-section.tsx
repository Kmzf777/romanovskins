import Link from 'next/link';
import { WinnerCard } from './winner-card';
import { Winner } from '@/types';

interface WinnersScrollSectionProps {
    winners: Winner[];
}

export function WinnersScrollSection({ winners }: WinnersScrollSectionProps) {
    if (!winners || winners.length === 0) return null;

    return (
        <section className="relative z-10 py-20">
            <div className="max-w-6xl mx-auto px-6 md:px-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <h2
                        style={{
                            fontFamily: 'var(--font-bebas-neue)',
                            fontSize: 'clamp(28px, 4vw, 44px)',
                            color: '#F0EAD6',
                        }}
                    >
                        ÚLTIMOS GANHADORES
                    </h2>
                    <Link
                        href="/ganhadores"
                        className="text-sm font-bold uppercase tracking-wider transition-colors hover:text-white"
                        style={{ color: '#F5C518' }}
                    >
                        Ver todos →
                    </Link>
                </div>

                {/* Scroll container */}
                <div
                    className="flex gap-4 overflow-x-auto pb-4"
                    style={{ scrollbarWidth: 'none' }}
                >
                    {winners.map(winner => (
                        <WinnerCard key={winner.id} winner={winner} />
                    ))}
                </div>
            </div>
        </section>
    );
}
