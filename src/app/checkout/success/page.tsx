import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, Hash, Calendar, Ticket, CreditCard, AlertCircle } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ tid?: string }>;
}) {
  const { tid } = await searchParams;
  const supabase = createAdminClient();

  let transaction: any = null;
  let raffle: any = null;

  if (tid) {
    const { data: transData } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', tid)
      .single();

    if (transData) {
      // If still pending, attempt to confirm via safety-net
      if (transData.status === 'pending') {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://romanovdasrifas.vercel.app';
        try {
          await fetch(`${appUrl}/api/confirm-payment?tid=${tid}`, { cache: 'no-store' });
          // Re-fetch transaction after confirmation attempt
          const { data: refreshed } = await supabase
            .from('transactions')
            .select('*')
            .eq('id', tid)
            .single();
          transaction = refreshed ?? transData;
        } catch {
          transaction = transData;
        }
      } else {
        transaction = transData;
      }

      const { data: raffleData } = await supabase
        .from('raffles')
        .select('*')
        .eq('id', transaction.raffle_id)
        .single();
      raffle = raffleData;
    }
  }

  const isPaid = transaction?.status === 'paid';

  return (
    <div className="container mx-auto p-4 min-h-screen relative z-10 flex flex-col items-center justify-center">
      <div
        className="bg-black/40 backdrop-blur-md border border-white/10 p-8 rounded-2xl shadow-xl max-w-lg w-full"
      >
        <div className="flex justify-center mb-6">
          <div className={`p-4 rounded-full ${isPaid ? 'bg-green-500/20' : 'bg-yellow-500/10'}`}>
            {isPaid
              ? <CheckCircle className="w-16 h-16 text-green-500" />
              : <Clock className="w-16 h-16 text-yellow-500" />
            }
          </div>
        </div>

        <div className="text-center mb-8">
          <h1
            className="text-3xl font-bold text-white mb-2"
            style={{ fontFamily: 'var(--font-bebas-neue)' }}
          >
            {isPaid ? 'COMPROVANTE DE COMPRA' : 'AGUARDANDO PAGAMENTO'}
          </h1>
          <p className="text-zinc-400 text-sm">
            {isPaid
              ? 'Pagamento confirmado. Suas cotas estão garantidas!'
              : 'Seu pagamento ainda está sendo processado. Aguarde alguns instantes.'}
          </p>
        </div>

        {transaction && raffle ? (
          <div className="bg-zinc-900/60 rounded-xl p-6 border border-white/5 space-y-4 mb-8">
            {/* Payment Status Badge */}
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <span className="text-zinc-500 text-sm">Status</span>
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                  isPaid
                    ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                    : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                }`}
              >
                {isPaid ? 'Confirmado' : 'Pendente'}
              </span>
            </div>

            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <span className="text-zinc-500 text-sm flex items-center gap-2">
                <Hash className="w-4 h-4" /> ID da Transação
              </span>
              <span className="text-zinc-300 font-mono text-xs">{transaction.id}</span>
            </div>

            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <span className="text-zinc-500 text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Data
              </span>
              <span className="text-white text-sm">
                {new Date(transaction.created_at).toLocaleDateString('pt-BR', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>

            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <span className="text-zinc-500 text-sm flex items-center gap-2">
                <Ticket className="w-4 h-4" /> Rifa
              </span>
              <span className="text-white text-sm font-semibold truncate max-w-[150px]">
                {raffle.title}
              </span>
            </div>

            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <span className="text-zinc-500 text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Valor Total
              </span>
              <span className="text-green-500 font-bold">
                R$ {transaction.amount.toFixed(2)}
              </span>
            </div>

            <div className="pt-2">
              <span className="text-zinc-500 text-sm block mb-2">Números da Sorte</span>
              <div className="flex flex-wrap gap-2">
                {transaction.ticket_numbers?.map((num: number) => (
                  <span
                    key={num}
                    className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-xs font-mono font-bold px-2 py-1 rounded"
                  >
                    {num}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center p-4 bg-red-500/10 rounded mb-6 flex items-center gap-2 justify-center">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <p className="text-red-400 text-sm">Detalhes da transação não disponíveis.</p>
          </div>
        )}

        <div className="space-y-4 text-zinc-400 text-center mb-8 text-sm">
          <p>
            Informaremos o ganhador no grupo do WhatsApp assim que sair o sorteio.
          </p>
        </div>

        <Link href="/">
          <Button
            className="w-full h-12 text-lg font-bold rounded-xl"
            style={{ backgroundColor: '#F5C518', color: '#0A0A0B' }}
          >
            Voltar para o Início
          </Button>
        </Link>
      </div>
    </div>
  );
}
