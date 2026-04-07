import { getRaffles, getRecentWinners, getPublicStats } from '@/server/raffle-actions';
import { HeroBanner } from '@/components/ui/hero-banner';
import { FeaturedRaffleCard } from '@/components/ui/featured-raffle-card';
import { TicketCard } from '@/components/ui/ticket-card';
import { HowItWorksSection } from '@/components/ui/how-it-works-section';
import { WinnersScrollSection } from '@/components/ui/winners-scroll-section';

export const dynamic = 'force-dynamic';

export default async function Home() {
    const [raffles, recentWinners, stats] = await Promise.all([
        getRaffles(),
        getRecentWinners(),
        getPublicStats(),
    ]);

    const featuredRaffles = raffles.filter((r: any) => r.featured);
    const regularRaffles = raffles.filter((r: any) => !r.featured);

    return (
        <>
            {/* Hero */}
            <HeroBanner totalWinners={stats.totalWinners} totalValue={stats.totalValue} />

            <div className="relative z-10">
                {/* Featured Raffles */}
                {featuredRaffles.length > 0 && (
                    <section className="max-w-6xl mx-auto px-6 md:px-10 py-20">
                        <h2
                            className="mb-8"
                            style={{
                                fontFamily: 'var(--font-bebas-neue)',
                                fontSize: 'clamp(28px, 4vw, 44px)',
                                color: '#F0EAD6',
                            }}
                        >
                            EM DESTAQUE
                        </h2>
                        <div className="space-y-6">
                            {featuredRaffles.slice(0, 2).map((raffle: any) => (
                                <FeaturedRaffleCard key={raffle.id} raffle={raffle} />
                            ))}
                        </div>
                    </section>
                )}

                {/* All Raffles Grid */}
                {regularRaffles.length > 0 && (
                    <section id="rifas" className="max-w-6xl mx-auto px-6 md:px-10 pb-20">
                        <h2
                            className="mb-8"
                            style={{
                                fontFamily: 'var(--font-bebas-neue)',
                                fontSize: 'clamp(28px, 4vw, 44px)',
                                color: '#F0EAD6',
                            }}
                        >
                            {featuredRaffles.length > 0 ? 'TODAS AS RIFAS' : 'RIFAS ATIVAS'}
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {regularRaffles.map((raffle: any) => (
                                <TicketCard key={raffle.id} raffle={raffle} />
                            ))}
                        </div>
                    </section>
                )}

                {/* Empty state */}
                {raffles.length === 0 && (
                    <section id="rifas" className="max-w-6xl mx-auto px-6 md:px-10 py-32 text-center">
                        <p className="text-xl" style={{ color: '#4A4A5A' }}>
                            Nenhuma rifa ativa no momento. Volte em breve!
                        </p>
                    </section>
                )}

                {/* How It Works */}
                <HowItWorksSection />

                {/* Recent Winners */}
                <WinnersScrollSection winners={recentWinners} />
            </div>
        </>
    );
}
