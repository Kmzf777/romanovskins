import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckCircle, Printer, Calendar, Hash, Ticket, CreditCard } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ tid?: string }> }) {
    const { tid } = await searchParams;
    const supabase = await createClient();

    let transaction = null;
    let raffle = null;

    if (tid) {
        // Fetch transaction details
        const { data: transData } = await supabase
            .from('transactions')
            .select('*')
            .eq('id', tid)
            .single();

        if (transData) {
            transaction = transData;
            // Fetch associated raffle
            const { data: raffleData } = await supabase
                .from('raffles')
                .select('*')
                .eq('id', transaction.raffle_id)
                .single();
            raffle = raffleData;
        }
    }

    if (!transaction || !raffle) {
        // If no ID or not found, fallback to generic message (or handle error)
        // For now, let's just show the simple page if not found, or maybe redirect?
        // Let's keep the simple view if no data found for robustness.
    }

    return (
        <div className="container mx-auto p-4 min-h-screen relative z-10 flex flex-col items-center justify-center">
            <div className="bg-black/40 backdrop-blur-md border border-white/10 p-8 rounded-2xl shadow-xl max-w-lg w-full">
                <div className="flex justify-center mb-6">
                    <div className="bg-green-500/20 p-4 rounded-full">
                        <CheckCircle className="w-16 h-16 text-green-500" />
                    </div>
                </div>

                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">COMPROVANTE DE COMPRA</h1>
                    <p className="text-zinc-400 text-sm">
                        Caso queira, tire um print para guardar de registro.
                    </p>
                </div>

                {transaction && raffle ? (
                    <div className="bg-zinc-900/60 rounded-xl p-6 border border-white/5 space-y-4 mb-8">
                        {/* Transaction ID */}
                        <div className="flex justify-between items-center border-b border-white/5 pb-3">
                            <span className="text-zinc-500 text-sm flex items-center gap-2">
                                <Hash className="w-4 h-4" /> ID da Transação
                            </span>
                            <span className="text-zinc-300 font-mono text-xs">{transaction.id}</span>
                        </div>

                        {/* Date */}
                        <div className="flex justify-between items-center border-b border-white/5 pb-3">
                            <span className="text-zinc-500 text-sm flex items-center gap-2">
                                <Calendar className="w-4 h-4" /> Data
                            </span>
                            <span className="text-white text-sm">
                                {new Date(transaction.created_at).toLocaleDateString('pt-BR', {
                                    day: '2-digit', month: '2-digit', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                })}
                            </span>
                        </div>

                        {/* Raffle */}
                        <div className="flex justify-between items-center border-b border-white/5 pb-3">
                            <span className="text-zinc-500 text-sm flex items-center gap-2">
                                <Ticket className="w-4 h-4" /> Rifa
                            </span>
                            <span className="text-white text-sm font-semibold truncate max-w-[150px]">
                                {raffle.title}
                            </span>
                        </div>

                        {/* Amount */}
                        <div className="flex justify-between items-center border-b border-white/5 pb-3">
                            <span className="text-zinc-500 text-sm flex items-center gap-2">
                                <CreditCard className="w-4 h-4" /> Valor Total
                            </span>
                            <span className="text-green-500 font-bold">
                                R$ {transaction.amount.toFixed(2)}
                            </span>
                        </div>

                        {/* Ticket Numbers */}
                        <div className="pt-2">
                            <span className="text-zinc-500 text-sm block mb-2">Números da Sorte</span>
                            <div className="flex flex-wrap gap-2">
                                {transaction.ticket_numbers && transaction.ticket_numbers.map((num: any) => (
                                    <span key={num} className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-xs font-mono font-bold px-2 py-1 rounded">
                                        {num}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center p-4 bg-red-500/10 rounded mb-6">
                        <p className="text-red-400">Detalhes da transação não disponíveis.</p>
                    </div>
                )}

                <div className="space-y-4 text-zinc-400 text-center mb-8 text-sm">
                    <p>
                        Informaremos o ganhador no grupo do WhatsApp e entraremos em contato assim que sair o sorteio.
                    </p>
                </div>

                <Link href="/">
                    <Button className="w-full h-12 text-lg font-bold bg-primary text-black hover:bg-primary/90">
                        Voltar para o Início
                    </Button>
                </Link>
            </div>
        </div>
    );
}
