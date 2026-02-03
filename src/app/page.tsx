import { getRaffles, getPastRaffles, getRecentWinners } from '@/server/raffle-actions';
import { TicketCard } from '@/components/ui/ticket-card';
import { PastTicketCard } from '@/components/ui/past-ticket-card';
import { WinnerCard } from '@/components/ui/winner-card';
import { SectionList } from '@/components/section-list';

export const dynamic = 'force-dynamic';

export default async function Home() {
    const raffles = await getRaffles();
    const pastRaffles = await getPastRaffles();
    const recentWinners = await getRecentWinners();

    return (
        <>
            <div className="container mx-auto p-4 relative z-10 max-w-5xl space-y-20 pb-20">
                {/* Active Raffles Section */}
                <section>
                    <header className="mb-12 text-center mt-8">
                        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-primary">Bilhetes ativos</h1>
                    </header>

                    {raffles.length === 0 ? (
                        <div className="text-center py-20">
                            <p className="text-xl text-gray-500">Nenhuma rifa ativa no momento.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6">
                            {raffles.map((raffle: any) => (
                                <TicketCard key={raffle.id} raffle={raffle} />
                            ))}
                        </div>
                    )}
                </section>

                {/* Past Raffles Section */}
                <SectionList
                    title="Bilhetes Passados"
                    className="border-t border-zinc-900 pt-16"
                    headerClassName="text-center md:text-left mb-8"
                >
                    {(pastRaffles || []).map((raffle) => (
                        <PastTicketCard key={raffle.id} raffle={raffle} />
                    ))}
                </SectionList>

                {/* Recent Winners Section */}
                <SectionList
                    title="Últimos Ganhadores"
                    className="border-t border-zinc-900 pt-16"
                    headerClassName="text-center md:text-left mb-8"
                >
                    {(recentWinners || []).map((winner) => (
                        <WinnerCard key={winner.id} winner={winner} />
                    ))}
                </SectionList>
            </div>
        </>
    );
}
