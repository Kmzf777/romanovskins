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

const SPIN_DURATION = 5500;

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
  const [wheelAngle, setWheelAngle]     = useState(0);
  const [hubDisplay, setHubDisplay]     = useState<string | number>('?');
  const [spinState, setSpinState]       = useState<'idle'|'waiting'|'spinning'|'stopped'|'error'|'polling'>('idle');
  const [stoppedAt, setStoppedAt]       = useState<number | null>(null);

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

      // Hub cycles random numbers while spinning
      let numIv = setInterval(() => {
        setHubDisplay(Math.floor(Math.random() * N) + 1);
      }, 55);

      const tick = (now: number) => {
        const elapsed = Math.min(now - t0, SPIN_DURATION);
        const p = elapsed / SPIN_DURATION;
        const e = 1 - Math.pow(1 - p, 5); // ease-out quint
        angleRef.current = startAngle + e * totalSpin;
        setWheelAngle(angleRef.current);

        if (elapsed < SPIN_DURATION) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          clearInterval(numIv);
          setHubDisplay(winnerNumber);
          setStoppedAt(winnerNumber);
          setSpinState('stopped');
          setShowFlash(true);
          setTimeout(() => setShowFlash(false), 2000);
          setTimeout(onDrawComplete, 4500);
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

  // ── Retry ─────────────────────────────────────────────────────────────────────
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

  const CX = 150, CY = 150, R = 128, RLABEL = 100, HUB = 52;

  const wheelSegments = Array.from({ length: N }, (_, i) => {
    const num      = i + 1;
    const a1       = i * SEG;
    const a2       = (i + 1) * SEG;
    const isWinner = isStopped && stoppedAt === num;
    const fill     = isWinner ? 'url(#dl-fire-grad)' : (i % 2 === 0 ? '#1c1308' : '#130e05');
    const labelColor = isWinner ? '#f0ddb0' : '#4a3920';
    const midAngle = (a1 + a2) / 2;
    const lp       = polar(CX, CY, RLABEL, midAngle);
    const fontSize = N <= 10 ? 13 : N <= 30 ? 9 : N <= 60 ? 6.5 : 4.5;
    return { num, a1, a2, fill, labelColor, lp, fontSize, isWinner };
  });

  // Hub display text (only used for non-spinning/stopped states)
  const hubStaticText =
    spinState === 'waiting' || spinState === 'polling' ? '···'
    : spinState === 'error' ? '!'
    : spinState === 'idle' ? '?'
    : null;

  // Hub number font size for winner reveal
  const winnerFontSize = winnerNumber != null
    ? (String(winnerNumber).length > 2 ? 20 : String(winnerNumber).length > 1 ? 26 : 34)
    : 26;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Injected styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Barlow+Condensed:ital,wght@0,400;0,600;0,700;0,800;1,700&family=JetBrains+Mono:wght@400;700&display=swap');

        .dl-root { font-family: 'Barlow Condensed', sans-serif; }

        /* Hub number animations */
        @keyframes dl-hub-spin-grow {
          0%   { filter: blur(1px);  transform: translate(-50%, -50%) scale(1);   opacity: 0.8; }
          40%  { filter: blur(5px);  transform: translate(-50%, -50%) scale(1.6); opacity: 0.55; }
          100% { filter: blur(18px); transform: translate(-50%, -50%) scale(3.2); opacity: 0.15; }
        }
        @keyframes dl-hub-reveal {
          0%   { filter: blur(20px); transform: translate(-50%, -50%) scale(3.5); opacity: 0; }
          35%  { opacity: 1; filter: blur(8px); transform: translate(-50%, -50%) scale(1.8); }
          100% { filter: blur(0px);  transform: translate(-50%, -50%) scale(1);   opacity: 1; }
        }
        @keyframes dl-hub-idle-pulse {
          0%, 100% { opacity: 0.25; }
          50%       { opacity: 0.45; }
        }

        /* Background elements */
        @keyframes dl-ember {
          0%   { transform: translateY(0) translateX(0) scale(1); opacity: 0.85; }
          50%  { opacity: 0.5; }
          100% { transform: translateY(-220px) translateX(var(--tx)) scale(0.05); opacity: 0; }
        }
        @keyframes dl-live-ping {
          0%, 100% { transform: scale(1); opacity: 1; }
          60%       { transform: scale(2.4); opacity: 0; }
        }
        @keyframes dl-ring-breathe {
          0%, 100% { opacity: 0.18; }
          50%       { opacity: 0.7; }
        }
        @keyframes dl-flash {
          0%   { opacity: 0; }
          6%   { opacity: 1; }
          25%  { opacity: 0; }
          42%  { opacity: 0.5; }
          65%  { opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes dl-winner-in {
          from { opacity: 0; transform: scale(0.5) translateY(16px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes dl-dots {
          0%, 80%, 100% { transform: scale(0.5); opacity: 0.25; }
          40%            { transform: scale(1.3); opacity: 1; }
        }
        @keyframes dl-spin-ring {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: -502; }
        }
        @keyframes dl-urgent-pulse {
          0%, 100% { text-shadow: 0 0 20px rgba(200,150,10,0.5); }
          50%       { text-shadow: 0 0 50px rgba(200,150,10,1), 0 0 90px rgba(200,150,10,0.4); }
        }
        @keyframes dl-border-shimmer {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes dl-glow-pulse {
          0%, 100% { opacity: 0.06; }
          50%       { opacity: 0.16; }
        }

      `}</style>

      <div className="dl-root min-h-screen text-white flex flex-col relative overflow-hidden"
           style={{ backgroundColor: 'transparent' }}>

        {/* ── Background image dark overlay (readability) ── */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'rgba(9,7,4,0.72)',
          zIndex: 0,
        }}/>

        {/* ── SVG grain / parchment noise texture ── */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none select-none" style={{ opacity: 0.025, zIndex: 0 }}>
          <filter id="dl-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
            <feColorMatrix type="saturate" values="0"/>
          </filter>
          <rect width="100%" height="100%" filter="url(#dl-grain)" opacity="1"/>
        </svg>

        {/* ── Celtic diamond knotwork background ── */}
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden" style={{ zIndex: 1 }}>
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dl-diamond" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
                {/* Outer diamond */}
                <path d="M24 2 L46 24 L24 46 L2 24 Z"
                      fill="none" stroke="#c8960a" strokeWidth="0.7" opacity="0.09"/>
                {/* Inner diamond */}
                <path d="M24 10 L38 24 L24 38 L10 24 Z"
                      fill="none" stroke="#c8960a" strokeWidth="0.4" opacity="0.05"/>
                {/* Center jewel */}
                <rect x="22" y="22" width="4" height="4" fill="none" stroke="#d4af37" strokeWidth="0.4" opacity="0.07"
                      transform="rotate(45 24 24)"/>
                {/* Cross connectors */}
                <line x1="24" y1="0" x2="24" y2="2"    stroke="#c8960a" strokeWidth="0.4" opacity="0.06"/>
                <line x1="24" y1="46" x2="24" y2="48"  stroke="#c8960a" strokeWidth="0.4" opacity="0.06"/>
                <line x1="0"  y1="24" x2="2"  y2="24"  stroke="#c8960a" strokeWidth="0.4" opacity="0.06"/>
                <line x1="46" y1="24" x2="48" y2="24"  stroke="#c8960a" strokeWidth="0.4" opacity="0.06"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dl-diamond)"/>
          </svg>

          {/* Radial golden glow at wheel position */}
          <div className="absolute" style={{
            inset: 0,
            background: isActive
              ? 'radial-gradient(ellipse 72% 58% at 50% 38%, rgba(200,150,10,0.13) 0%, transparent 65%)'
              : isStopped
              ? 'radial-gradient(ellipse 75% 60% at 50% 38%, rgba(200,150,10,0.22) 0%, transparent 65%)'
              : 'radial-gradient(ellipse 60% 45% at 50% 38%, rgba(200,150,10,0.06) 0%, transparent 60%)',
            transition: 'background 1.2s ease',
            animation: isActive && !isStopped ? 'dl-glow-pulse 3s ease-in-out infinite' : 'none',
          }}/>

          {/* Corner ornaments — top-left */}
          <svg className="absolute top-0 left-0 pointer-events-none" width="80" height="80" viewBox="0 0 80 80">
            <path d="M0 0 L80 0 L80 6 L6 6 L6 80 L0 80 Z" fill="#c8960a" opacity="0.07"/>
            <path d="M0 0 L60 0 L60 3 L3 3 L3 60 L0 60 Z" fill="#c8960a" opacity="0.05"/>
            <path d="M12 12 L28 12 L28 15 L15 15 L15 28 L12 28 Z" fill="#c8960a" opacity="0.06"/>
            <circle cx="24" cy="24" r="3" fill="none" stroke="#d4af37" strokeWidth="0.8" opacity="0.1"/>
          </svg>
          {/* Corner ornament — top-right */}
          <svg className="absolute top-0 right-0 pointer-events-none" width="80" height="80" viewBox="0 0 80 80">
            <path d="M80 0 L0 0 L0 6 L74 6 L74 80 L80 80 Z" fill="#c8960a" opacity="0.07"/>
            <path d="M80 0 L20 0 L20 3 L77 3 L77 60 L80 60 Z" fill="#c8960a" opacity="0.05"/>
            <path d="M68 12 L52 12 L52 15 L65 15 L65 28 L68 28 Z" fill="#c8960a" opacity="0.06"/>
            <circle cx="56" cy="24" r="3" fill="none" stroke="#d4af37" strokeWidth="0.8" opacity="0.1"/>
          </svg>
          {/* Corner ornament — bottom-left */}
          <svg className="absolute bottom-0 left-0 pointer-events-none" width="80" height="80" viewBox="0 0 80 80">
            <path d="M0 80 L80 80 L80 74 L6 74 L6 0 L0 0 Z" fill="#c8960a" opacity="0.07"/>
            <circle cx="24" cy="56" r="3" fill="none" stroke="#d4af37" strokeWidth="0.8" opacity="0.1"/>
          </svg>
          {/* Corner ornament — bottom-right */}
          <svg className="absolute bottom-0 right-0 pointer-events-none" width="80" height="80" viewBox="0 0 80 80">
            <path d="M80 80 L0 80 L0 74 L74 74 L74 0 L80 0 Z" fill="#c8960a" opacity="0.07"/>
            <circle cx="56" cy="56" r="3" fill="none" stroke="#d4af37" strokeWidth="0.8" opacity="0.1"/>
          </svg>

          {/* Bottom fade */}
          <div className="absolute inset-x-0 bottom-0 h-40"
               style={{ background: 'linear-gradient(to top, #090704, transparent)' }}/>
        </div>

        {/* ── Ember / spark particles (fire breathing feel) ── */}
        {isActive && Array.from({ length: 14 }, (_, i) => (
          <div key={i} className="absolute rounded-full pointer-events-none select-none"
               style={{
                 width: 1.5 + (i % 3),
                 height: 1.5 + (i % 3),
                 background: ['#e07c1e','#d4af37','#dc5f00','#f0c050','#b8860b'][i % 5],
                 left: `${15 + (i * 43) % 70}%`,
                 bottom: `${12 + (i * 19) % 38}%`,
                 '--tx': `${(i % 2 === 0 ? 1 : -1) * (8 + (i * 9) % 28)}px`,
                 animation: `dl-ember ${2.8 + (i % 5) * 0.65}s ease-out ${i * 0.3}s infinite`,
                 zIndex: 2,
               } as React.CSSProperties}
          />
        ))}

        {/* ── Winner flash overlay ── */}
        {showFlash && (
          <div className="absolute inset-0 pointer-events-none" style={{
            zIndex: 50,
            background: 'radial-gradient(ellipse 65% 55% at 50% 40%, rgba(200,150,10,0.6) 0%, rgba(220,95,0,0.2) 40%, transparent 70%)',
            animation: 'dl-flash 2s ease-out forwards',
          }}/>
        )}

        {/* ── Header ── */}
        <header className="relative flex items-center justify-between px-5 py-3"
                style={{
                  zIndex: 10,
                  borderBottom: '1px solid rgba(200,150,10,0.08)',
                  background: 'rgba(9,7,4,0.9)',
                  backdropFilter: 'blur(20px)',
                }}>

          {/* LIVE badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
               style={{
                 background: 'rgba(220,79,5,0.08)',
                 border: '1px solid rgba(220,79,5,0.22)',
               }}>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full"
                    style={{
                      background: '#dc4a05',
                      animation: 'dl-live-ping 2s ease-in-out infinite',
                      opacity: 0.7,
                    }}/>
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: '#dc4a05' }}/>
            </span>
            <span className="font-bold tracking-[0.18em] uppercase"
                  style={{ fontSize: 10, color: '#dc4a05', fontFamily: "'Cinzel', serif" }}>
              AO VIVO
            </span>
          </div>

          {/* Brand — centered */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
            {/* Decorative left fleur */}
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
              <path d="M14 5 Q10 0 6 5 Q10 10 14 5Z" fill="#c8960a" opacity="0.3"/>
              <path d="M8 5 Q5 1 0 5 Q5 9 8 5Z" fill="#c8960a" opacity="0.2"/>
            </svg>
            <span style={{
              fontSize: 10,
              color: 'rgba(200,150,10,0.35)',
              fontFamily: "'Cinzel', serif",
              fontWeight: 600,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
            }}>
              Romanov Rifas
            </span>
            {/* Decorative right fleur */}
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none" style={{ transform: 'scaleX(-1)' }}>
              <path d="M14 5 Q10 0 6 5 Q10 10 14 5Z" fill="#c8960a" opacity="0.3"/>
              <path d="M8 5 Q5 1 0 5 Q5 9 8 5Z" fill="#c8960a" opacity="0.2"/>
            </svg>
          </div>

          {/* Viewers */}
          <div className="flex items-center gap-1.5" style={{ color: '#2d2415', fontSize: 12 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{viewers}</span>
          </div>
        </header>

        {/* ── Main content ── */}
        <main className="relative flex-1 flex flex-col items-center justify-center px-4 py-5 gap-4" style={{ zIndex: 10 }}>

          {/* Title */}
          <div className="text-center">
            <h1 className="font-semibold leading-tight" style={{
              fontSize: 16,
              color: 'rgba(240,221,176,0.7)',
              fontFamily: "'Cinzel', serif",
              letterSpacing: '0.04em',
            }}>
              {raffle.title}
            </h1>
            <p style={{ fontSize: 11, color: '#2d2415', fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
              {N} cotas · sorteio ao vivo
            </p>
          </div>

          {/* ══ ROULETTE WHEEL ══ */}
          <div className="relative flex items-center justify-center">

            {/* Glow halo */}
            <div className="absolute rounded-full pointer-events-none" style={{
              width: 320, height: 320,
              boxShadow: isStopped
                ? '0 0 100px 35px rgba(200,150,10,0.28), 0 0 220px 80px rgba(180,110,5,0.10)'
                : isSpinning
                ? '0 0 60px 18px rgba(200,150,10,0.16)'
                : isActive
                ? '0 0 35px 10px rgba(200,150,10,0.10)'
                : '0 0 15px 4px rgba(200,150,10,0.04)',
              transition: 'box-shadow 1.4s ease',
              animation: isActive && !isStopped && !isSpinning
                ? 'dl-ring-breathe 2.5s ease-in-out infinite' : 'none',
            }}/>

            {/* SVG wheel */}
            <svg
              viewBox="0 0 300 300"
              width={300}
              height={300}
              style={{
                filter: isStopped
                  ? 'drop-shadow(0 0 28px rgba(200,150,10,0.5))'
                  : isSpinning
                  ? 'drop-shadow(0 0 16px rgba(200,150,10,0.24))'
                  : 'drop-shadow(0 0 8px rgba(200,150,10,0.08))',
                transition: 'filter 0.9s ease',
              }}
            >
              <defs>
                {/* Dragon fire gradient for winner segment */}
                <linearGradient id="dl-fire-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%"   stopColor="#7c2d12"/>
                  <stop offset="40%"  stopColor="#c2410c"/>
                  <stop offset="100%" stopColor="#e07c1e"/>
                </linearGradient>

                {/* Hub fill gradient */}
                <radialGradient id="dl-hub-fill" cx="40%" cy="35%" r="65%">
                  <stop offset="0%"   stopColor="#221a0a"/>
                  <stop offset="100%" stopColor="#0e0b05"/>
                </radialGradient>

                {/* Base disc fill */}
                <radialGradient id="dl-base" cx="50%" cy="35%" r="70%">
                  <stop offset="0%"   stopColor="#1c1308"/>
                  <stop offset="100%" stopColor="#090704"/>
                </radialGradient>

                {/* Winner glow filter */}
                <filter id="dl-winner-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur"/>
                  <feMerge>
                    <feMergeNode in="blur"/>
                    <feMergeNode in="blur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>

                {/* Hub glow filter */}
                <filter id="dl-hub-glow" x="-70%" y="-70%" width="240%" height="240%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="blur"/>
                  <feMerge>
                    <feMergeNode in="blur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>

                {/* Pointer glow */}
                <filter id="dl-ptr-glow" x="-100%" y="-60%" width="300%" height="220%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>
                  <feMerge>
                    <feMergeNode in="blur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>

              {/* Base disc */}
              <circle cx={CX} cy={CY} r={R + 16} fill="url(#dl-base)"/>

              {/* Spinning wheel group */}
              <g transform={`rotate(${wheelAngle}, ${CX}, ${CY})`}>
                {wheelSegments.map(({ num, a1, a2, fill, labelColor, lp, fontSize, isWinner }) => (
                  <g key={num} filter={isWinner ? 'url(#dl-winner-glow)' : undefined}>
                    <path
                      d={sector(CX, CY, R, a1, a2)}
                      fill={fill}
                      stroke="#090704"
                      strokeWidth="0.7"
                    />
                    {N <= 120 && (
                      <text
                        x={lp.x} y={lp.y}
                        textAnchor="middle" dominantBaseline="central"
                        fontSize={fontSize}
                        fontWeight={isWinner ? '700' : '600'}
                        fill={labelColor}
                        style={{
                          fontFamily: "'Cinzel', serif",
                          userSelect: 'none',
                        }}
                      >
                        {num}
                      </text>
                    )}
                  </g>
                ))}
                {/* Inner ring divider — golden engraving line */}
                <circle cx={CX} cy={CY} r={R * 0.62} fill="none"
                        stroke="rgba(200,150,10,0.07)" strokeWidth="1.2"/>
              </g>

              {/* Static outer bezel — ornate triple ring */}
              <circle cx={CX} cy={CY} r={R + 1}  fill="none" stroke="rgba(200,150,10,0.25)" strokeWidth="2"/>
              <circle cx={CX} cy={CY} r={R + 7}  fill="none" stroke="rgba(200,150,10,0.08)" strokeWidth="1.2"/>
              <circle cx={CX} cy={CY} r={R + 13} fill="none" stroke="rgba(200,150,10,0.04)" strokeWidth="1"/>

              {/* Bezel tick marks — 24 major + minor */}
              {Array.from({ length: 48 }, (_, i) => {
                const ang = (i * 7.5 - 90) * Math.PI / 180;
                const major = i % 4 === 0;
                const r1 = R + 2;
                const r2 = R + 2 + (major ? 7 : 3.5);
                return (
                  <line key={i}
                    x1={CX + r1 * Math.cos(ang)} y1={CY + r1 * Math.sin(ang)}
                    x2={CX + r2 * Math.cos(ang)} y2={CY + r2 * Math.sin(ang)}
                    stroke={major ? 'rgba(200,150,10,0.45)' : 'rgba(200,150,10,0.12)'}
                    strokeWidth={major ? 1.8 : 0.8}
                  />
                );
              })}

              {/* Animated dashed ring while active */}
              {isActive && (
                <circle cx={CX} cy={CY} r={R + 4.5}
                  fill="none"
                  stroke="rgba(200,150,10,0.35)"
                  strokeWidth="1.2"
                  strokeDasharray="6 9"
                  style={{ animation: 'dl-spin-ring 3.5s linear infinite' }}
                />
              )}

              {/* Hub glow aura when stopped */}
              {isStopped && (
                <circle cx={CX} cy={CY} r={HUB + 20}
                  fill="rgba(200,150,10,0.07)"
                  filter="url(#dl-hub-glow)"/>
              )}

              {/* Hub outer ring */}
              <circle cx={CX} cy={CY} r={HUB + 3}
                fill="rgba(200,150,10,0.05)"
                stroke={isStopped ? 'rgba(212,175,55,0.5)' : 'rgba(200,150,10,0.12)'}
                strokeWidth="1"
                style={{ transition: 'stroke 0.7s ease' }}/>

              {/* Hub main circle */}
              <circle cx={CX} cy={CY} r={HUB}
                fill="url(#dl-hub-fill)"
                stroke={isStopped ? 'rgba(212,175,55,0.7)' : 'rgba(200,150,10,0.18)'}
                strokeWidth="2.5"
                filter={isStopped ? 'url(#dl-hub-glow)' : undefined}
                style={{ transition: 'stroke 0.7s ease' }}/>

              {/* Hub inner decorative ring */}
              <circle cx={CX} cy={CY} r={HUB - 10}
                fill="none"
                stroke={isStopped ? 'rgba(200,150,10,0.15)' : 'rgba(200,150,10,0.04)'}
                strokeWidth="1"
                style={{ transition: 'stroke 0.7s ease' }}/>

              {/* Hub inner jewel dots — 8 point */}
              {Array.from({ length: 8 }, (_, i) => {
                const ang = (i * 45 - 90) * Math.PI / 180;
                const r = HUB - 6;
                return (
                  <circle key={i}
                    cx={CX + r * Math.cos(ang)}
                    cy={CY + r * Math.sin(ang)}
                    r="1.2"
                    fill={isStopped ? 'rgba(212,175,55,0.7)' : 'rgba(200,150,10,0.1)'}
                    style={{ transition: 'fill 0.5s ease' }}
                  />
                );
              })}
            </svg>

            {/* ── Hub number overlay (HTML for CSS animation support) ── */}
            <div
              key={`hub-${spinState}`}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: HUB * 2,
                textAlign: 'center',
                pointerEvents: 'none',
                userSelect: 'none',
                zIndex: 20,
                ...(isStopped ? {
                  transform: 'translate(-50%, -50%)',
                  animation: `dl-hub-reveal 0.95s cubic-bezier(0.22, 1, 0.36, 1) both`,
                  fontFamily: "'Cinzel', serif",
                  fontWeight: 900,
                  fontSize: winnerFontSize,
                  color: '#f0ddb0',
                  textShadow: '0 0 20px rgba(200,150,10,0.9), 0 0 50px rgba(200,150,10,0.4)',
                  letterSpacing: '0.04em',
                } : isSpinning ? {
                  animation: `dl-hub-spin-grow ${SPIN_DURATION}ms ease-in both`,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700,
                  fontSize: 18,
                  color: '#e07c1e',
                } : {
                  transform: 'translate(-50%, -50%)',
                  fontFamily: "'Cinzel', serif",
                  fontWeight: 600,
                  fontSize: 20,
                  color: '#3d2f15',
                  animation: 'dl-hub-idle-pulse 3s ease-in-out infinite',
                }),
              }}
            >
              {isStopped
                ? winnerNumber
                : isSpinning
                ? hubDisplay
                : hubStaticText}
            </div>

            {/* ── Dragon claw pointer ── */}
            <div className="absolute z-30" style={{ top: -10, left: '50%', transform: 'translateX(-50%)' }}>
              <svg width="22" height="38" viewBox="0 0 22 38" overflow="visible">
                <defs>
                  <linearGradient id="dl-ptr-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%"   stopColor={isStopped ? '#d4af37' : '#5c3d0a'}/>
                    <stop offset="100%" stopColor={isStopped ? '#e07c1e' : '#8b6914'}/>
                  </linearGradient>
                </defs>
                {/* Shadow */}
                <path d="M11 37 L1 11 L6 0 L11 4 L16 0 L21 11 Z"
                      fill="rgba(0,0,0,0.5)" transform="translate(2, 3)"/>
                {/* Main blade */}
                <path d="M11 37 L1 11 L6 0 L11 4 L16 0 L21 11 Z"
                      fill="url(#dl-ptr-grad)"
                      filter="url(#dl-ptr-glow)"
                      style={{ transition: 'fill 0.6s ease' }}/>
                {/* Highlight ridge */}
                <path d="M11 32 L4 12 L8 2 L11 5 L14 2 L18 12 Z"
                      fill="rgba(255,255,255,0.08)"/>
                <line x1="11" y1="4" x2="11" y2="30"
                      stroke="rgba(255,255,255,0.18)" strokeWidth="1"/>
                {/* Notch */}
                <path d="M7 8 L11 4 L15 8" fill="none"
                      stroke="rgba(255,255,255,0.15)" strokeWidth="0.8"/>
              </svg>
            </div>
          </div>

          {/* ══ STATUS SECTION ══ */}

          {isStopped && winnerNumber != null ? (
            /* Winner reveal */
            <div className="flex flex-col items-center gap-2 text-center"
                 style={{ animation: 'dl-winner-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}>
              {/* Ornamental divider */}
              <div className="flex items-center gap-3">
                <div style={{ height: 1, width: 40, background: 'linear-gradient(to right, transparent, rgba(200,150,10,0.4))' }}/>
                <svg width="12" height="12" viewBox="0 0 12 12">
                  <path d="M6 0 L12 6 L6 12 L0 6 Z" fill="none" stroke="#c8960a" strokeWidth="1" opacity="0.6"/>
                  <circle cx="6" cy="6" r="2" fill="#c8960a" opacity="0.4"/>
                </svg>
                <div style={{ height: 1, width: 40, background: 'linear-gradient(to left, transparent, rgba(200,150,10,0.4))' }}/>
              </div>

              <p style={{
                fontSize: 10,
                color: 'rgba(200,150,10,0.5)',
                fontFamily: "'Cinzel', serif",
                fontWeight: 600,
                letterSpacing: '0.35em',
                textTransform: 'uppercase',
              }}>
                Número Vencedor
              </p>

              <div style={{
                fontFamily: "'Cinzel', serif",
                fontWeight: 900,
                fontSize: 'clamp(52px, 13vw, 76px)',
                color: '#d4af37',
                textShadow: '0 0 40px rgba(200,150,10,0.8), 0 0 80px rgba(200,150,10,0.35)',
                letterSpacing: '0.06em',
                lineHeight: 1,
              }}>
                #{winnerNumber}
              </div>

              <p style={{ fontSize: 10, color: '#2d2415', letterSpacing: '0.2em', fontFamily: "'Cinzel', serif" }}>
                Abrindo comprovante...
              </p>
            </div>

          ) : isSpinning ? (
            /* Spinning */
            <div className="flex flex-col items-center gap-3">
              <p style={{
                fontSize: 12,
                color: '#c8960a',
                fontFamily: "'Cinzel', serif",
                fontWeight: 600,
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                animation: 'dl-ring-breathe 1.5s ease-in-out infinite',
              }}>
                O Dragão Revela
              </p>
              <div className="flex gap-2">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full"
                       style={{
                         background: '#c8960a',
                         animation: `dl-dots 1.1s ease-in-out ${i * 0.22}s infinite`,
                       }}/>
                ))}
              </div>
            </div>

          ) : spinState === 'polling' ? (
            /* Polling */
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-7 h-7 rounded-full border-2 animate-spin"
                   style={{ borderColor: 'rgba(200,150,10,0.15)', borderTopColor: '#c8960a' }}/>
              <div>
                <p style={{
                  fontSize: 13,
                  color: '#c8960a',
                  fontFamily: "'Cinzel', serif",
                  fontWeight: 600,
                }}>
                  Aguardando Concurso {targetConcurso ?? ''}
                </p>
                <p style={{ fontSize: 11, color: '#3d2f15', marginTop: 3 }}>
                  A Loteria Federal ainda não publicou o resultado
                </p>
                <p style={{ fontSize: 11, color: '#2d2415', marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                  próxima verificação em{' '}
                  <span style={{ color: '#5c4a28' }}>{pollCountdown}s</span>
                </p>
              </div>
            </div>

          ) : spinState === 'error' ? (
            /* Error */
            <div className="flex flex-col items-center gap-3 max-w-xs text-center">
              <div className="rounded-xl px-5 py-4 w-full" style={{
                background: 'rgba(185,28,28,0.06)',
                border: '1px solid rgba(185,28,28,0.18)',
              }}>
                <p style={{ fontSize: 13, color: '#dc2626', fontFamily: "'Cinzel', serif" }}>Erro no sorteio</p>
                <p style={{ fontSize: 11, marginTop: 4, color: 'rgba(185,28,28,0.5)' }}>{drawError}</p>
              </div>
              <button onClick={handleRetry} className="flex items-center gap-2 transition-all"
                      style={{ fontSize: 11, color: '#3d2f15' }}
                      onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = '#c8960a')}
                      onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = '#3d2f15')}>
                <RefreshCw className="w-3 h-3"/> Tentar novamente
              </button>
            </div>

          ) : spinState === 'waiting' ? (
            /* Waiting */
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full animate-ping" style={{ background: '#c8960a' }}/>
                <p style={{
                  fontSize: 11,
                  color: '#c8960a',
                  fontFamily: "'Cinzel', serif",
                  fontWeight: 600,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                }}>
                  Buscando resultado
                </p>
              </div>
              {drawError && (
                <p style={{ fontSize: 11, color: 'rgba(185,28,28,0.6)', textAlign: 'center', maxWidth: 280 }}>
                  {drawError}
                </p>
              )}
            </div>

          ) : (
            /* ── COUNTDOWN (idle) ── */
            <div className="flex flex-col items-center gap-2 text-center">
              <p style={{
                fontSize: 10,
                color: '#2d2415',
                fontFamily: "'Cinzel', serif",
                fontWeight: 600,
                letterSpacing: '0.35em',
                textTransform: 'uppercase',
              }}>
                Sorteio em
              </p>

              {/* Main countdown timer */}
              <div style={{
                fontFamily: "'Cinzel', serif",
                fontWeight: 900,
                fontSize: 'clamp(64px, 17vw, 96px)',
                letterSpacing: '0.05em',
                lineHeight: 1,
                color: isUrgent ? '#e07c1e' : '#f0ddb0',
                textShadow: isUrgent
                  ? '0 0 30px rgba(224,124,30,0.7)'
                  : '0 0 20px rgba(200,150,10,0.2)',
                animation: isUrgent ? 'dl-urgent-pulse 1s ease-in-out infinite' : 'none',
                transition: 'color 0.5s ease',
              }}>
                {fmt(timeLeft)}
              </div>

              {/* Date */}
              <p style={{ fontSize: 11, color: '#2d2415', fontFamily: "'JetBrains Mono', monospace" }}>
                {new Date(drawAt).toLocaleString('pt-BR', {
                  weekday: 'short', day: '2-digit', month: '2-digit',
                  hour: '2-digit', minute: '2-digit',
                  timeZone: 'America/Sao_Paulo',
                })}
              </p>

              {/* Concurso badge */}
              {targetConcurso && ['idle', 'waiting', 'polling'].includes(spinState) && (
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full mt-1"
                     style={{
                       background: 'rgba(200,150,10,0.05)',
                       border: '1px solid rgba(200,150,10,0.12)',
                     }}>
                  <span className="w-1.5 h-1.5 rounded-full"
                        style={{ background: '#c8960a', animation: 'dl-ring-breathe 2.5s ease-in-out infinite' }}/>
                  <span style={{
                    fontSize: 10,
                    color: '#4a3920',
                    fontFamily: "'Cinzel', serif",
                    fontWeight: 600,
                  }}>Concurso</span>
                  <span style={{
                    fontSize: 11,
                    color: '#c8960a',
                    fontFamily: "'Cinzel', serif",
                    fontWeight: 700,
                  }}>{targetConcurso}</span>
                  <span style={{ fontSize: 10, color: '#2d2415', fontFamily: "'Cinzel', serif" }}>
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
                    fontSize: 10,
                    border: '1px dashed rgba(200,150,10,0.18)',
                    color: 'rgba(200,150,10,0.3)',
                    background: 'transparent',
                    fontFamily: "'Cinzel', serif",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(200,150,10,0.05)';
                    (e.currentTarget as HTMLButtonElement).style.color = 'rgba(200,150,10,0.65)';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(200,150,10,0.3)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    (e.currentTarget as HTMLButtonElement).style.color = 'rgba(200,150,10,0.3)';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(200,150,10,0.18)';
                  }}
                >
                  ▶ Iniciar Sorteio (teste)
                </button>
              )}
            </div>
          )}
        </main>

        {/* ── FAQ / How it works ── */}
        <div className="relative" style={{ zIndex: 10, borderTop: '1px solid rgba(200,150,10,0.06)' }}>
          <button
            onClick={() => setFaqOpen(v => !v)}
            className="w-full flex items-center justify-between px-6 py-3.5 transition-colors"
            style={{
              fontSize: 10,
              color: faqOpen ? 'rgba(200,150,10,0.45)' : '#2d2415',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              fontWeight: 700,
              fontFamily: "'Cinzel', serif",
            }}
          >
            <span className="flex items-center gap-2">
              <Shield className="w-3 h-3"/>
              Como funciona · Loteria Federal
            </span>
            {faqOpen ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
          </button>

          {faqOpen && (
            <div className="px-5 pb-6">
              <div className="rounded-xl p-4 space-y-3"
                   style={{ background: 'rgba(200,150,10,0.025)', border: '1px solid rgba(200,150,10,0.07)' }}>
                <p style={{ color: 'rgba(240,221,176,0.5)', fontSize: 12, fontFamily: "'Cinzel', serif", fontWeight: 600 }}>
                  Transparência 100% verificável
                </p>
                <p style={{ fontSize: 11, color: '#4a3920', lineHeight: 1.7 }}>
                  O número vencedor é determinado pelo resultado oficial da{' '}
                  <span style={{ color: '#c8960a', fontWeight: 700 }}>Loteria Federal da Caixa</span>
                  {' '}— ninguém controla o resultado.
                </p>
                <div className="rounded-lg p-3 space-y-1.5"
                     style={{ background: 'rgba(0,0,0,0.3)', fontSize: 11 }}>
                  <p style={{ fontSize: 9, color: '#2d2415', textTransform: 'uppercase', letterSpacing: '0.2em', fontFamily: "'Cinzel', serif", fontWeight: 600, marginBottom: 6 }}>
                    Fórmula
                  </p>
                  <p style={{ color: '#4a3920' }}>
                    1. Pegamos os <span style={{ color: '#c8960a' }}>2 últimos dígitos</span> do 1º Prêmio
                  </p>
                  <p style={{ color: '#4a3920' }}>
                    2. Calculamos:{' '}
                    <code style={{ fontFamily: "'JetBrains Mono', monospace", color: '#c8960a' }}>
                      (últimos2 % {N}) + 1
                    </code>
                  </p>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: 8, marginTop: 4 }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#2d2415' }}>
                      Ex: 1º Prêmio{' '}
                      <span style={{ color: '#3d2f15' }}>097680</span>
                      {' '}→ últ.2 = <span style={{ color: '#3d2f15' }}>80</span>
                      {' '}→ (80 % {N}) + 1 ={' '}
                      <span style={{ color: '#c8960a', fontWeight: 700 }}>{(80 % N) + 1}</span>
                    </span>
                  </div>
                </div>
                <a href="https://loterias.caixa.gov.br/Paginas/Federal.aspx"
                   target="_blank" rel="noopener noreferrer"
                   className="flex items-center gap-1 transition-colors"
                   style={{ fontSize: 10, color: 'rgba(200,150,10,0.35)', fontFamily: "'Cinzel', serif" }}
                   onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#c8960a')}
                   onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = 'rgba(200,150,10,0.35)')}>
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
