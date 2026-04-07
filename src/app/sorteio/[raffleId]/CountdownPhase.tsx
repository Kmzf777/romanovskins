'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ExternalLink, RefreshCw, Shield, ChevronDown, ChevronUp } from 'lucide-react';

// ─── SVG wheel helpers ────────────────────────────────────────────────────────
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

// ─── Props ────────────────────────────────────────────────────────────────────
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

// ─── Component ────────────────────────────────────────────────────────────────
export function CountdownPhase({
  raffle, drawAt, onCountdownEnd, onDrawComplete, drawError, winnerNumber, targetConcurso, onForceStart,
}: CountdownPhaseProps) {
  const N = raffle.total_numbers;
  const SEG = 360 / N;

  const [timeLeft, setTimeLeft]         = useState(() => Math.max(0, new Date(drawAt).getTime() - Date.now()));
  const [viewers, setViewers]           = useState(1);
  const [faqOpen, setFaqOpen]           = useState(false);
  const [showFlash, setShowFlash]       = useState(false);

  // Roulette
  const [wheelAngle, setWheelAngle]       = useState(0);
  const [centerDisplay, setCenterDisplay] = useState<string | number>('?');
  const [spinState, setSpinState]         = useState<'idle'|'waiting'|'spinning'|'stopped'|'error'|'polling'>('idle');
  const [stoppedAt, setStoppedAt]         = useState<number | null>(null);

  const [pollCountdown, setPollCountdown] = useState(60);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const rafRef      = useRef<number | null>(null);
  const angleRef    = useRef(0);
  const endCalled   = useRef(false);
  const spinStarted = useRef(false);

  const stopAnim = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Error / polling detection ────────────────────────────────────────────────
  useEffect(() => {
    if (drawError === 'CONCURSO_NOT_AVAILABLE' && spinState === 'waiting') {
      setSpinState('polling');
      setPollCountdown(60);
    } else if (drawError && drawError !== 'CONCURSO_NOT_AVAILABLE' && spinState === 'waiting') {
      setSpinState('error');
    }
  }, [drawError, spinState]);

  // ── Polling auto-retry countdown ─────────────────────────────────────────────
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
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  }, [spinState, onCountdownEnd]);

  // ── Countdown tick ───────────────────────────────────────────────────────────
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

  // ── Kick spin when winner arrives ────────────────────────────────────────────
  useEffect(() => {
    if (winnerNumber == null || spinStarted.current) return;
    if (spinState !== 'waiting') return;
    spinStarted.current = true;
    setSpinState('spinning');
  }, [winnerNumber, spinState]);

  // ── Wheel animation ──────────────────────────────────────────────────────────
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
          setShowFlash(true);
          setTimeout(() => setShowFlash(false), 1500);
          setTimeout(onDrawComplete, 4000);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => { stopAnim(); clearInterval(numIv); };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinState]);

  // ── Presence ─────────────────────────────────────────────────────────────────
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

  // ── Retry ────────────────────────────────────────────────────────────────────
  const handleRetry = () => {
    setSpinState('waiting');
    endCalled.current = true;
    spinStarted.current = false;
    onCountdownEnd();
  };

  // ── Derived state ─────────────────────────────────────────────────────────────
  const isUrgent  = timeLeft < 60_000;
  const isStopped = spinState === 'stopped';
  const isSpinning = spinState === 'spinning';
  const isActive   = spinState === 'waiting' || spinState === 'spinning' || spinState === 'polling';

  const CX = 150, CY = 150, R = 128, RLABEL = 100, HUB = 54;

  const wheelSegments = Array.from({ length: N }, (_, i) => {
    const num      = i + 1;
    const a1       = i * SEG;
    const a2       = (i + 1) * SEG;
    const isWinner = isStopped && stoppedAt === num;
    const fill     = isWinner ? '#f97316' : (i % 2 === 0 ? '#0b0d18' : '#0f1220');
    const labelColor = isWinner ? '#000' : '#475569';
    const midAngle = (a1 + a2) / 2;
    const lp       = polar(CX, CY, RLABEL, midAngle);
    const fontSize = N <= 10 ? 13 : N <= 30 ? 9 : N <= 60 ? 6.5 : 4.5;
    return { num, a1, a2, fill, labelColor, lp, fontSize, isWinner };
  });

  const hubText = (spinState === 'waiting' || spinState === 'polling') ? '···'
    : spinState === 'error' ? '!'
    : String(centerDisplay);
  const hubFontSize = isStopped && winnerNumber != null
    ? (String(winnerNumber).length > 2 ? 22 : String(winnerNumber).length > 1 ? 28 : 36)
    : isSpinning ? 20 : 24;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Injected styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,600;0,700;0,800;1,700&family=JetBrains+Mono:wght@400;700&display=swap');

        .zr-root { font-family: 'Barlow Condensed', sans-serif; }

        @keyframes zr-live-ping {
          0%, 100% { transform: scale(1); opacity: 1; }
          60% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes zr-ring-breathe {
          0%, 100% { opacity: 0.25; }
          50% { opacity: 0.9; }
        }
        @keyframes zr-ember {
          0%   { transform: translateY(0) translateX(0) scale(1); opacity: 0.9; }
          50%  { opacity: 0.6; }
          100% { transform: translateY(-200px) translateX(var(--tx)) scale(0.1); opacity: 0; }
        }
        @keyframes zr-flash {
          0%   { opacity: 0; }
          8%   { opacity: 1; }
          30%  { opacity: 0; }
          45%  { opacity: 0.4; }
          70%  { opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes zr-winner-in {
          from { opacity: 0; transform: scale(0.6) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes zr-dots {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
          40%            { transform: scale(1.2); opacity: 1; }
        }
        @keyframes zr-spin-ring {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: -502; }
        }
        @keyframes zr-urgent-pulse {
          0%, 100% { text-shadow: 0 0 20px rgba(249,115,22,0.4); }
          50%       { text-shadow: 0 0 40px rgba(249,115,22,0.9), 0 0 80px rgba(249,115,22,0.3); }
        }
      `}</style>

      <div className="zr-root min-h-screen text-white flex flex-col relative overflow-hidden"
           style={{ background: '#04050a' }}>

        {/* ── Hex grid background ── */}
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="zr-hex" x="0" y="0" width="52" height="90" patternUnits="userSpaceOnUse">
                <path d="M26 1 L51 15 V60 L26 74 L1 60 V15 Z"
                      fill="none" stroke="#f97316" strokeWidth="0.6" opacity="0.07"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#zr-hex)"/>
          </svg>
          {/* Radial amber glow at wheel position */}
          <div className="absolute" style={{
            inset: 0,
            background: isActive
              ? 'radial-gradient(ellipse 70% 55% at 50% 38%, rgba(249,115,22,0.14) 0%, transparent 65%)'
              : isStopped
              ? 'radial-gradient(ellipse 70% 55% at 50% 38%, rgba(249,115,22,0.22) 0%, transparent 65%)'
              : 'radial-gradient(ellipse 60% 45% at 50% 38%, rgba(249,115,22,0.07) 0%, transparent 60%)',
            transition: 'background 1s ease',
          }}/>
          {/* Bottom fade */}
          <div className="absolute inset-x-0 bottom-0 h-48"
               style={{ background: 'linear-gradient(to top, #04050a, transparent)' }}/>
        </div>

        {/* ── Ember particles ── */}
        {isActive && Array.from({ length: 16 }, (_, i) => (
          <div key={i} className="absolute rounded-full pointer-events-none select-none"
               style={{
                 width: 1.5 + (i % 3),
                 height: 1.5 + (i % 3),
                 background: ['#f97316','#fbbf24','#fb923c','#fed7aa'][i % 4],
                 left: `${15 + (i * 43) % 70}%`,
                 bottom: `${15 + (i * 17) % 35}%`,
                 '--tx': `${(i % 2 === 0 ? 1 : -1) * (10 + (i * 7) % 25)}px`,
                 animation: `zr-ember ${2.5 + (i % 5) * 0.7}s ease-out ${i * 0.35}s infinite`,
               } as React.CSSProperties}
          />
        ))}

        {/* ── Winner flash overlay ── */}
        {showFlash && (
          <div className="absolute inset-0 pointer-events-none z-50" style={{
            background: 'radial-gradient(ellipse 65% 55% at 50% 38%, rgba(249,115,22,0.55) 0%, transparent 70%)',
            animation: 'zr-flash 1.5s ease-out forwards',
          }}/>
        )}

        {/* ── Header ── */}
        <header className="relative z-10 flex items-center justify-between px-5 py-3.5"
                style={{
                  borderBottom: '1px solid rgba(249,115,22,0.07)',
                  background: 'rgba(4,5,10,0.85)',
                  backdropFilter: 'blur(16px)',
                }}>

          {/* LIVE badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
               style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-red-500"
                    style={{ animation: 'zr-live-ping 1.8s ease-in-out infinite', opacity: 0.7 }}/>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"/>
            </span>
            <span className="text-red-400 font-bold tracking-[0.18em] uppercase"
                  style={{ fontSize: 11 }}>AO VIVO</span>
          </div>

          {/* Brand */}
          <span className="absolute left-1/2 -translate-x-1/2 font-bold tracking-[0.25em] uppercase"
                style={{ fontSize: 11, color: 'rgba(249,115,22,0.4)' }}>
            Romanov Rifas
          </span>

          {/* Viewers */}
          <div className="flex items-center gap-1.5" style={{ color: '#2d3748', fontSize: 12 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span className="font-mono font-bold">{viewers}</span>
          </div>
        </header>

        {/* ── Main content ── */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-5 gap-4">

          {/* Title */}
          <div className="text-center">
            <h1 className="font-bold text-white/85 leading-tight" style={{ fontSize: 17 }}>
              {raffle.title}
            </h1>
            <p className="font-mono mt-0.5" style={{ fontSize: 11, color: '#1e293b' }}>
              {N} cotas · sorteio ao vivo
            </p>
          </div>

          {/* ══ ROULETTE WHEEL ══ */}
          <div className="relative flex items-center justify-center">

            {/* Glow halo behind wheel */}
            <div className="absolute rounded-full pointer-events-none" style={{
              width: 320, height: 320,
              boxShadow: isStopped
                ? '0 0 90px 30px rgba(249,115,22,0.3), 0 0 200px 60px rgba(249,115,22,0.1)'
                : isSpinning
                ? '0 0 50px 15px rgba(249,115,22,0.2)'
                : isActive
                ? '0 0 30px 8px rgba(249,115,22,0.12)'
                : '0 0 15px 4px rgba(249,115,22,0.05)',
              transition: 'box-shadow 1.2s ease',
              animation: isActive && !isStopped && !isSpinning
                ? 'zr-ring-breathe 2s ease-in-out infinite' : 'none',
            }}/>

            {/* SVG wheel */}
            <svg
              viewBox="0 0 300 300"
              width={300}
              height={300}
              style={{
                filter: isStopped
                  ? 'drop-shadow(0 0 24px rgba(249,115,22,0.45))'
                  : isSpinning
                  ? 'drop-shadow(0 0 14px rgba(249,115,22,0.28))'
                  : 'drop-shadow(0 0 6px rgba(249,115,22,0.1))',
                transition: 'filter 0.8s ease',
              }}
            >
              <defs>
                <filter id="zr-winner-glow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur"/>
                  <feMerge>
                    <feMergeNode in="blur"/>
                    <feMergeNode in="blur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <filter id="zr-hub-glow" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur"/>
                  <feMerge>
                    <feMergeNode in="blur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <radialGradient id="zr-base" cx="50%" cy="35%" r="70%">
                  <stop offset="0%" stopColor="#0f1220"/>
                  <stop offset="100%" stopColor="#04050a"/>
                </radialGradient>
                <radialGradient id="zr-hub" cx="40%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#1c2035"/>
                  <stop offset="100%" stopColor="#080b14"/>
                </radialGradient>
              </defs>

              {/* Base disc */}
              <circle cx={CX} cy={CY} r={R + 16} fill="url(#zr-base)"/>

              {/* Spinning wheel group */}
              <g transform={`rotate(${wheelAngle}, ${CX}, ${CY})`}>
                {wheelSegments.map(({ num, a1, a2, fill, labelColor, lp, fontSize, isWinner }) => (
                  <g key={num} filter={isWinner ? 'url(#zr-winner-glow)' : undefined}>
                    <path d={sector(CX, CY, R, a1, a2)} fill={fill} stroke="#04050a" strokeWidth="0.8"/>
                    {N <= 120 && (
                      <text
                        x={lp.x} y={lp.y}
                        textAnchor="middle" dominantBaseline="central"
                        fontSize={fontSize}
                        fontWeight={isWinner ? '800' : '700'}
                        fill={labelColor}
                        style={{ fontFamily: "'JetBrains Mono', monospace", userSelect: 'none' }}
                      >
                        {num}
                      </text>
                    )}
                  </g>
                ))}
                {/* Inner ring divider */}
                <circle cx={CX} cy={CY} r={R * 0.62} fill="none"
                        stroke="rgba(249,115,22,0.06)" strokeWidth="1"/>
              </g>

              {/* Static outer bezel rings */}
              <circle cx={CX} cy={CY} r={R + 1}  fill="none" stroke="rgba(249,115,22,0.2)" strokeWidth="2"/>
              <circle cx={CX} cy={CY} r={R + 9}  fill="none" stroke="rgba(249,115,22,0.07)" strokeWidth="1.5"/>
              <circle cx={CX} cy={CY} r={R + 14} fill="none" stroke="rgba(249,115,22,0.04)" strokeWidth="1"/>

              {/* Tick marks (24 around the rim) */}
              {Array.from({ length: 24 }, (_, i) => {
                const ang = (i * 15 - 90) * Math.PI / 180;
                const major = i % 6 === 0;
                const r1 = R + 2;
                const r2 = R + 2 + (major ? 8 : 4);
                return (
                  <line key={i}
                    x1={CX + r1 * Math.cos(ang)} y1={CY + r1 * Math.sin(ang)}
                    x2={CX + r2 * Math.cos(ang)} y2={CY + r2 * Math.sin(ang)}
                    stroke={major ? 'rgba(249,115,22,0.5)' : 'rgba(249,115,22,0.15)'}
                    strokeWidth={major ? 2 : 1}
                  />
                );
              })}

              {/* Animated dashed ring while spinning/waiting */}
              {isActive && (
                <circle cx={CX} cy={CY} r={R + 6}
                  fill="none"
                  stroke="rgba(249,115,22,0.4)"
                  strokeWidth="1.5"
                  strokeDasharray="8 10"
                  style={{ animation: 'zr-spin-ring 3s linear infinite' }}
                />
              )}

              {/* Center hub glow aura */}
              {isStopped && (
                <circle cx={CX} cy={CY} r={HUB + 16}
                  fill="rgba(249,115,22,0.08)"
                  filter="url(#zr-hub-glow)"/>
              )}

              {/* Center hub */}
              <circle cx={CX} cy={CY} r={HUB + 2}
                fill="rgba(249,115,22,0.06)"
                stroke={isStopped ? 'rgba(249,115,22,0.4)' : 'rgba(249,115,22,0.1)'}
                strokeWidth="1"
                style={{ transition: 'stroke 0.6s ease' }}/>
              <circle cx={CX} cy={CY} r={HUB}
                fill="url(#zr-hub)"
                stroke={isStopped ? 'rgba(249,115,22,0.6)' : 'rgba(249,115,22,0.15)'}
                strokeWidth="2"
                filter={isStopped ? 'url(#zr-hub-glow)' : undefined}
                style={{ transition: 'stroke 0.6s ease' }}/>
              <circle cx={CX} cy={CY} r={HUB - 12}
                fill="none"
                stroke="rgba(249,115,22,0.05)"
                strokeWidth="1"/>

              {/* Hub label */}
              <text
                x={CX} y={CY + 1}
                textAnchor="middle" dominantBaseline="central"
                fontSize={hubFontSize}
                fontWeight="800"
                fill={isStopped ? '#f97316' : isSpinning ? '#e2e8f0' : '#374151'}
                style={{
                  fontFamily: isStopped
                    ? 'var(--font-bebas-neue)'
                    : "'JetBrains Mono', monospace",
                  letterSpacing: isStopped ? '0.04em' : '0.02em',
                  transition: 'fill 0.4s ease',
                  userSelect: 'none',
                }}
              >
                {hubText}
              </text>
            </svg>

            {/* ── Blade pointer ── */}
            <div className="absolute z-20" style={{ top: -8, left: '50%', transform: 'translateX(-50%)' }}>
              <svg width="20" height="34" viewBox="0 0 20 34" overflow="visible">
                <defs>
                  <filter id="zr-ptr-glow" x="-80%" y="-40%" width="260%" height="180%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur"/>
                    <feMerge>
                      <feMergeNode in="blur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                {/* Shadow */}
                <path d="M10 34 L0 10 L10 0 L20 10 Z"
                      fill="rgba(0,0,0,0.6)"
                      transform="translate(2, 3)"/>
                {/* Main blade */}
                <path d="M10 34 L0 10 L10 0 L20 10 Z"
                      fill={isStopped ? '#f97316' : '#92400e'}
                      filter="url(#zr-ptr-glow)"
                      style={{ transition: 'fill 0.5s ease' }}/>
                {/* Highlight */}
                <path d="M10 28 L3 11 L10 3 L17 11 Z"
                      fill="rgba(255,255,255,0.12)"/>
                <line x1="10" y1="3" x2="10" y2="28"
                      stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
              </svg>
            </div>
          </div>

          {/* ══ STATUS SECTION ══ */}

          {isStopped && winnerNumber != null ? (
            /* Winner reveal */
            <div className="flex flex-col items-center gap-1 text-center"
                 style={{ animation: 'zr-winner-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}>
              <p className="font-bold uppercase tracking-[0.3em]"
                 style={{ fontSize: 11, color: 'rgba(249,115,22,0.6)' }}>
                Número Vencedor
              </p>
              <div className="font-black tabular-nums leading-none"
                   style={{
                     fontFamily: 'var(--font-bebas-neue)',
                     fontSize: 'clamp(56px, 14vw, 80px)',
                     color: '#f97316',
                     textShadow: '0 0 40px rgba(249,115,22,0.7), 0 0 80px rgba(249,115,22,0.3)',
                     letterSpacing: '0.06em',
                   }}>
                #{winnerNumber}
              </div>
              <p className="text-xs tracking-widest" style={{ color: '#1e293b' }}>
                Abrindo comprovante...
              </p>
            </div>

          ) : isSpinning ? (
            /* Spinning */
            <div className="flex flex-col items-center gap-3">
              <p className="font-bold uppercase tracking-[0.22em] animate-pulse"
                 style={{ fontSize: 13, color: '#f97316', letterSpacing: '0.25em' }}>
                Revelando vencedor
              </p>
              <div className="flex gap-2">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full"
                       style={{
                         background: '#f97316',
                         animation: `zr-dots 1s ease-in-out ${i * 0.2}s infinite`,
                       }}/>
                ))}
              </div>
            </div>

          ) : spinState === 'polling' ? (
            /* Polling */
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-8 h-8 rounded-full border-2 animate-spin"
                   style={{
                     borderColor: 'rgba(249,115,22,0.2)',
                     borderTopColor: '#f97316',
                   }}/>
              <div>
                <p className="font-bold" style={{ fontSize: 14, color: '#f97316' }}>
                  Aguardando Concurso {targetConcurso ?? ''}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#374151' }}>
                  A Loteria Federal ainda não publicou o resultado
                </p>
                <p className="text-xs mt-1 font-mono" style={{ color: '#1e293b' }}>
                  próxima verificação em{' '}
                  <span style={{ color: '#6b7280' }}>{pollCountdown}s</span>
                </p>
              </div>
            </div>

          ) : spinState === 'error' ? (
            /* Error */
            <div className="flex flex-col items-center gap-3 max-w-xs text-center">
              <div className="rounded-xl px-5 py-4 w-full" style={{
                background: 'rgba(239,68,68,0.07)',
                border: '1px solid rgba(239,68,68,0.18)',
              }}>
                <p className="font-bold text-red-400" style={{ fontSize: 14 }}>Erro no sorteio</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(239,68,68,0.55)' }}>{drawError}</p>
              </div>
              <button onClick={handleRetry} className="flex items-center gap-2 text-xs transition-all"
                      style={{ color: '#374151' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#e2e8f0')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#374151')}>
                <RefreshCw className="w-3 h-3"/> Tentar novamente
              </button>
            </div>

          ) : spinState === 'waiting' ? (
            /* Waiting for draw result */
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"/>
                <p className="font-bold tracking-widest uppercase"
                   style={{ fontSize: 12, color: '#f97316', letterSpacing: '0.2em' }}>
                  Buscando resultado
                </p>
              </div>
              {drawError && (
                <p className="text-xs text-center max-w-xs" style={{ color: 'rgba(239,68,68,0.7)' }}>
                  {drawError}
                </p>
              )}
            </div>

          ) : (
            /* ── COUNTDOWN (idle) ── */
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="font-semibold uppercase tracking-[0.35em]"
                 style={{ fontSize: 11, color: '#1e293b' }}>
                Sorteio em
              </p>

              {/* Main timer */}
              <div
                className="font-black tabular-nums leading-none"
                style={{
                  fontFamily: 'var(--font-bebas-neue)',
                  fontSize: 'clamp(68px, 18vw, 104px)',
                  color: isUrgent ? '#f97316' : '#f1f5f9',
                  letterSpacing: '0.06em',
                  animation: isUrgent ? 'zr-urgent-pulse 1s ease-in-out infinite' : 'none',
                  transition: 'color 0.5s ease',
                }}
              >
                {fmt(timeLeft)}
              </div>

              {/* Date */}
              <p className="font-mono" style={{ fontSize: 11, color: '#1e293b' }}>
                {new Date(drawAt).toLocaleString('pt-BR', {
                  weekday: 'short', day: '2-digit', month: '2-digit',
                  hour: '2-digit', minute: '2-digit',
                  timeZone: 'America/Sao_Paulo',
                })}
              </p>

              {/* Concurso badge */}
              {targetConcurso && ['idle', 'waiting', 'polling'].includes(spinState) && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full mt-1"
                     style={{
                       background: 'rgba(249,115,22,0.06)',
                       border: '1px solid rgba(249,115,22,0.14)',
                     }}>
                  <span className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background: '#f97316',
                          animation: 'zr-ring-breathe 2.5s ease-in-out infinite',
                        }}/>
                  <span className="font-mono font-bold" style={{ fontSize: 11, color: '#374151' }}>
                    Concurso
                  </span>
                  <span className="font-mono font-black" style={{ fontSize: 12, color: '#f97316' }}>
                    {targetConcurso}
                  </span>
                  <span className="font-semibold" style={{ fontSize: 11, color: '#1e293b' }}>
                    · Loteria Federal
                  </span>
                </div>
              )}

              {/* DEBUG: force-start */}
              {onForceStart && spinState === 'idle' && (
                <button
                  onClick={() => {
                    setSpinState('waiting');
                    endCalled.current = true;
                    spinStarted.current = false;
                    onForceStart();
                  }}
                  className="mt-3 px-5 py-2 rounded-lg font-bold uppercase tracking-wider transition-all"
                  style={{
                    fontSize: 11,
                    border: '1px dashed rgba(249,115,22,0.2)',
                    color: 'rgba(249,115,22,0.35)',
                    background: 'transparent',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(249,115,22,0.06)';
                    (e.currentTarget as HTMLButtonElement).style.color = 'rgba(249,115,22,0.7)';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(249,115,22,0.35)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    (e.currentTarget as HTMLButtonElement).style.color = 'rgba(249,115,22,0.35)';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(249,115,22,0.2)';
                  }}
                >
                  ▶ Iniciar Sorteio (teste)
                </button>
              )}
            </div>
          )}
        </main>

        {/* ── FAQ ── */}
        <div className="relative z-10" style={{ borderTop: '1px solid rgba(249,115,22,0.06)' }}>
          <button
            onClick={() => setFaqOpen(v => !v)}
            className="w-full flex items-center justify-between px-6 py-4 transition-colors"
            style={{
              fontSize: 11,
              color: faqOpen ? 'rgba(249,115,22,0.5)' : '#1e293b',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            <span className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5"/>
              Como funciona? · Loteria Federal
            </span>
            {faqOpen
              ? <ChevronUp className="w-4 h-4"/>
              : <ChevronDown className="w-4 h-4"/>}
          </button>

          {faqOpen && (
            <div className="px-5 pb-6">
              <div className="rounded-xl p-4 space-y-3"
                   style={{
                     background: 'rgba(249,115,22,0.03)',
                     border: '1px solid rgba(249,115,22,0.08)',
                   }}>
                <p className="font-bold" style={{ color: 'rgba(241,245,249,0.6)', fontSize: 13 }}>
                  Transparência 100% verificável
                </p>
                <p className="text-xs leading-relaxed" style={{ color: '#475569' }}>
                  O número vencedor é determinado pelo resultado oficial da{' '}
                  <span className="font-bold" style={{ color: '#f97316' }}>Loteria Federal da Caixa</span>
                  {' '}— ninguém controla o resultado.
                </p>
                <div className="rounded-lg p-3 space-y-1.5"
                     style={{ background: 'rgba(0,0,0,0.35)', fontSize: 12 }}>
                  <p className="font-bold uppercase tracking-widest mb-2"
                     style={{ fontSize: 10, color: '#374151' }}>Fórmula</p>
                  <p style={{ color: '#475569' }}>
                    1. Pegamos os <span style={{ color: '#f97316' }}>2 últimos dígitos</span> do 1º Prêmio
                  </p>
                  <p style={{ color: '#475569' }}>
                    2. Calculamos:{' '}
                    <code className="font-mono" style={{ color: '#f97316' }}>
                      (últimos2 % {N}) + 1
                    </code>
                  </p>
                  <div className="pt-2 mt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <span className="font-mono" style={{ fontSize: 11, color: '#1e293b' }}>
                      Ex: 1º Prêmio{' '}
                      <span style={{ color: '#374151' }}>097680</span>
                      {' '}→ últ.2 = <span style={{ color: '#374151' }}>80</span>
                      {' '}→ (80 % {N}) + 1 ={' '}
                      <span className="font-bold" style={{ color: '#f97316' }}>{(80 % N) + 1}</span>
                    </span>
                  </div>
                </div>
                <a href="https://loterias.caixa.gov.br/Paginas/Federal.aspx"
                   target="_blank" rel="noopener noreferrer"
                   className="flex items-center gap-1 transition-colors"
                   style={{ fontSize: 11, color: 'rgba(249,115,22,0.4)' }}
                   onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#f97316')}
                   onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = 'rgba(249,115,22,0.4)')}>
                  <ExternalLink className="w-3 h-3"/>
                  Verificar resultado oficial no site da Caixa
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
