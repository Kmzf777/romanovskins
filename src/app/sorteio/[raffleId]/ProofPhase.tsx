'use client';

import { ExternalLink, Copy, Share2, Trophy, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

interface DrawSession {
  winner_ticket_number: number | null;
  winner_name: string | null;
  concurso: number | null;
  primeiro_premio: string | null;
}

interface Raffle {
  id: string;
  title: string;
  image_url: string;
  total_numbers: number;
}

interface ProofPhaseProps {
  raffle: Raffle;
  session: DrawSession;
}

function maskName(name: string): string {
  const parts = name.trim().split(' ');
  return parts
    .map((part) => {
      if (part.length <= 2) return part;
      return part[0] + '*'.repeat(part.length - 2) + part[part.length - 1];
    })
    .join(' ');
}

export function ProofPhase({ raffle, session }: ProofPhaseProps) {
  const {
    winner_ticket_number,
    winner_name,
    concurso,
    primeiro_premio,
  } = session;

  const maskedName = winner_name ? maskName(winner_name) : 'Desconhecido';

  const lastTwo = primeiro_premio
    ? parseInt(primeiro_premio.replace(/\D/g, '').slice(-2), 10)
    : null;

  const calculatedWinner =
    lastTwo !== null ? (lastTwo % raffle.total_numbers) + 1 : winner_ticket_number;

  const isFallback =
    calculatedWinner !== winner_ticket_number;

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleShare = async () => {
    const text = `🏆 Sorteio realizado! Número vencedor: #${winner_ticket_number} — Rifa: ${raffle.title}\n\nVerifique: ${shareUrl}`;
    if (navigator.share) {
      await navigator.share({ title: 'Resultado do Sorteio', text, url: shareUrl });
    } else {
      navigator.clipboard.writeText(text);
      toast.success('Resultado copiado!');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 gap-8">

        {/* Trofeu + título */}
        <div className="flex flex-col items-center gap-3 text-center">
          <Trophy className="w-12 h-12 text-yellow-400" />
          <h1 className="text-3xl font-black">Sorteio Encerrado!</h1>
          <p className="text-zinc-500 text-sm">{raffle.title}</p>
        </div>

        {/* Número vencedor */}
        <div className="relative flex flex-col items-center gap-3 bg-gradient-to-b from-yellow-500/20 to-yellow-500/5 border border-yellow-500/30 rounded-3xl p-10 w-full max-w-xs shadow-[0_0_80px_rgba(234,179,8,0.2)]">
          <p className="text-xs text-zinc-400 uppercase tracking-widest">Número Vencedor</p>
          <span className="text-8xl font-black font-mono text-yellow-400">
            #{winner_ticket_number}
          </span>
          <p className="text-zinc-300 font-semibold">{maskedName}</p>
        </div>

        {/* Comprovante */}
        <div className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/3">
            <ShieldCheck className="w-4 h-4 text-green-400" />
            <span className="text-sm font-semibold text-white">Comprovante de Transparência</span>
          </div>

          <div className="p-4 space-y-3 text-sm">
            {concurso && concurso > 0 && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Concurso Federal</span>
                <span className="text-white font-mono">#{concurso}</span>
              </div>
            )}

            {primeiro_premio && (
              <div className="flex justify-between">
                <span className="text-zinc-500">1º Prêmio</span>
                <span className="text-white font-mono">{primeiro_premio}</span>
              </div>
            )}

            {lastTwo !== null && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Últimos 2 dígitos</span>
                <span className="text-yellow-400 font-mono font-bold">{String(lastTwo).padStart(2, '0')}</span>
              </div>
            )}

            <div className="border-t border-white/5 pt-3">
              <p className="text-zinc-500 text-xs mb-1">Fórmula aplicada</p>
              <code className="text-xs bg-zinc-800 rounded px-2 py-1 block text-zinc-300">
                ({lastTwo} % {raffle.total_numbers}) + 1 ={' '}
                <span className="text-yellow-400 font-bold">{calculatedWinner}</span>
                {isFallback && (
                  <span className="text-zinc-500 ml-1">
                    → fallback #{winner_ticket_number}*
                  </span>
                )}
              </code>
              {isFallback && (
                <p className="text-xs text-zinc-600 mt-1">
                  * Número calculado não foi vendido — usado o ticket vendido mais próximo.
                </p>
              )}
            </div>

            <a
              href="https://loterias.caixa.gov.br/Paginas/Federal.aspx"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-yellow-500 hover:text-yellow-400 text-xs pt-1"
            >
              <ExternalLink className="w-3 h-3" />
              Verificar resultado oficial no site da Caixa
            </a>
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-3 w-full max-w-sm">
          <button
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl transition-colors"
          >
            <Share2 className="w-4 h-4" />
            Compartilhar
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(shareUrl);
              toast.success('Link copiado!');
            }}
            className="flex items-center justify-center gap-2 border border-white/10 hover:bg-white/5 text-zinc-300 px-4 rounded-xl transition-colors"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>

        {/* Imagem da rifa */}
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-white/10">
            <Image src={raffle.image_url} alt={raffle.title} fill className="object-cover" unoptimized />
          </div>
          <span>{raffle.title}</span>
        </div>
      </div>
    </div>
  );
}
