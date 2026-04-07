'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChevronDown, ChevronUp, Shield, ExternalLink } from 'lucide-react';
import Image from 'next/image';

interface CountdownPhaseProps {
  raffle: { id: string; title: string; image_url: string; total_numbers: number };
  drawAt: string;
  onCountdownEnd: () => void;
  drawError?: string | null;
}

function formatTime(ms: number) {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function CountdownPhase({ raffle, drawAt, onCountdownEnd, drawError }: CountdownPhaseProps) {
  const [timeLeft, setTimeLeft] = useState(() =>
    Math.max(0, new Date(drawAt).getTime() - Date.now())
  );
  const [viewers, setViewers] = useState(1);
  const [faqOpen, setFaqOpen] = useState(false);
  const endCalled = useRef(false);

  // Countdown tick
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, new Date(drawAt).getTime() - Date.now());
      setTimeLeft(remaining);
      if (remaining === 0 && !endCalled.current) {
        endCalled.current = true;
        clearInterval(interval);
        onCountdownEnd();
      }
    }, 500);
    return () => clearInterval(interval);
  }, [drawAt, onCountdownEnd]);

  // Viewers online via Presence (Supabase Realtime)
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`presence:${raffle.id}`, {
      config: { presence: { key: crypto.randomUUID() } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        setViewers(Object.keys(channel.presenceState()).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [raffle.id]);

  const isUrgent = timeLeft < 60_000; // último minuto

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs text-red-400 font-semibold uppercase tracking-wider">
            Ao Vivo
          </span>
        </div>
        <span className="text-xs text-zinc-500">{viewers} assistindo</span>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 gap-8">
        {/* Raffle info */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative w-32 h-32 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            <Image
              src={raffle.image_url}
              alt={raffle.title}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
          <h1 className="text-2xl font-bold text-white max-w-sm">{raffle.title}</h1>
          <p className="text-zinc-500 text-sm">{raffle.total_numbers} cotas</p>
        </div>

        {/* Countdown */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs uppercase tracking-widest text-zinc-500">
            Sorteio em
          </p>
          <div
            className={`text-8xl md:text-9xl font-black font-mono tabular-nums transition-colors duration-500 ${
              isUrgent ? 'text-red-400' : 'text-white'
            }`}
            style={{ fontFamily: 'var(--font-bebas-neue)' }}
          >
            {formatTime(timeLeft)}
          </div>
          <p className="text-zinc-600 text-xs">
            {new Date(drawAt).toLocaleString('pt-BR')}
          </p>
          {drawError && (
            <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-center max-w-sm">
              <p className="text-red-400 text-sm font-semibold">Erro no sorteio</p>
              <p className="text-red-300/80 text-xs mt-1">{drawError}</p>
            </div>
          )}
        </div>
      </main>

      {/* FAQ — Como funciona */}
      <div className="border-t border-white/5">
        <button
          onClick={() => setFaqOpen(v => !v)}
          className="w-full flex items-center justify-between px-6 py-4 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-yellow-500" />
            Como funciona o sorteio? (Loteria Federal)
          </span>
          {faqOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {faqOpen && (
          <div className="px-6 pb-6 space-y-4 text-sm text-zinc-400">
            <div className="bg-zinc-900 rounded-xl p-4 space-y-3 border border-white/5">
              <p className="text-white font-semibold">Transparência 100% verificável</p>
              <p>
                O número vencedor é determinado pelo resultado oficial da{' '}
                <strong className="text-yellow-400">Loteria Federal da Caixa</strong> —
                ninguém controla o resultado.
              </p>

              <div className="bg-zinc-800 rounded-lg p-3 space-y-2">
                <p className="text-zinc-300 font-medium text-xs uppercase tracking-wider">
                  Fórmula
                </p>
                <div className="font-mono text-sm space-y-1">
                  <p className="text-zinc-300">1. Pegamos os <span className="text-yellow-400">2 últimos dígitos</span> do 1º Prêmio</p>
                  <p className="text-zinc-300">2. Calculamos: <span className="text-yellow-400">(últimos2 % total_cotas) + 1</span></p>
                </div>
                <div className="border-t border-white/5 pt-2 text-zinc-500 text-xs">
                  Exemplo: 1º Prêmio <span className="text-white">097680</span> → últimos2 = <span className="text-white">80</span>
                  {' '}→ (80 % {raffle.total_numbers}) + 1 = <span className="text-yellow-400 font-bold">{(80 % raffle.total_numbers) + 1}</span>
                </div>
              </div>

              <a
                href="https://loterias.caixa.gov.br/Paginas/Federal.aspx"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-yellow-500 hover:text-yellow-400 text-xs"
              >
                <ExternalLink className="w-3 h-3" />
                Verificar resultados no site da Caixa
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
