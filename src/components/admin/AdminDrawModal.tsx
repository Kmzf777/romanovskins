'use client';

import { useState, useTransition } from 'react';
import { openDrawSessionAction } from '@/server/raffle-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Radio, Loader2, X, Copy, ExternalLink } from 'lucide-react';
import { DRAW_COUNTDOWN_MINUTES } from '@/lib/draw-config';

export function AdminDrawModal({
  raffleId,
  raffleTitle,
}: {
  raffleId: string;
  raffleTitle: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [countdown, setCountdown] = useState(String(DRAW_COUNTDOWN_MINUTES));
  const [drawUrl, setDrawUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleOpen = () => {
    startTransition(async () => {
      const minutes = Math.max(1, parseInt(countdown) || DRAW_COUNTDOWN_MINUTES);
      const res = await openDrawSessionAction(raffleId, minutes);
      if (res.success && res.drawUrl) {
        setDrawUrl(res.drawUrl);
      } else {
        toast.error(res.error || 'Erro ao abrir sala.');
      }
    });
  };

  const fullUrl =
    typeof window !== 'undefined' && drawUrl
      ? `${window.location.origin}${drawUrl}`
      : drawUrl ?? '';

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl);
    toast.success('Link copiado!');
  };

  const handleClose = () => {
    setIsOpen(false);
    setDrawUrl(null);
    setCountdown(String(DRAW_COUNTDOWN_MINUTES));
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-xs h-7 px-3 rounded border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 transition-colors flex items-center gap-1"
      >
        <Radio className="w-3 h-3" />
        Abrir Sala
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-red-400 animate-pulse" />
                Sala de Sorteio ao Vivo
              </h2>
              <button onClick={handleClose} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!drawUrl ? (
              <>
                <p className="text-sm text-zinc-400 mb-4">
                  Rifa: <span className="text-white font-medium">{raffleTitle}</span>
                </p>

                <div className="bg-zinc-800/50 rounded-lg p-4 mb-4 text-sm text-zinc-300">
                  Uma sala pública será criada com uma contagem regressiva. Compartilhe o
                  link no grupo do WhatsApp para que os participantes assistam ao sorteio
                  ao vivo. O sorteio acontece automaticamente ao zerar.
                </div>

                <div className="mb-4">
                  <label className="text-xs text-zinc-400 mb-1 block uppercase tracking-wider">
                    Duração da contagem (minutos)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={countdown}
                    onChange={e => setCountdown(e.target.value)}
                    className="font-mono w-28"
                  />
                </div>

                <Button
                  onClick={handleOpen}
                  disabled={isPending}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-bold"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando sala...
                    </>
                  ) : (
                    <>
                      <Radio className="w-4 h-4 mr-2" /> Abrir Sala ao Vivo
                    </>
                  )}
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                  <p className="text-green-400 font-semibold text-sm mb-1">
                    ✓ Sala criada! Compartilhe o link:
                  </p>
                  <p className="text-xs text-zinc-400 mt-2 break-all font-mono">{fullUrl}</p>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleCopy} variant="outline" className="flex-1">
                    <Copy className="w-4 h-4 mr-2" /> Copiar Link
                  </Button>
                  <Button
                    onClick={() => window.open(fullUrl, '_blank')}
                    variant="outline"
                    className="flex-1"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" /> Abrir Sala
                  </Button>
                </div>

                <p className="text-xs text-zinc-500 text-center">
                  Você pode fechar esta janela. O sorteio acontecerá automaticamente.
                </p>

                <Button onClick={handleClose} variant="ghost" className="w-full">
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
