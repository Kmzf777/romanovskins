import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Trophy, Ticket } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MeusTicketsPage() {
    const cookieStore = await cookies();
    const userId = cookieStore.get('romanov_user')?.value;
    if (!userId) redirect('/login?next=/meus-tickets');

    const supabase = await createClient();
    const { data: transactions } = await supabase
        .from('transactions')
        .select(`
            id, amount, status, ticket_numbers, created_at,
            raffle:raffles ( id, title, image_url, status, winner_ticket_number, winner_user_id )
        `)
        .eq('user_id', userId)
        .eq('status', 'paid')
        .order('created_at', { ascending: false });

    return (
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-10 relative z-10 pb-24">
            {/* Header */}
            <div className="mb-10">
                <h1
                    style={{ fontFamily: 'var(--font-bebas-neue)', fontSize: '52px', color: '#F0EAD6' }}
                >
                    MEUS TICKETS
                </h1>
                <p className="text-sm mt-1" style={{ color: '#7A7A8A' }}>
                    Todas as suas cotas compradas
                </p>
            </div>

            {/* Empty state */}
            {(!transactions || transactions.length === 0) && (
                <div className="text-center py-24 space-y-6">
                    <Ticket size={48} style={{ color: '#2A2A32', margin: '0 auto' }} />
                    <p className="text-lg" style={{ color: '#4A4A5A' }}>
                        Você ainda não comprou nenhuma cota.
                    </p>
                    <Link
                        href="/"
                        className="inline-block px-8 py-3 rounded-xl font-black uppercase tracking-wider"
                        style={{ backgroundColor: '#F5C518', color: '#0A0A0B' }}
                    >
                        Ver Rifas Ativas
                    </Link>
                </div>
            )}

            {/* Transaction list */}
            {transactions && transactions.length > 0 && (
                <div className="space-y-4">
                    {transactions.map((tx: any) => {
                        const raffle = tx.raffle;
                        const isWinner = raffle?.winner_user_id === userId && raffle?.status === 'drawn';
                        const isDrawn = raffle?.status === 'drawn';

                        return (
                            <div
                                key={tx.id}
                                className="rounded-2xl overflow-hidden transition-all"
                                style={{
                                    backgroundColor: '#111114',
                                    border: `1px solid ${isWinner ? 'rgba(245,197,24,0.5)' : '#2A2A32'}`,
                                    boxShadow: isWinner ? '0 0 30px rgba(245,197,24,0.1)' : 'none',
                                }}
                            >
                                {/* Winner banner */}
                                {isWinner && (
                                    <div
                                        className="flex items-center gap-2 px-5 py-2.5 text-sm font-black uppercase tracking-wider"
                                        style={{ backgroundColor: 'rgba(245,197,24,0.12)', color: '#F5C518' }}
                                    >
                                        <Trophy size={14} /> VOCÊ GANHOU ESTA RIFA!
                                    </div>
                                )}

                                <div className="flex gap-4 p-5">
                                    {/* Image */}
                                    {raffle?.image_url && (
                                        <img
                                            src={raffle.image_url}
                                            alt={raffle.title}
                                            className="w-20 h-20 rounded-xl object-cover shrink-0"
                                        />
                                    )}

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 space-y-3">
                                        <div className="flex items-start justify-between gap-2 flex-wrap">
                                            <h3 className="font-bold truncate" style={{ color: '#F0EAD6' }}>
                                                {raffle?.title ?? 'Rifa'}
                                            </h3>
                                            <span
                                                className="text-xs font-bold px-2 py-1 rounded-lg uppercase shrink-0"
                                                style={{
                                                    backgroundColor: raffle?.status === 'active'
                                                        ? 'rgba(45,198,83,0.12)'
                                                        : 'rgba(74,74,90,0.3)',
                                                    color: raffle?.status === 'active' ? '#2DC653' : '#7A7A8A',
                                                    border: `1px solid ${raffle?.status === 'active' ? 'rgba(45,198,83,0.2)' : '#2A2A32'}`,
                                                }}
                                            >
                                                {raffle?.status ?? 'desconhecido'}
                                            </span>
                                        </div>

                                        <p
                                            className="text-xs"
                                            style={{ color: '#4A4A5A', fontFamily: 'var(--font-geist-mono)' }}
                                        >
                                            {new Date(tx.created_at).toLocaleDateString('pt-BR')} · R$ {Number(tx.amount).toFixed(2)}
                                        </p>

                                        {isDrawn && (
                                            <p className="text-xs" style={{ color: '#7A7A8A' }}>
                                                Número vencedor:{' '}
                                                <span className="font-black" style={{ fontFamily: 'var(--font-geist-mono)', color: '#F5C518' }}>
                                                    #{raffle.winner_ticket_number}
                                                </span>
                                            </p>
                                        )}

                                        {/* Ticket numbers */}
                                        <div className="flex flex-wrap gap-1.5">
                                            {(tx.ticket_numbers || []).map((num: number) => {
                                                const isWinningNumber = isDrawn && num === raffle?.winner_ticket_number;
                                                return (
                                                    <span
                                                        key={num}
                                                        className="text-xs font-mono font-bold px-2 py-1 rounded-lg"
                                                        style={{
                                                            backgroundColor: isWinningNumber
                                                                ? 'rgba(245,197,24,0.2)'
                                                                : 'rgba(255,255,255,0.04)',
                                                            color: isWinningNumber ? '#F5C518' : '#7A7A8A',
                                                            border: `1px solid ${isWinningNumber ? 'rgba(245,197,24,0.4)' : '#2A2A32'}`,
                                                        }}
                                                    >
                                                        #{num}
                                                    </span>
                                                );
                                            })}
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
