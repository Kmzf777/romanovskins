import Link from 'next/link';
import { LiveDrawData } from '@/server/raffle-actions';

interface LiveDrawBannerProps {
  liveDraws: LiveDrawData[];
}

export function LiveDrawBanner({ liveDraws }: LiveDrawBannerProps) {
  if (liveDraws.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-6 md:px-10 pt-10 pb-2">
      <style>{`
        /* ── Dot pulse ── */
        @keyframes ldot {
          0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 rgba(230,57,70,0.7); }
          50%       { opacity: 0.5; transform: scale(0.8); box-shadow: 0 0 0 6px rgba(230,57,70,0); }
        }

        /* ── "AO VIVO" flicker — broadcast signal loss ── */
        @keyframes flicker {
          0%,  8%,  10%, 18%, 20%, 100% { opacity: 1; }
          9%,  19%                       { opacity: 0.15; }
        }

        /* ── Text glow breathe ── */
        @keyframes glow-breathe {
          0%, 100% { text-shadow: 0 0 8px rgba(230,57,70,0.9), 0 0 24px rgba(230,57,70,0.5); }
          50%      { text-shadow: 0 0 16px rgba(230,57,70,1),   0 0 48px rgba(230,57,70,0.7), 0 0 80px rgba(230,57,70,0.3); }
        }

        /* ── Card border pulse ── */
        @keyframes card-pulse {
          0%, 100% { box-shadow: 0 0 0 1px rgba(230,57,70,0.35), 0 4px 24px rgba(0,0,0,0.5); }
          50%      { box-shadow: 0 0 0 1px rgba(230,57,70,0.75), 0 4px 32px rgba(230,57,70,0.12); }
        }

        /* ── Scanline sweep ── */
        @keyframes scan {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }

        /* ── CTA shimmer ── */
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }

        .live-dot {
          animation: ldot 1.4s ease-in-out infinite;
        }
        .live-flicker {
          animation: flicker 7s ease-in-out infinite, glow-breathe 2.5s ease-in-out infinite;
          color: #E63946;
        }
        .live-card {
          animation: card-pulse 3s ease-in-out infinite;
          position: relative;
          overflow: hidden;
        }
        .live-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 3px,
            rgba(0,0,0,0.04) 3px,
            rgba(0,0,0,0.04) 4px
          );
          pointer-events: none;
          z-index: 1;
        }
        .live-card-scan {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 2;
          overflow: hidden;
        }
        .live-card-scan::after {
          content: '';
          position: absolute;
          left: 0; right: 0;
          height: 30%;
          background: linear-gradient(to bottom, transparent, rgba(230,57,70,0.04), transparent);
          animation: scan 4s linear infinite;
        }
        .live-cta {
          background: linear-gradient(
            90deg,
            #E63946 0%,
            #ff4d5a 40%,
            #E63946 60%,
            #c62b37 100%
          );
          background-size: 200% auto;
          animation: shimmer 3s linear infinite;
        }
        .live-section-bar {
          background: linear-gradient(90deg, #E63946, rgba(230,57,70,0.15), transparent);
        }
      `}</style>

      {/* Top accent bar */}
      <div
        className="live-section-bar h-[2px] w-full rounded-full mb-6"
      />

      {/* Header row */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <h2
          style={{
            fontFamily: 'var(--font-bebas-neue)',
            fontSize: 'clamp(30px, 4.5vw, 48px)',
            color: '#F0EAD6',
            lineHeight: 1,
            letterSpacing: '0.02em',
          }}
        >
          SORTEIO{' '}
          <span className="live-flicker">AO VIVO!</span>
        </h2>

        {/* LIVE pill */}
        <span
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest shrink-0"
          style={{
            backgroundColor: 'rgba(230,57,70,0.1)',
            border: '1px solid rgba(230,57,70,0.45)',
            color: '#E63946',
          }}
        >
          <span
            className="live-dot inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: '#E63946' }}
          />
          LIVE
        </span>

        {/* Count pill */}
        {liveDraws.length > 1 && (
          <span
            className="text-[11px] font-black px-2.5 py-1 rounded-full"
            style={{
              backgroundColor: 'rgba(245,197,24,0.08)',
              border: '1px solid rgba(245,197,24,0.2)',
              color: '#F5C518',
              letterSpacing: '0.05em',
            }}
          >
            {liveDraws.length} SALAS ABERTAS
          </span>
        )}
      </div>

      {/* Cards grid */}
      <div
        className={
          liveDraws.length === 1
            ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
            : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
        }
      >
        {liveDraws.map(draw => {
          const sold        = draw.sold_count;
          const total       = draw.total_numbers;
          const available   = draw.available_count;
          const soldPercent = total > 0 ? Math.round((sold / total) * 100) : 0;
          const isUrgent    = soldPercent >= 80;
          const progressColor = isUrgent ? '#E63946' : soldPercent >= 50 ? '#F5C518' : '#2DC653';

          return (
            <div
              key={draw.session_id}
              className="live-card rounded-2xl"
              style={{ backgroundColor: '#111114', border: '1px solid rgba(230,57,70,0.35)' }}
            >
              {/* Scanline overlay */}
              <div className="live-card-scan" />

              {/* Image */}
              <div className="relative aspect-video overflow-hidden rounded-t-2xl">
                <img
                  src={draw.image_url}
                  alt={draw.title}
                  className="w-full h-full object-cover"
                  style={{ filter: 'brightness(0.88) saturate(1.1)' }}
                />

                {/* Gradient overlay */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(to top, #111114 0%, rgba(17,17,20,0.3) 50%, transparent 100%)',
                  }}
                />

                {/* AO VIVO badge */}
                <div
                  className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-widest z-10"
                  style={{
                    backgroundColor: '#E63946',
                    color: '#fff',
                    boxShadow: '0 2px 12px rgba(230,57,70,0.5)',
                  }}
                >
                  <span
                    className="live-dot inline-block w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: '#fff' }}
                  />
                  AO VIVO
                </div>

                {/* Wear + Float badges */}
                <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end z-10">
                  {draw.wear_condition && (
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                      style={{
                        backgroundColor: 'rgba(10,10,11,0.85)',
                        color: '#F5C518',
                        border: '1px solid rgba(245,197,24,0.3)',
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      {draw.wear_condition}
                    </span>
                  )}
                  {draw.float_value && (
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-mono"
                      style={{
                        backgroundColor: 'rgba(10,10,11,0.85)',
                        color: '#7A7A8A',
                        border: '1px solid #2A2A32',
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      {draw.float_value}
                    </span>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="p-4 space-y-3 relative z-10">
                <h3
                  className="font-bold leading-tight line-clamp-2"
                  style={{ color: '#F0EAD6', fontSize: '14px' }}
                >
                  {draw.title}
                </h3>

                <p
                  className="font-black"
                  style={{
                    fontFamily: 'var(--font-bebas-neue)',
                    fontSize: '22px',
                    color: '#F5C518',
                    lineHeight: 1,
                  }}
                >
                  R$ {draw.price_per_ticket.toFixed(2).replace('.', ',')}
                  <span
                    className="text-xs ml-1"
                    style={{ color: '#7A7A8A', fontFamily: 'var(--font-space-grotesk)' }}
                  >
                    / cota
                  </span>
                </p>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ backgroundColor: '#2A2A32' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${soldPercent}%`, backgroundColor: progressColor }}
                    />
                  </div>
                  <div
                    className="flex justify-between text-[10px]"
                    style={{ color: '#4A4A5A', fontFamily: 'var(--font-geist-mono)' }}
                  >
                    <span>{soldPercent}% vendido</span>
                    <span>{available} restantes de {total}</span>
                  </div>
                </div>

                {/* CTA */}
                <Link
                  href={`/sorteio/${draw.raffle_id}`}
                  className="live-cta flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-transform duration-200 hover:scale-[1.02] hover:brightness-110"
                  style={{ color: '#fff', boxShadow: '0 4px 20px rgba(230,57,70,0.35)' }}
                >
                  <span
                    className="live-dot inline-block w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: '#fff' }}
                  />
                  ASSISTIR AO VIVO
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom divider */}
      <div
        className="mt-8 h-px"
        style={{ background: 'linear-gradient(to right, rgba(230,57,70,0.3), rgba(42,42,50,0.6), transparent)' }}
      />
    </section>
  );
}
