'use client';

import { useState, useTransition } from 'react';
import { performDrawAction } from '@/server/raffle-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Trophy, Loader2, X } from 'lucide-react';

interface DrawResult {
    winnerTicketNumber: number;
    winnerName: string;
    winnerWhatsapp: string;
    concurso: number;
    primeiroPremio: string;
}

export function AdminDrawModal({ raffleId, raffleTitle }: { raffleId: string; raffleTitle: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [manualPremio, setManualPremio] = useState('');
    const [useManual, setUseManual] = useState(false);
    const [result, setResult] = useState<DrawResult | null>(null);
    const [isPending, startTransition] = useTransition();

    const handleDraw = () => {
        startTransition(async () => {
            const res = await performDrawAction(
                raffleId,
                useManual && manualPremio ? manualPremio : undefined
            );

            if (res.success) {
                setResult({
                    winnerTicketNumber: res.winnerTicketNumber!,
                    winnerName: res.winnerName!,
                    winnerWhatsapp: res.winnerWhatsapp!,
                    concurso: res.concurso!,
                    primeiroPremio: res.primeiroPremio!,
                });
            } else {
                toast.error(res.error || 'Erro ao realizar sorteio.');
            }
        });
    };

    const handleClose = () => {
        setIsOpen(false);
        setResult(null);
        setManualPremio('');
        setUseManual(false);
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="text-xs h-7 px-3 rounded border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 transition-colors"
            >
                Sortear
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-yellow-400" />
                                Realizar Sorteio
                            </h2>
                            <button onClick={handleClose} className="text-zinc-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {!result ? (
                            <>
                                <p className="text-sm text-zinc-400 mb-4">
                                    Rifa: <span className="text-white font-medium">{raffleTitle}</span>
                                </p>

                                <div className="bg-zinc-800/50 rounded-lg p-4 mb-4 text-sm text-zinc-300">
                                    O número vencedor será determinado pelos <strong className="text-white">2 últimos dígitos do 1º prêmio</strong> da Loteria Federal mais recente.
                                    <br /><br />
                                    Fórmula: <code className="bg-zinc-700 px-1 rounded">(ultimos2 % total_cotas) + 1</code>
                                </div>

                                <div className="mb-4">
                                    <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer mb-3">
                                        <input
                                            type="checkbox"
                                            checked={useManual}
                                            onChange={e => setUseManual(e.target.checked)}
                                            className="rounded"
                                        />
                                        Inserir número do 1º prêmio manualmente
                                    </label>

                                    {useManual && (
                                        <Input
                                            value={manualPremio}
                                            onChange={e => setManualPremio(e.target.value)}
                                            placeholder="Ex: 097680"
                                            className="font-mono"
                                        />
                                    )}
                                    {!useManual && (
                                        <p className="text-xs text-zinc-500">
                                            O sistema buscará automaticamente o último resultado em api.guidi.dev.br/loteria
                                        </p>
                                    )}
                                </div>

                                <Button
                                    onClick={handleDraw}
                                    disabled={isPending || (useManual && !manualPremio)}
                                    className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold"
                                >
                                    {isPending ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sorteando...</>
                                    ) : 'Confirmar Sorteio'}
                                </Button>
                            </>
                        ) : (
                            <div className="text-center space-y-4">
                                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-6">
                                    <p className="text-zinc-400 text-sm mb-1">Número Vencedor</p>
                                    <p className="text-5xl font-black text-yellow-400 font-mono">
                                        #{result.winnerTicketNumber}
                                    </p>
                                </div>

                                <div className="text-left space-y-2 bg-zinc-800/50 rounded-lg p-4 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400">Ganhador</span>
                                        <span className="text-white font-medium">{result.winnerName}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400">WhatsApp</span>
                                        <span className="text-white font-mono">{result.winnerWhatsapp}</span>
                                    </div>
                                    {result.concurso > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-zinc-400">Concurso Federal</span>
                                            <span className="text-white">#{result.concurso}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400">1º Prêmio</span>
                                        <span className="text-white font-mono">{result.primeiroPremio}</span>
                                    </div>
                                </div>

                                <Button onClick={handleClose} className="w-full">
                                    Fechar
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
