'use client';

import { useEffect, useState, useRef } from 'react';
import { Trophy } from 'lucide-react';

interface RoulettePhaseProps {
  totalNumbers: number;
  winnerNumber: number;
  isResultReady: boolean;  // true quando Realtime confirmou resultado
  onAnimationEnd: () => void;
}

export function RoulettePhase({
  totalNumbers,
  winnerNumber,
  isResultReady,
  onAnimationEnd,
}: RoulettePhaseProps) {
  const [displayNumber, setDisplayNumber] = useState<number | null>(null);
  const [stopped, setStopped] = useState(false);
  const [spinSpeed, setSpinSpeed] = useState<'fast' | 'medium' | 'slow' | 'stopped'>('fast');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    // Só inicia a animação quando o resultado estiver disponível
    if (!isResultReady || startedRef.current) return;
    startedRef.current = true;

    const TOTAL_DURATION = 5000; // 5 segundos
    let elapsed = 0;

    const spin = () => {
      if (elapsed >= TOTAL_DURATION) {
        setDisplayNumber(winnerNumber);
        setStopped(true);
        setSpinSpeed('stopped');
        timeoutRef.current = setTimeout(onAnimationEnd, 2500);
        return;
      }

      const progress = elapsed / TOTAL_DURATION;
      // Desaceleração exponencial: rápido no início, lento no fim
      const intervalMs = 60 + Math.pow(progress, 2) * 940;

      // Atualiza indicador de velocidade para efeitos visuais
      if (progress < 0.4) setSpinSpeed('fast');
      else if (progress < 0.7) setSpinSpeed('medium');
      else setSpinSpeed('slow');

      setDisplayNumber(Math.floor(Math.random() * totalNumbers) + 1);
      elapsed += intervalMs;
      timeoutRef.current = setTimeout(spin, intervalMs);
    };

    timeoutRef.current = setTimeout(spin, 60);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isResultReady, winnerNumber, totalNumbers, onAnimationEnd]);

  const blurClass =
    spinSpeed === 'fast'
      ? '[filter:blur(1.5px)]'
      : spinSpeed === 'medium'
      ? '[filter:blur(0.5px)]'
      : '';

  const digitCount = String(totalNumbers).length;
  const paddedNumber =
    displayNumber !== null
      ? String(displayNumber).padStart(digitCount, '0')
      : '·'.repeat(digitCount);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center gap-8 relative overflow-hidden">

      {/* Scanline overlay — CRT texture */}
      <div
        className="pointer-events-none absolute inset-0 z-10 opacity-[0.03]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,1) 2px, rgba(255,255,255,1) 4px)',
        }}
      />

      {/* Ambient background glow when stopped */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-1000 ${
          stopped ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(234,179,8,0.08) 0%, transparent 70%)',
        }}
      />

      {/* Spinning ambient particles when active */}
      {isResultReady && !stopped && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white/20 rounded-full"
              style={{
                left: `${15 + i * 14}%`,
                top: `${20 + (i % 3) * 25}%`,
                animation: `ping ${0.8 + i * 0.3}s cubic-bezier(0,0,0.2,1) infinite`,
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Header ao vivo */}
      <div className="flex items-center gap-2 z-20">
        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        <span className="text-xs text-red-400 font-semibold uppercase tracking-wider">
          Sorteando ao Vivo
        </span>
      </div>

      {/* Display do número — slot machine frame */}
      <div className="z-20 flex flex-col items-center gap-0">
        {/* Top label strip */}
        <div
          className={`w-64 flex items-center justify-center py-1.5 rounded-t-2xl text-[10px] font-bold uppercase tracking-[0.25em] transition-all duration-700 ${
            stopped
              ? 'bg-yellow-400 text-zinc-900'
              : 'bg-white/5 text-zinc-600'
          }`}
        >
          {stopped ? 'NÚMERO SORTEADO' : 'SORTEANDO'}
        </div>

        {/* Main number box */}
        <div
          className={`relative flex items-center justify-center w-64 h-52 border-x-4 transition-all duration-700 ${
            stopped
              ? 'border-yellow-400 bg-zinc-900 shadow-[0_0_80px_rgba(234,179,8,0.35),inset_0_0_40px_rgba(234,179,8,0.08)]'
              : 'border-white/10 bg-white/5'
          }`}
        >
          {/* Inner scanline accent lines */}
          <div className="absolute inset-x-0 top-0 h-px bg-white/5" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-white/5" />

          {/* Speed indicator bars on sides */}
          {!stopped && isResultReady && (
            <>
              <div
                className={`absolute left-3 top-1/2 -translate-y-1/2 w-0.5 rounded-full transition-all duration-300 ${
                  spinSpeed === 'fast'
                    ? 'h-16 bg-white/40'
                    : spinSpeed === 'medium'
                    ? 'h-10 bg-white/25'
                    : 'h-5 bg-white/15'
                }`}
              />
              <div
                className={`absolute right-3 top-1/2 -translate-y-1/2 w-0.5 rounded-full transition-all duration-300 ${
                  spinSpeed === 'fast'
                    ? 'h-16 bg-white/40'
                    : spinSpeed === 'medium'
                    ? 'h-10 bg-white/25'
                    : 'h-5 bg-white/15'
                }`}
              />
            </>
          )}

          {/* Trophy icon when stopped */}
          {stopped && (
            <Trophy className="absolute top-3 right-3 w-7 h-7 text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
          )}

          {/* The number itself */}
          <span
            className={`font-black font-mono tabular-nums select-none transition-all duration-500 ${blurClass} ${
              stopped
                ? 'text-[5.5rem] text-yellow-400 scale-110 drop-shadow-[0_0_20px_rgba(234,179,8,0.6)]'
                : 'text-[4.5rem] text-white'
            }`}
            style={{ letterSpacing: '0.04em', lineHeight: 1 }}
          >
            {paddedNumber}
          </span>

          {/* Reel mask gradient — top/bottom fade like a real slot machine window */}
          {!stopped && (
            <>
              <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-zinc-950 to-transparent pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none" />
            </>
          )}
        </div>

        {/* Bottom label strip */}
        <div
          className={`w-64 flex items-center justify-center py-1.5 rounded-b-2xl text-[10px] font-mono tracking-[0.15em] transition-all duration-700 ${
            stopped
              ? 'bg-yellow-400/20 text-yellow-300 border border-t-0 border-yellow-400/40'
              : 'bg-white/5 text-zinc-700 border border-t-0 border-white/5'
          }`}
        >
          {stopped
            ? `COTA Nº ${String(winnerNumber).padStart(digitCount, '0')}`
            : `1 – ${totalNumbers}`}
        </div>
      </div>

      {/* Status */}
      <div className="text-center z-20 min-h-[4rem] flex flex-col items-center justify-center">
        {!isResultReady && (
          <p className="text-zinc-500 text-sm animate-pulse">
            Buscando resultado da Loteria Federal...
          </p>
        )}
        {isResultReady && !stopped && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-zinc-400 text-sm">Revelando o número sorteado...</p>
            {/* Speed dots */}
            <div className="flex gap-1.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                    spinSpeed === 'fast'
                      ? 'bg-white/70'
                      : spinSpeed === 'medium' && i < 3
                      ? 'bg-white/50'
                      : spinSpeed === 'slow' && i < 1
                      ? 'bg-white/30'
                      : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
        {stopped && (
          <div className="space-y-1">
            <p className="text-yellow-400 text-2xl font-bold">
              Número Sorteado!
            </p>
            <p className="text-zinc-500 text-xs">Aguarde o comprovante...</p>
          </div>
        )}
      </div>
    </div>
  );
}
