import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function MeusTicketsPage() {
    const cookieStore = await cookies();
    const userId = cookieStore.get('romanov_user')?.value;

    if (!userId) redirect('/login?next=/meus-tickets');

    const supabase = await createClient();

    const { data: transactions } = await supabase
        .from('transactions')
        .select(`
            id,
            amount,
            status,
            ticket_numbers,
            created_at,
            raffle:raffles ( id, title, image_url, status, winner_ticket_number, winner_user_id )
        `)
        .eq('user_id', userId)
        .eq('status', 'paid')
        .order('created_at', { ascending: false });

    return (
        <div className="container mx-auto p-4 max-w-4xl relative z-10 pb-20">
            <header className="mt-8 mb-10 text-center">
                <h1 className="text-4xl font-extrabold tracking-tight text-primary">Meus Tickets</h1>
                <p className="text-zinc-400 mt-2">Todas as suas cotas compradas</p>
            </header>

            {!transactions || transactions.length === 0 ? (
                <div className="text-center py-20 space-y-4">
                    <p className="text-zinc-400 text-lg">Você ainda não comprou nenhuma cota.</p>
                    <Link href="/">
                        <Button className="mt-4">Ver Rifas Disponíveis</Button>
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {transactions.map((tx: any) => {
                        const raffle = tx.raffle;
                        const isWinner = raffle?.winner_user_id === userId
                            && raffle?.status === 'drawn';
                        const isDrawn = raffle?.status === 'drawn';

                        return (
                            <div
                                key={tx.id}
                                className={`bg-zinc-900 border rounded-xl p-5 ${
                                    isWinner
                                        ? 'border-yellow-500/50 bg-yellow-500/5'
                                        : 'border-zinc-800'
                                }`}
                            >
                                <div className="flex gap-4">
                                    {raffle?.image_url && (
                                        <img
                                            src={raffle.image_url}
                                            alt={raffle.title}
                                            className="w-20 h-20 object-cover rounded-lg shrink-0"
                                        />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 flex-wrap">
                                            <h3 className="font-bold text-white truncate">
                                                {raffle?.title ?? 'Rifa'}
                                            </h3>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {isWinner && (
                                                    <span className="text-xs font-bold px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                                        🏆 VOCÊ GANHOU!
                                                    </span>
                                                )}
                                                <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${
                                                    raffle?.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                                    raffle?.status === 'drawn' ? 'bg-zinc-500/20 text-zinc-400' :
                                                    'bg-zinc-700/50 text-zinc-400'
                                                }`}>
                                                    {raffle?.status ?? 'desconhecido'}
                                                </span>
                                            </div>
                                        </div>

                                        <p className="text-xs text-zinc-500 mt-1">
                                            Comprado em {new Date(tx.created_at).toLocaleDateString('pt-BR', {
                                                day: '2-digit', month: '2-digit', year: 'numeric'
                                            })} • R$ {Number(tx.amount).toFixed(2)}
                                        </p>

                                        {isDrawn && (
                                            <p className="text-xs text-zinc-400 mt-1">
                                                Número vencedor:{' '}
                                                <span className="font-mono font-bold text-white">
                                                    #{raffle.winner_ticket_number}
                                                </span>
                                            </p>
                                        )}

                                        <div className="flex flex-wrap gap-1.5 mt-3">
                                            {(tx.ticket_numbers || []).map((num: number) => (
                                                <span
                                                    key={num}
                                                    className={`text-xs font-mono font-bold px-2 py-1 rounded border ${
                                                        isDrawn && num === raffle?.winner_ticket_number
                                                            ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                                                            : 'bg-white/5 text-zinc-300 border-zinc-700'
                                                    }`}
                                                >
                                                    #{num}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
