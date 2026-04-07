'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChevronDown, ChevronUp, Shield, ExternalLink, RefreshCw } from 'lucide-react';

// ─── SVG wheel helpers ────────────────────────────────────────────────────
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function sector(cx: number, cy: number, r: number, a1: number, a2: number) {
  const s = polar(cx, cy, r, a1);
  const e = polar(cx, cy, r, a2);
  const lg = a2 - a1 > 180 ? 1 : 0;
  return `M${cx},${cy} L${s.x.toFixed(2)},${s.y.toFixed(2)} A${r},${r},0,${lg},1,${e.x.toFixed(2)},${e.y.toFixed(2)}Z`;
}

// ─── Props ────────────────────────────────────────────────────────────────
interface CountdownPhaseProps {
  raffle: { id: string; title: string; image_url: string; total_numbers: number };
  drawAt: string;
  onCountdownEnd: () => void;
  onDrawComplete: () => void;
  drawError?: string | null;
  winnerNumber?: number | null;
  targetConcurso?: number;
  /** DEBUG ONLY — remove before production */
  onForceStart?: () => void;
}

function fmt(ms: number) {
  if (ms <= 0) return '00:00';
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ─── Component ────────────────────────────────────────────────────────────
export function CountdownPhase({
  raffle, drawAt, onCountdownEnd, onDrawComplete, drawError, winnerNumber, targetConcurso, onForceStart,
}: CountdownPhaseProps) {
  const N = raffle.total_numbers;
  const SEG = 360 / N;

  const [timeLeft, setTimeLeft]   = useState(() => Math.max(0, new Date(drawAt).getTime() - Date.now()));
  const [viewers, setViewers]     = useState(1);
  const [faqOpen, setFaqOpen]     = useState(false);

  // Roulette
  const [wheelAngle, setWheelAngle]       = useState(0);
  const [centerDisplay, setCenterDisplay] = useState<string | number>('?');
  const [spinState, setSpinState]         = useState<'idle'|'waiting'|'spinning'|'stopped'|'error'|'polling'>('idle');
  const [stoppedAt, setStoppedAt]         = useState<number | null>(null); // winner segment index

  const [pollCountdown, setPollCountdown] = useState(60);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const rafRef      = useRef<number | null>(null);
  const angleRef    = useRef(0);
  const endCalled   = useRef(false);
  const spinStarted = useRef(false);

  const stopAnim = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Show error / polling when result not yet available ────────────────────
  useEffect(() => {
    if (drawError === 'CONCURSO_NOT_AVAILABLE' && spinState === 'waiting') {
      setSpinState('polling');
      setPollCountdown(60);
    } else if (drawError && drawError !== 'CONCURSO_NOT_AVAILABLE' && spinState === 'waiting') {
      setSpinState('error');
    }
  }, [drawError, spinState]);

  // ── Polling auto-retry countdown ──────────────────────────────────────────
  useEffect(() => {
    if (spinState !== 'polling') {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    pollIntervalRef.current = setInterval(() => {
      setPollCountdown(prev => {
        if (prev <= 1) {
          clearInterval(pollIntervalRef.current!);
          setSpinState('waiting');
          onCountdownEnd();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [spinState, onCountdownEnd]);

  // ── Countdown tick ───────────────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      const rem = Math.max(0, new Date(drawAt).getTime() - Date.now());
      setTimeLeft(rem);
      if (rem === 0 && !endCalled.current && spinState === 'idle') {
        endCalled.current = true;
        setSpinState('waiting');
        onCountdownEnd();
      }
    }, 500);
    return () => clearInterval(iv);
  }, [drawAt, onCountdownEnd, spinState]);

  // ── Kick spin when winner arrives ────────────────────────────────────────
  useEffect(() => {
    if (winnerNumber == null || spinStarted.current) return;
    if (spinState !== 'waiting') return;
    spinStarted.current = true;
    setSpinState('spinning');
  }, [winnerNumber, spinState]);

  // ── Wheel animation ──────────────────────────────────────────────────────
  useEffect(() => {
    stopAnim();

    if (spinState === 'idle' || spinState === 'waiting' || spinState === 'error' || spinState === 'polling') {
      const speed = (spinState === 'waiting' || spinState === 'polling') ? 0.08 : spinState === 'error' ? 0 : 0.025;
      if (speed === 0) return;
      const tick = () => {
        angleRef.current += speed;
        setWheelAngle(angleRef.current);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => stopAnim();
    }

    if (spinState === 'spinning' && winnerNumber != null) {
      // Target: bring center of winner segment to top (pointer at 0°)
      const segCenter  = (winnerNumber - 1 + 0.5) * SEG;
      const targetMod  = (360 - segCenter % 360 + 360) % 360;
      const currentMod = ((angleRef.current % 360) + 360) % 360;
      const extraFwd   = (targetMod - currentMod + 360) % 360;
      const totalSpin  = 10 * 360 + extraFwd;
      const startAngle = angleRef.current;
      const t0 = performance.now();
      const DURATION = 5500;

      let numIv = setInterval(() => {
        setCenterDisplay(Math.floor(Math.random() * N) + 1);
      }, 55);

      const tick = (now: number) => {
        const elapsed = Math.min(now - t0, DURATION);
        const p = elapsed / DURATION;
        const e = 1 - Math.pow(1 - p, 5); // ease-out quint
        angleRef.current = startAngle + e * totalSpin;
        setWheelAngle(angleRef.current);

        if (elapsed < DURATION) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          clearInterval(numIv);
          setCenterDisplay(winnerNumber);
          setStoppedAt(winnerNumber);
          setSpinState('stopped');
          setTimeout(onDrawComplete, 4000);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => { stopAnim(); clearInterval(numIv); };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinState]);

  // ── Presence ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel(`presence:${raffle.id}`, {
      config: { presence: { key: crypto.randomUUID() } },
    });
    ch.on('presence', { event: 'sync' }, () =>
      setViewers(Object.keys(ch.presenceState()).length)
    ).subscribe(async (s) => {
      if (s === 'SUBSCRIBED') await ch.track({ online_at: new Date().toISOString() });
    });
    return () => { supabase.removeChannel(ch); };
  }, [raffle.id]);

  // ── Retry ─────────────────────────────────────────────────────────────────
  const handleRetry = () => {
    setSpinState('waiting');
    endCalled.current = true;
    spinStarted.current = false;
    onCountdownEnd();
  };

  const isUrgent = timeLeft < 60_000;
  const isStopped = spinState === 'stopped';
  const CX = 140, CY = 140, R = 128, RLABEL = 100, HUB = 52;

  // ── Wheel SVG ─────────────────────────────────────────────────────────────
  const wheelSegments = Array.from({ length: N }, (_, i) => {
    const num     = i + 1;
    const a1      = i * SEG;
    const a2      = (i + 1) * SEG;
    const isWinner = isStopped && stoppedAt === num;
    const fill    = isWinner ? '#eab308' : (i % 2 === 0 ? '#18181b' : '#1f1f23');
    const labelColor = isWinner ? '#000' : '#a1a1aa';

    // Label position — center of segment arc at RLABEL
    const midAngle = (a1 + a2) / 2;
    const lp = polar(CX, CY, RLABEL, midAngle);
    const fontSize = N <= 10 ? 14 : N <= 30 ? 10 : N <= 60 ? 7 : 5;

    return { num, a1, a2, fill, labelColor, lp, midAngle, fontSize };
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs text-red-400 font-semibold uppercase tracking-wider">Ao Vivo</span>
        </div>
        <span className="text-xs text-zinc-500">{viewers} assistindo</span>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 gap-5 py-6">

        {/* Title */}
        <div className="text-center">
          <h1 className="text-xl font-bold text-white">{raffle.title}</h1>
          <p className="text-zinc-600 text-xs mt-0.5">{N} cotas</p>
        </div>

        {/* ── Roulette ── */}
        <div className="relative flex items-center justify-center">

          {/* Yellow pointer at top */}
          <div
            className="absolute z-20"
            style={{
              top: -12, left: '50%',
              transform: 'translateX(-50%)',
              width: 0, height: 0,
              borderLeft: '10px solid transparent',
              borderRight: '10px solid transparent',
              borderTop: `20px solid ${isStopped ? '#eab308' : '#713f12'}`,
              filter: isStopped ? 'drop-shadow(0 0 10px #eab308)' : 'none',
              transition: 'border-top-color 0.6s, filter 0.6s',
            }}
          />

          {/* Outer ring */}
          <div
            className="rounded-full"
            style={{
              padding: 4,
              background: isStopped
                ? 'linear-gradient(135deg,#eab308,#fbbf24,#92400e,#fbbf24)'
                : 'linear-gradient(135deg,#3f3f46,#52525b,#27272a,#52525b)',
              boxShadow: isStopped
                ? '0 0 40px rgba(234,179,8,0.55), 0 0 80px rgba(234,179,8,0.2)'
                : spinState === 'spinning'
                ? '0 0 12px rgba(234,179,8,0.1)'
                : 'none',
              transition: 'background 0.8s, box-shadow 0.8s',
            }}
          >
            {/* SVG wheel */}
            <svg
              width={280}
              height={280}
              viewBox="0 0 280 280"
              style={{ transform: `rotate(${wheelAngle}deg)`, display: 'block', willChange: 'transform' }}
            >
              {/* Segments */}
              {wheelSegments.map(({ num, a1, a2, fill }) => (
                <path
                  key={num}
                  d={sector(CX, CY, R, a1, a2)}
                  fill={fill}
                  stroke="#0a0a0a"
                  strokeWidth={0.8}
                />
              ))}

              {/* Labels — only if not too many */}
              {N <= 120 && wheelSegments.map(({ num, lp, midAngle, labelColor, fontSize }) => (
                <text
                  key={`t${num}`}
                  x={lp.x}
                  y={lp.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={labelColor}
                  fontSize={fontSize}
                  fontWeight="700"
                  fontFamily="monospace"
                  transform={`rotate(${midAngle},${lp.x},${lp.y})`}
                >
                  {num}
                </text>
              ))}
            </svg>
          </div>

          {/* Center hub — sits above SVG */}
          <div
            className="absolute rounded-full flex items-center justify-center"
            style={{
              width: HUB * 2,
              height: HUB * 2,
              background: 'radial-gradient(circle at 35% 30%, #27272a, #09090b)',
              border: `2.5px solid ${isStopped ? '#eab308' : '#3f3f46'}`,
              boxShadow: isStopped
                ? '0 0 20px rgba(234,179,8,0.5), inset 0 2px 12px rgba(0,0,0,0.7)'
                : 'inset 0 2px 12px rgba(0,0,0,0.7)',
              zIndex: 10,
              transition: 'border-color 0.5s, box-shadow 0.5s',
            }}
          >
            <span
              className="font-black font-mono tabular-nums"
              style={{
                fontSize: String(centerDisplay).length > 4 ? 12 : String(centerDisplay).length > 3 ? 15 : 20,
                color: isStopped ? '#eab308' : '#52525b',
                textShadow: isStopped ? '0 0 12px rgba(234,179,8,0.7)' : 'none',
                transition: 'color 0.3s, text-shadow 0.3s',
              }}
            >
              {(spinState === 'waiting' || spinState === 'polling') ? '···' : spinState === 'error' ? '!' : centerDisplay}
            </span>
          </div>
        </div>

        {/* ── Status section ── */}
        {isStopped && winnerNumber != null ? (
          <div className="text-center space-y-1 py-2">
            <p className="text-yellow-400 text-3xl font-black">🏆 #{winnerNumber}</p>
            <p className="text-zinc-500 text-xs">Abrindo comprovante...</p>
          </div>

        ) : spinState === 'spinning' ? (
          <p className="text-zinc-400 text-sm animate-pulse tracking-wide">Revelando o número vencedor...</p>

        ) : spinState === 'polling' ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-8 h-8 rounded-full border-2 border-yellow-400/30 border-t-yellow-400 animate-spin" />
            <p className="text-yellow-300 font-semibold text-sm text-center">
              Aguardando resultado do Concurso {targetConcurso ?? ''}
            </p>
            <p className="text-zinc-500 text-xs text-center">
              A Loteria Federal ainda não publicou o resultado.<br />
              Próxima verificação em{' '}
              <span className="text-zinc-300 font-mono">{pollCountdown}s</span>
            </p>
          </div>

        ) : spinState === 'error' ? (
          <div className="flex flex-col items-center gap-3 max-w-xs text-center">
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4 w-full">
              <p className="text-red-400 font-semibold text-sm">Erro no sorteio</p>
              <p className="text-red-300/70 text-xs mt-1">{drawError}</p>
            </div>
            <button
              onClick={handleRetry}
              className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg px-4 py-2 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Tentar novamente
            </button>
          </div>

        ) : spinState === 'waiting' ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-zinc-500 text-sm animate-pulse">Buscando resultado da Loteria Federal...</p>
            {drawError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-center max-w-xs">
                <p className="text-red-400 text-xs font-semibold">Erro: {drawError}</p>
              </div>
            )}
          </div>

        ) : (
          /* Countdown */
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-xs uppercase tracking-widest text-zinc-600">Sorteio em</p>
            <div
              className={`font-black font-mono tabular-nums transition-colors duration-500 ${isUrgent ? 'text-red-400' : 'text-white'}`}
              style={{ fontSize: 'clamp(52px,13vw,84px)', fontFamily: 'var(--font-bebas-neue)' }}
            >
              {fmt(timeLeft)}
            </div>
            <p className="text-zinc-700 text-xs">{new Date(drawAt).toLocaleString('pt-BR')}</p>
            {targetConcurso && ['idle', 'waiting', 'polling'].includes(spinState) && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800 border border-zinc-700/50 text-xs font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                <span className="text-zinc-400">Concurso</span>
                <span className="text-yellow-400 font-bold">{targetConcurso}</span>
                <span className="text-zinc-500">· Loteria Federal</span>
              </div>
            )}
            {onForceStart && spinState === 'idle' && (
              <button
                onClick={() => {
                  setSpinState('waiting');
                  endCalled.current = true;
                  spinStarted.current = false;
                  onForceStart();
                }}
                className="mt-4 px-5 py-2 rounded-lg border border-dashed border-yellow-500/40 text-yellow-400 text-xs font-semibold hover:bg-yellow-500/10 transition-colors"
              >
                ▶ Iniciar Sorteio (teste)
              </button>
            )}
          </div>
        )}
      </main>

      {/* FAQ */}
      <div className="border-t border-white/5">
        <button
          onClick={() => setFaqOpen(v => !v)}
          className="w-full flex items-center justify-between px-6 py-4 text-sm text-zinc-500 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-yellow-600" />
            Como funciona o sorteio? (Loteria Federal)
          </span>
          {faqOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {faqOpen && (
          <div className="px-6 pb-6 text-sm text-zinc-400">
            <div className="bg-zinc-900 rounded-xl p-4 space-y-3 border border-white/5">
              <p className="text-white font-semibold">Transparência 100% verificável</p>
              <p>
                O número vencedor é determinado pelo resultado oficial da{' '}
                <strong className="text-yellow-400">Loteria Federal da Caixa</strong> — ninguém controla o resultado.
              </p>
              <div className="bg-zinc-800 rounded-lg p-3 space-y-2">
                <p className="text-zinc-300 font-medium text-xs uppercase tracking-wider">Fórmula</p>
                <div className="font-mono text-sm space-y-1">
                  <p className="text-zinc-300">1. Pegamos os <span className="text-yellow-400">2 últimos dígitos</span> do 1º Prêmio</p>
                  <p className="text-zinc-300">2. Calculamos: <span className="text-yellow-400">(últimos2 % total_cotas) + 1</span></p>
                </div>
                <div className="border-t border-white/5 pt-2 text-zinc-500 text-xs">
                  Exemplo: 1º Prêmio <span className="text-white">097680</span> → últimos2 = <span className="text-white">80</span>
                  {' '}→ (80 % {N}) + 1 = <span className="text-yellow-400 font-bold">{(80 % N) + 1}</span>
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
