import type { Metadata } from 'next';
import { getAllWinners } from '@/server/raffle-actions';
import { WinnerHallCard } from '@/components/ui/winner-hall-card';

export const metadata: Metadata = {
  title: 'Ganhadores',
  description: 'Veja todos os ganhadores das rifas Romanov. Sorteios realizados com transparência pela Loteria Federal.',
  openGraph: {
    title: 'Ganhadores | Romanov Rifas',
    description: 'Confira os ganhadores das rifas de skins CS2 sorteadas pela Loteria Federal.',
    type: 'website',
  },
};

export const dynamic = 'force-dynamic';

export default async function GanhadoresPage() {
    const { winners, total } = await getAllWinners(1, 24);

    return (
        <div className="relative z-10 pb-24">
            {/* Hero */}
            <section className="max-w-6xl mx-auto px-6 md:px-10 py-20">
                <div className="text-center mb-16">
                    <h1
                        className="mb-3"
                        style={{
                            fontFamily: 'var(--font-bebas-neue)',
                            fontSize: 'clamp(52px, 8vw, 88px)',
                            color: '#F0EAD6',
                            lineHeight: 0.95,
                        }}
                    >
                        HALL OF<br />
                        <span style={{ color: '#F5C518', textShadow: '0 0 40px rgba(245,197,24,0.4)' }}>
                            FAME
                        </span>
                    </h1>
                    <p className="text-base" style={{ color: '#7A7A8A' }}>
                        {total} ganhadores que concorreram e venceram
                    </p>
                </div>

                {/* Grid */}
                {winners.length === 0 ? (
                    <div className="text-center py-24">
                        <p className="text-lg" style={{ color: '#4A4A5A' }}>
                            Nenhum sorteio realizado ainda. Seja o primeiro!
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {winners.map(winner => (
                            <WinnerHallCard key={winner.id} winner={winner} />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
