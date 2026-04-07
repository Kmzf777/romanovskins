import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

interface HeroBannerProps {
    totalWinners: number;
    totalValue: number;
}

export function HeroBanner({ totalWinners, totalValue }: HeroBannerProps) {
    const formattedValue = totalValue >= 1000
        ? `R$${(totalValue / 1000).toFixed(0)}k`
        : `R$${totalValue.toFixed(0)}`;

    return (
        <section className="relative min-h-[85vh] flex items-center overflow-hidden">
            {/* Full background image */}
            <img
                src="/hero-romanov.png"
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover object-center select-none pointer-events-none"
                style={{ filter: 'drop-shadow(0 0 60px rgba(245,197,24,0.2))' }}
            />

            {/* Dark overlay — left side opaque for text, right side reveals image */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: 'linear-gradient(to right, #0A0A0B 35%, rgba(10,10,11,0.6) 60%, rgba(10,10,11,0.1) 100%)',
                }}
            />
            {/* Bottom fade */}
            <div
                className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
                style={{ background: 'linear-gradient(to bottom, transparent, #0A0A0B)' }}
            />

            <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-10">
                <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                    {/* Left: Text content */}
                    <div className="flex-1 max-w-xl">
                        {/* Tag */}
                        <span
                            className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-6"
                            style={{
                                backgroundColor: 'rgba(245,197,24,0.12)',
                                border: '1px solid rgba(245,197,24,0.4)',
                                color: '#F5C518',
                            }}
                        >
                            ● RIFAS ATIVAS
                        </span>

                        {/* Headline */}
                        <h1
                            className="leading-none mb-6"
                            style={{
                                fontFamily: 'var(--font-bebas-neue)',
                                fontSize: 'clamp(56px, 8vw, 96px)',
                                color: '#F0EAD6',
                                lineHeight: 0.95,
                            }}
                        >
                            CONCORRA A{' '}
                            <br />
                            <span
                                style={{
                                    color: '#F5C518',
                                    textShadow: '0 0 40px rgba(245,197,24,0.5)',
                                }}
                            >
                                SKINS RARAS
                            </span>
                            <br />
                            DE CS2.
                        </h1>

                        {/* Subtitle */}
                        <p className="text-base md:text-lg mb-8 leading-relaxed" style={{ color: '#7A7A8A' }}>
                            Rifas com sorteio transparente pela Loteria Federal.
                            <br />
                            Pague via PIX e receba imediatamente.
                        </p>

                        {/* CTAs */}
                        <div className="flex flex-wrap gap-4 mb-10">
                            <Link
                                href="/#rifas"
                                className="inline-flex items-center gap-2 px-8 py-4 text-base font-black uppercase tracking-widest rounded-lg transition-all hover:scale-105"
                                style={{
                                    backgroundColor: '#F5C518',
                                    color: '#0A0A0B',
                                    boxShadow: '0 0 30px rgba(245,197,24,0.3)',
                                }}
                            >
                                VER RIFAS ATIVAS →
                            </Link>
                            <Link
                                href="/como-funciona"
                                className="inline-flex items-center px-6 py-4 text-base font-bold uppercase tracking-wider rounded-lg transition-all hover:border-white/50"
                                style={{
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    color: '#F0EAD6',
                                }}
                            >
                                Como funciona?
                            </Link>
                        </div>

                        {/* Stats */}
                        <div className="flex flex-wrap gap-6">
                            <span
                                className="text-sm"
                                style={{ fontFamily: 'var(--font-geist-mono)', color: '#7A7A8A' }}
                            >
                                🏆 {totalWinners} Ganhadores
                            </span>
                            <span
                                className="text-sm"
                                style={{ fontFamily: 'var(--font-geist-mono)', color: '#7A7A8A' }}
                            >
                                🎯 {formattedValue} em skins entregues
                            </span>
                        </div>
                    </div>

                </div>
            </div>

            {/* Scroll indicator */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-scroll-cue">
                <ChevronDown size={24} style={{ color: '#4A4A5A' }} />
            </div>
        </section>
    );
}
