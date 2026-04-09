'use client';

import { ExternalLink, Copy, Share2, ShieldCheck } from 'lucide-react';
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

  const isFallback = calculatedWinner !== winner_ticket_number;

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
    <>
      <style>{`
        .dl-proof-root { font-family: var(--font-space-grotesk), sans-serif; }

        @keyframes dl-proof-in {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes dl-number-glow {
          0%, 100% { text-shadow: 0 0 40px rgba(200,150,10,0.7), 0 0 80px rgba(200,150,10,0.3); }
          50%       { text-shadow: 0 0 60px rgba(200,150,10,1),   0 0 120px rgba(200,150,10,0.5); }
        }
        @keyframes dl-border-scan {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes dl-grain-shift {
          0%   { transform: translate(0, 0); }
          25%  { transform: translate(-1%, -1%); }
          50%  { transform: translate(1%, 0); }
          75%  { transform: translate(0, 1%); }
          100% { transform: translate(0, 0); }
        }

      `}</style>

      <div className="dl-proof-root min-h-screen text-white flex flex-col relative overflow-hidden"
           style={{ backgroundColor: 'transparent' }}>

        {/* Background dark overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'rgba(9,7,4,0.70)',
          zIndex: 0,
        }}/>

        {/* Grain texture */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none select-none"
             style={{ opacity: 0.025, zIndex: 0 }}>
          <filter id="dlp-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
            <feColorMatrix type="saturate" values="0"/>
          </filter>
          <rect width="100%" height="100%" filter="url(#dlp-grain)"
                style={{ animation: 'dl-grain-shift 8s steps(4) infinite' }}/>
        </svg>

        {/* Radial gold glow + bottom fade */}
        <div className="absolute inset-0 pointer-events-none select-none" style={{ zIndex: 1 }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse 80% 50% at 50% 10%, rgba(200,150,10,0.14) 0%, transparent 60%)',
          }}/>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, #090704 0%, transparent 40%)',
          }}/>
        </div>

        {/* Main content */}
        <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-12 gap-7"
             style={{ zIndex: 10, animation: 'dl-proof-in 0.8s cubic-bezier(0.22, 1, 0.36, 1) both' }}>

          {/* ── Header trophy section ── */}
          <div className="flex flex-col items-center gap-3 text-center">
            {/* Trophy ornament */}
            <div className="relative flex items-center justify-center">
              <div style={{
                position: 'absolute',
                width: 80, height: 80,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(200,150,10,0.15) 0%, transparent 70%)',
              }}/>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                {/* Simplified crown/trophy */}
                <path d="M12 36 L36 36 L36 38 L12 38 Z" fill="#c8960a" opacity="0.8"/>
                <path d="M14 32 L34 32 L36 36 L12 36 Z" fill="#c8960a" opacity="0.7"/>
                <path d="M8 16 L12 32 L36 32 L40 16 L33 22 L24 10 L15 22 Z" fill="#c8960a" opacity="0.9"/>
                <path d="M8 16 L8 14 L10 14 L10 16 Z M40 16 L40 14 L38 14 L38 16 Z M24 10 L24 8 L26 8 L26 10 Z"
                      fill="#d4af37" opacity="0.8"/>
                <circle cx="8" cy="13" r="3" fill="#d4af37" opacity="0.6"/>
                <circle cx="40" cy="13" r="3" fill="#d4af37" opacity="0.6"/>
                <circle cx="24" cy="8" r="3" fill="#d4af37" opacity="0.6"/>
                {/* Shine */}
                <path d="M16 20 L20 14" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>

            <div>
              <h1 style={{
                fontFamily: "var(--font-bebas-neue), sans-serif",
                fontSize: 32,
                color: '#f0ddb0',
                letterSpacing: '0.08em',
                lineHeight: 1.1,
              }}>
                Sorteio Encerrado
              </h1>
              <p style={{ fontSize: 14, color: 'rgba(200,150,10,0.55)', marginTop: 4, fontFamily: "var(--font-space-grotesk), sans-serif" }}>
                {raffle.title}
              </p>
            </div>
          </div>

          {/* ── Winner number card ── */}
          <div style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            maxWidth: 300,
            padding: '32px 24px',
            borderRadius: 20,
            background: 'linear-gradient(135deg, rgba(200,150,10,0.08) 0%, rgba(9,7,4,0.95) 50%, rgba(180,110,5,0.06) 100%)',
            border: '1px solid rgba(200,150,10,0.25)',
            boxShadow: '0 0 80px rgba(200,150,10,0.12), inset 0 1px 0 rgba(212,175,55,0.1)',
          }}>
            {/* Inner ornamental corners */}
            {[
              { top: 8, left: 8, transform: 'none' },
              { top: 8, right: 8, transform: 'scaleX(-1)' },
              { bottom: 8, left: 8, transform: 'scaleY(-1)' },
              { bottom: 8, right: 8, transform: 'scale(-1,-1)' },
            ].map((pos, i) => (
              <svg key={i} width="16" height="16" viewBox="0 0 16 16"
                   style={{ position: 'absolute', ...pos as React.CSSProperties }}>
                <path d="M0 0 L16 0 L16 2 L2 2 L2 16 L0 16 Z" fill="#c8960a" opacity="0.3"/>
              </svg>
            ))}

            <p style={{
              fontSize: 13,
              color: 'rgba(200,150,10,0.75)',
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontWeight: 600,
              letterSpacing: '0.35em',
              textTransform: 'uppercase',
            }}>
              Número Vencedor
            </p>

            <div style={{
              fontFamily: "var(--font-bebas-neue), sans-serif",
              fontSize: 'clamp(72px, 18vw, 96px)',
              lineHeight: 1,
              color: '#d4af37',
              letterSpacing: '0.06em',
              animation: 'dl-number-glow 2.5s ease-in-out infinite',
            }}>
              #{winner_ticket_number}
            </div>

            {/* Ornamental divider */}
            <div className="flex items-center gap-2 w-full">
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, rgba(200,150,10,0.3))' }}/>
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path d="M5 0 L10 5 L5 10 L0 5 Z" fill="none" stroke="#c8960a" strokeWidth="0.8" opacity="0.5"/>
                <circle cx="5" cy="5" r="1.5" fill="#c8960a" opacity="0.35"/>
              </svg>
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, rgba(200,150,10,0.3))' }}/>
            </div>

            <p style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#a08040',
              fontFamily: "var(--font-space-grotesk), sans-serif",
              letterSpacing: '0.04em',
            }}>
              {maskedName}
            </p>
          </div>

          {/* ── Proof of transparency ── */}
          <div style={{
            width: '100%',
            maxWidth: 340,
            borderRadius: 16,
            overflow: 'hidden',
            border: '1px solid rgba(200,150,10,0.1)',
            background: 'rgba(200,150,10,0.02)',
          }}>
            {/* Header bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              borderBottom: '1px solid rgba(200,150,10,0.07)',
              background: 'rgba(200,150,10,0.04)',
            }}>
              <ShieldCheck style={{ width: 14, height: 14, color: '#c8960a', opacity: 0.8 }}/>
              <span style={{
                fontSize: 13,
                fontFamily: "var(--font-space-grotesk), sans-serif",
                fontWeight: 600,
                color: 'rgba(240,221,176,0.8)',
                letterSpacing: '0.05em',
              }}>
                Comprovante de Transparência
              </span>
            </div>

            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {concurso && concurso > 0 && (
                <div className="flex justify-between items-center">
                  <span style={{ fontSize: 13, color: 'rgba(200,150,10,0.65)', fontFamily: "var(--font-space-grotesk), sans-serif" }}>
                    Concurso Federal
                  </span>
                  <span style={{
                    fontSize: 14,
                    fontFamily: "var(--font-space-grotesk), sans-serif",
                    fontWeight: 700,
                    color: '#c8a050',
                  }}>
                    #{concurso}
                  </span>
                </div>
              )}

              {primeiro_premio && (
                <div className="flex justify-between items-center">
                  <span style={{ fontSize: 13, color: 'rgba(200,150,10,0.65)', fontFamily: "var(--font-space-grotesk), sans-serif" }}>
                    1º Prêmio
                  </span>
                  <span style={{
                    fontSize: 14,
                    fontFamily: "var(--font-space-grotesk), sans-serif",
                    fontWeight: 700,
                    color: '#c8a050',
                  }}>
                    {primeiro_premio}
                  </span>
                </div>
              )}

              {lastTwo !== null && (
                <div className="flex justify-between items-center">
                  <span style={{ fontSize: 13, color: 'rgba(200,150,10,0.65)', fontFamily: "var(--font-space-grotesk), sans-serif" }}>
                    Últimos 2 dígitos
                  </span>
                  <span style={{
                    fontSize: 15,
                    fontFamily: "var(--font-space-grotesk), sans-serif",
                    fontWeight: 700,
                    color: '#d4af37',
                  }}>
                    {String(lastTwo).padStart(2, '0')}
                  </span>
                </div>
              )}

              {/* Formula */}
              <div style={{ borderTop: '1px solid rgba(200,150,10,0.1)', paddingTop: 12 }}>
                <p style={{
                  fontSize: 12,
                  color: 'rgba(200,150,10,0.6)',
                  fontFamily: "var(--font-space-grotesk), sans-serif",
                  fontWeight: 600,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}>
                  Fórmula aplicada
                </p>
                <code style={{
                  display: 'block',
                  fontSize: 13,
                  fontFamily: "var(--font-space-grotesk), sans-serif",
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(200,150,10,0.1)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  color: 'rgba(200,150,10,0.65)',
                }}>
                  ({lastTwo} % {raffle.total_numbers}) + 1 ={' '}
                  <span style={{ color: '#d4af37', fontWeight: 700 }}>{calculatedWinner}</span>
                  {isFallback && (
                    <span style={{ color: 'rgba(200,150,10,0.45)', marginLeft: 4 }}>
                      → fallback #{winner_ticket_number}*
                    </span>
                  )}
                </code>
                {isFallback && (
                  <p style={{ fontSize: 12, color: 'rgba(200,150,10,0.5)', marginTop: 8, lineHeight: 1.6 }}>
                    * Número calculado não foi vendido — usado o ticket vendido mais próximo.
                  </p>
                )}
              </div>

              {/* Verify link */}
              <a
                href="https://loterias.caixa.gov.br/Paginas/Federal.aspx"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 transition-colors"
                style={{ fontSize: 13, color: 'rgba(200,150,10,0.5)', fontFamily: "var(--font-space-grotesk), sans-serif" }}
                onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#c8960a')}
                onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = 'rgba(200,150,10,0.5)')}
              >
                <ExternalLink style={{ width: 13, height: 13 }}/>
                Verificar resultado oficial no site da Caixa
              </a>
            </div>
          </div>

          {/* ── Action buttons ── */}
          <div className="flex gap-3 w-full" style={{ maxWidth: 340 }}>
            <button
              onClick={handleShare}
              className="flex-1 flex items-center justify-center gap-2 font-bold rounded-xl transition-all"
              style={{
                padding: '12px 0',
                background: 'linear-gradient(135deg, #8b6914 0%, #c8960a 50%, #d4af37 100%)',
                color: '#0e0b05',
                fontFamily: "var(--font-space-grotesk), sans-serif",
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: '0.04em',
                boxShadow: '0 4px 24px rgba(200,150,10,0.25)',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 32px rgba(200,150,10,0.4)'}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 24px rgba(200,150,10,0.25)'}
            >
              <Share2 style={{ width: 15, height: 15 }}/>
              Compartilhar
            </button>
            <button
              onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success('Link copiado!'); }}
              className="flex items-center justify-center gap-2 rounded-xl transition-all"
              style={{
                padding: '12px 16px',
                background: 'rgba(200,150,10,0.05)',
                border: '1px solid rgba(200,150,10,0.22)',
                color: 'rgba(200,150,10,0.55)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(200,150,10,0.12)';
                (e.currentTarget as HTMLButtonElement).style.color = '#c8960a';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(200,150,10,0.05)';
                (e.currentTarget as HTMLButtonElement).style.color = 'rgba(200,150,10,0.55)';
              }}
            >
              <Copy style={{ width: 15, height: 15 }}/>
            </button>
          </div>

          {/* Raffle image */}
          <div className="flex items-center gap-3" style={{ fontSize: 13, color: 'rgba(200,150,10,0.55)' }}>
            <div style={{
              position: 'relative',
              width: 40, height: 40,
              borderRadius: 8,
              overflow: 'hidden',
              border: '1px solid rgba(200,150,10,0.2)',
            }}>
              <Image src={raffle.image_url} alt={raffle.title} fill className="object-cover" unoptimized/>
            </div>
            <span style={{ fontFamily: "var(--font-space-grotesk), sans-serif", color: 'rgba(200,150,10,0.65)' }}>{raffle.title}</span>
          </div>
        </div>
      </div>
    </>
  );
}
