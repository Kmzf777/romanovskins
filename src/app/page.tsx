import { getRaffles } from '@/server/raffle-actions';
import { TicketCard } from '@/components/ui/ticket-card';
import HeroAscii from '@/components/ui/hero-ascii';

export const dynamic = 'force-dynamic';

export default async function Home() {
    const raffles = await getRaffles();

    return (
        <>
            <HeroAscii />
            <div className="container mx-auto p-4 relative z-10 max-w-5xl">
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
            </div>
        </>
    );
}
