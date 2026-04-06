'use client';

import { useTransition } from 'react';
import { closeRaffleAction } from '@/server/raffle-actions';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { AdminDrawModal } from './AdminDrawModal';

export function AdminRaffleList({ raffles }: { raffles: any[] }) {
    const [isPending, startTransition] = useTransition();

    const handleClose = (raffleId: string) => {
        startTransition(async () => {
            const res = await closeRaffleAction(raffleId);
            if (res.success) {
                toast.success('Rifa fechada com sucesso.');
            } else {
                toast.error(res.error || 'Erro ao fechar rifa.');
            }
        });
    };

    if (raffles.length === 0) {
        return <p className="text-zinc-400">Nenhuma rifa cadastrada.</p>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-white/10 text-zinc-400 text-left">
                        <th className="py-3 pr-4">Título</th>
                        <th className="py-3 pr-4">Status</th>
                        <th className="py-3 pr-4">Progresso</th>
                        <th className="py-3 pr-4">Preço</th>
                        <th className="py-3">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    {raffles.map((raffle: any) => {
                        const sold = raffle.sold_count ?? 0;
                        const percent = raffle.total_numbers > 0
                            ? Math.round((sold / raffle.total_numbers) * 100)
                            : 0;

                        return (
                            <tr key={raffle.id} className="border-b border-white/5 hover:bg-white/5">
                                <td className="py-3 pr-4 font-medium">{raffle.title}</td>
                                <td className="py-3 pr-4">
                                    <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${
                                        raffle.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                        raffle.status === 'drawn' ? 'bg-yellow-500/20 text-yellow-400' :
                                        'bg-zinc-500/20 text-zinc-400'
                                    }`}>
                                        {raffle.status}
                                    </span>
                                </td>
                                <td className="py-3 pr-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-24 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary rounded-full"
                                                style={{ width: `${percent}%` }}
                                            />
                                        </div>
                                        <span className="text-zinc-400 text-xs">{sold}/{raffle.total_numbers}</span>
                                    </div>
                                </td>
                                <td className="py-3 pr-4 text-zinc-300">
                                    R$ {Number(raffle.price_per_ticket).toFixed(2)}
                                </td>
                                <td className="py-3">
                                    <div className="flex gap-2">
                                        {raffle.status === 'active' && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleClose(raffle.id)}
                                                disabled={isPending}
                                                className="text-xs h-7"
                                            >
                                                Fechar
                                            </Button>
                                        )}
                                        {raffle.status === 'closed' && (
                                            <AdminDrawModal raffleId={raffle.id} raffleTitle={raffle.title} />
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
