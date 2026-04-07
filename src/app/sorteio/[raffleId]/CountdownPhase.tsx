'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChevronDown, ChevronUp, Shield, ExternalLink } from 'lucide-react';

// ─── Roulette constants (standard European layout) ────────────────────────
const SEQ = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const REDS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const N = SEQ.length; // 37
const SEG = 360 / N;

function segColor(n: number) {
  if (n === 0) return '#15803d';
  return REDS.has(n) ? '#991b1b' : '#0c0c0c';
}

const WHEEL_BG = `conic-gradient(from 0deg, ${SEQ.map((n, i) =>
  `${segColor(n)} ${(i * SEG).toFixed(3)}deg ${((i + 1) * SEG).toFixed(3)}deg`
).join(',')})`;

// ─── Props ────────────────────────────────────────────────────────────────
interface CountdownPhaseProps {
  raffle: { id: string; title: string; image_url: string; total_numbers: number };
  drawAt: string;
  onCountdownEnd: () => void;
  onDrawComplete: () => void;
  drawError?: string | null;
  winnerNumber?: number | null;
}

function fmt(ms: number) {
  if (ms <= 0) return '00:00';
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ─── Component ────────────────────────────────────────────────────────────
export function CountdownPhase({
  raffle, drawAt, onCountdownEnd, onDrawComplete, drawError, winnerNumber,
}: CountdownPhaseProps) {
  const [timeLeft, setTimeLeft]   = useState(() => Math.max(0, new Date(drawAt).getTime() - Date.now()));
  const [viewers, setViewers]     = useState(1);
  const [faqOpen, setFaqOpen]     = useState(false);

  // Roulette
  const [wheelAngle, setWheelAngle]       = useState(0);
  const [centerDisplay, setCenterDisplay] = useState<string | number>('?');
  const [spinState, setSpinState]         = useState<'idle'|'waiting'|'spinning'|'stopped'>('idle');
  const [ballAngle, setBallAngle]         = useState(0);

  const rafRef       = useRef<number | null>(null);
  const angleRef     = useRef(0);
  const ballRef      = useRef(0);
  const endCalled    = useRef(false);
  const spinStarted  = useRef(false);

  // ── Countdown tick ──────────────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      const rem = Math.max(0, new Date(drawAt).getTime() - Date.now());
      setTimeLeft(rem);
      if (rem === 0 && !endCalled.current) {
        endCalled.current = true;
        setSpinState('waiting');
        onCountdownEnd();
      }
    }, 500);
    return () => clearInterval(iv);
  }, [drawAt, onCountdownEnd]);

  // ── Kick spin when winnerNumber arrives ─────────────────────────────────
  useEffect(() => {
    if (winnerNumber == null || spinStarted.current) return;
    if (spinState !== 'waiting' && spinState !== 'idle') return;
    spinStarted.current = true;
    setSpinState('spinning');
  }, [winnerNumber, spinState]);

  // ── Wheel + ball animation ───────────────────────────────────────────────
  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (spinState === 'idle') {
      const tick = () => {
        angleRef.current += 0.03;
        ballRef.current  -= 0.05;
        setWheelAngle(angleRef.current);
        setBallAngle(ballRef.current);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }

    if (spinState === 'waiting') {
      const tick = () => {
        angleRef.current += 0.09;
        ballRef.current  -= 0.18;
        setWheelAngle(angleRef.current);
        setBallAngle(ballRef.current);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }

    if (spinState === 'spinning' && winnerNumber != null) {
      const segIdx     = winnerNumber % N;
      const segCenter  = (segIdx + 0.5) * SEG;
      const targetMod  = (360 - segCenter + 360) % 360;
      const currentMod = ((angleRef.current % 360) + 360) % 360;
      const extraFwd   = (targetMod - currentMod + 360) % 360;
      const totalSpin  = 8 * 360 + extraFwd;
      const startAngle = angleRef.current;
      const startBall  = ballRef.current;
      const totalBall  = -(8 * 360 * 1.6 + extraFwd * 1.6);
      const t0 = performance.now();
      const DURATION = 6000;

      let numIv = setInterval(() => {
        setCenterDisplay(Math.floor(Math.random() * raffle.total_numbers) + 1);
      }, 60);

      const tick = (now: number) => {
        const elapsed = Math.min(now - t0, DURATION);
        const p = elapsed / DURATION;
        const e = 1 - Math.pow(1 - p, 5); // ease-out quint

        angleRef.current = startAngle + e * totalSpin;
        ballRef.current  = startBall  + e * totalBall;
        setWheelAngle(angleRef.current);
        setBallAngle(ballRef.current);

        if (elapsed < DURATION) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          clearInterval(numIv);
          setCenterDisplay(winnerNumber);
          setSpinState('stopped');
          setTimeout(onDrawComplete, 3500);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        clearInterval(numIv);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinState]);

  // ── Presence (viewers) ──────────────────────────────────────────────────
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

  const isUrgent = timeLeft < 60_000;
  const isStopped = spinState === 'stopped';

  // Ball position on inner track (r=108 from center of 280px wheel)
  const ballR   = 108;
  const ballRad = (ballAngle * Math.PI) / 180;
  const ballX   = 140 + ballR * Math.sin(ballRad);
  const ballY   = 140 - ballR * Math.cos(ballRad);

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
      <main className="flex-1 flex flex-col items-center justify-center px-4 gap-6 py-6">

        {/* Title */}
        <div className="text-center">
          <h1 className="text-lg font-bold text-white leading-tight">{raffle.title}</h1>
          <p className="text-zinc-600 text-xs mt-0.5">{raffle.total_numbers} cotas</p>
        </div>

        {/* ── Roulette Wheel ── */}
        <div className="relative" style={{ width: 280, height: 280 }}>

          {/* Pointer (triangle at top, outside wheel) */}
          <div
            className="absolute z-20"
            style={{
              top: -10,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0, height: 0,
              borderLeft: '9px solid transparent',
              borderRight: '9px solid transparent',
              borderTop: '18px solid #eab308',
              filter: isStopped ? 'drop-shadow(0 0 8px #eab308)' : 'none',
              transition: 'filter 0.5s',
            }}
          />

          {/* Gold outer rim */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              padding: 5,
              background: isStopped
                ? 'conic-gradient(from 0deg, #eab308, #fbbf24, #b45309, #fde68a, #eab308)'
                : 'conic-gradient(from 0deg, #57534e, #a8a29e, #44403c, #78716c, #57534e)',
              boxShadow: isStopped
                ? '0 0 50px rgba(234,179,8,0.7), 0 0 100px rgba(234,179,8,0.3)'
                : spinState === 'spinning'
                ? '0 0 15px rgba(234,179,8,0.15)'
                : 'none',
              transition: 'background 1s, box-shadow 1s',
            }}
          >
            {/* ── The actual wheel ── */}
            <div
              className="w-full h-full rounded-full relative"
              style={{
                background: WHEEL_BG,
                transform: `rotate(${wheelAngle}deg)`,
                willChange: 'transform',
              }}
            >
              {/* Segment dividers */}
              {SEQ.map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 left-1/2"
                  style={{
                    width: 1,
                    height: '50%',
                    background: 'rgba(255,255,255,0.18)',
                    transformOrigin: '50% 100%',
                    transform: `translateX(-50%) rotate(${i * SEG}deg)`,
                  }}
                />
              ))}

              {/* Number labels */}
              {SEQ.map((num, i) => {
                const angleDeg = (i + 0.5) * SEG;
                const rad = (angleDeg - 90) * (Math.PI / 180);
                const r = 108;
                const cx = 135, cy = 135;
                const x = cx + r * Math.cos(rad);
                const y = cy + r * Math.sin(rad);
                return (
                  <div
                    key={`lbl-${i}`}
                    className="absolute text-white font-bold select-none"
                    style={{
                      fontSize: 8,
                      lineHeight: 1,
                      left: x,
                      top: y,
                      transform: `translate(-50%,-50%) rotate(${angleDeg}deg)`,
                      textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                    }}
                  >
                    {num}
                  </div>
                );
              })}
            </div>
          </div>

          {/* SVG overlay for the ball */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={280}
            height={280}
            style={{ zIndex: 15 }}
          >
            {/* Ball glow */}
            {isStopped && (
              <circle cx={ballX} cy={ballY} r={10} fill="rgba(234,179,8,0.3)" />
            )}
            {/* Ball */}
            <circle
              cx={ballX}
              cy={ballY}
              r={isStopped ? 8 : 6}
              fill={isStopped ? '#eab308' : 'white'}
              style={{
                filter: isStopped
                  ? 'drop-shadow(0 0 6px #eab308) drop-shadow(0 0 12px #eab308)'
                  : 'drop-shadow(0 2px 3px rgba(0,0,0,0.8))',
                transition: 'r 0.3s, fill 0.3s, filter 0.3s',
              }}
            />
          </svg>

          {/* Center hub */}
          <div
            className="absolute rounded-full flex items-center justify-center"
            style={{
              width: 86,
              height: 86,
              top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              background: 'radial-gradient(circle at 35% 30%, #3f3f46, #0a0a0a)',
              border: `3px solid ${isStopped ? '#eab308' : '#27272a'}`,
              boxShadow: isStopped
                ? '0 0 24px rgba(234,179,8,0.6), inset 0 0 16px rgba(0,0,0,0.8)'
                : 'inset 0 0 16px rgba(0,0,0,0.8)',
              zIndex: 20,
              transition: 'border-color 0.6s, box-shadow 0.6s',
            }}
          >
            <span
              className="font-black font-mono tabular-nums"
              style={{
                fontSize: String(centerDisplay).length > 4 ? 13 : String(centerDisplay).length > 2 ? 17 : 22,
                color: isStopped ? '#eab308' : '#71717a',
                textShadow: isStopped ? '0 0 14px rgba(234,179,8,0.8)' : 'none',
                transition: 'color 0.4s, text-shadow 0.4s',
              }}
            >
              {spinState === 'waiting' ? '•••' : centerDisplay}
            </span>
          </div>
        </div>

        {/* ── Status / Countdown ── */}
        {isStopped && winnerNumber != null ? (
          <div className="text-center space-y-1">
            <p className="text-yellow-400 text-2xl font-black">🏆 #{winnerNumber}</p>
            <p className="text-zinc-500 text-xs">Abrindo comprovante...</p>
          </div>
        ) : spinState === 'spinning' ? (
          <p className="text-zinc-400 text-sm animate-pulse tracking-wide">Revelando o número vencedor...</p>
        ) : spinState === 'waiting' ? (
          <p className="text-zinc-500 text-sm animate-pulse">Buscando resultado da Loteria Federal...</p>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs uppercase tracking-widest text-zinc-600">Sorteio em</p>
            <div
              className={`font-black font-mono tabular-nums transition-colors duration-500 ${
                isUrgent ? 'text-red-400' : 'text-white'
              }`}
              style={{ fontSize: 'clamp(56px, 14vw, 88px)', fontFamily: 'var(--font-bebas-neue)' }}
            >
              {fmt(timeLeft)}
            </div>
            <p className="text-zinc-700 text-xs">{new Date(drawAt).toLocaleString('pt-BR')}</p>
            {drawError && (
              <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-center max-w-xs">
                <p className="text-red-400 text-sm font-semibold">Erro no sorteio</p>
                <p className="text-red-300/70 text-xs mt-0.5">{drawError}</p>
              </div>
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
                  {' '}→ (80 % {raffle.total_numbers}) + 1 ={' '}
                  <span className="text-yellow-400 font-bold">{(80 % raffle.total_numbers) + 1}</span>
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
