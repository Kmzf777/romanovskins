import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle } from 'lucide-react';

interface FooterProps {
    stats: {
        totalRaffles: number;
        totalWinners: number;
        totalValue: number;
    };
}

const navLinks = [
    { href: '/#rifas', label: 'Rifas' },
    { href: '/como-funciona', label: 'Como Funciona' },
    { href: '/ganhadores', label: 'Ganhadores' },
    { href: '/meus-tickets', label: 'Meus Tickets' },
    { href: '/login', label: 'Entrar' },
];

const seals = [
    'Sorteio pela Loteria Federal',
    'Pagamento seguro via PIX',
    'Entrega de skin garantida',
];

export default function Footer({ stats }: FooterProps) {
    const formattedValue = stats.totalValue >= 1000
        ? `R$${(stats.totalValue / 1000).toFixed(0)}k`
        : `R$${stats.totalValue.toFixed(0)}`;

    return (
        <footer
            className="relative z-10 mt-24 isolate"
            style={{ borderTop: '1px solid #2A2A32' }}
        >
            <div className="max-w-6xl mx-auto px-6 md:px-10 py-16">
                {/* Top row */}
                <div className="flex flex-col md:flex-row justify-between gap-12 mb-12">
                    {/* Brand */}
                    <div className="space-y-3">
                        <Link href="/" className="flex items-center gap-3">
                            <div className="relative w-10 h-10">
                                <Image src="/logo-icon.png" alt="Romanov Rifas" fill className="object-contain" />
                            </div>
                            <span
                                className="text-[22px]"
                                style={{ fontFamily: 'var(--font-bebas-neue)', color: '#F5C518' }}
                            >
                                ROMANOV RIFAS
                            </span>
                        </Link>
                        <p className="text-sm max-w-xs" style={{ color: '#7A7A8A' }}>
                            Concorra a skins raras de CS2 com sorteio transparente pela Loteria Federal.
                        </p>
                    </div>

                    {/* Nav links */}
                    <nav className="flex flex-col gap-3">
                        {navLinks.map(link => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="text-sm transition-colors hover:text-white"
                                style={{ color: '#7A7A8A' }}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                </div>

                {/* Stats row */}
                <div
                    className="flex flex-wrap justify-center gap-8 py-8 mb-8"
                    style={{ borderTop: '1px solid #2A2A32', borderBottom: '1px solid #2A2A32' }}
                >
                    <div className="text-center">
                        <p
                            className="text-3xl font-black"
                            style={{ fontFamily: 'var(--font-geist-mono)', color: '#F5C518' }}
                        >
                            🏆 {stats.totalWinners}
                        </p>
                        <p className="text-xs uppercase tracking-wider mt-1" style={{ color: '#7A7A8A' }}>Ganhadores</p>
                    </div>
                    <div className="text-center">
                        <p
                            className="text-3xl font-black"
                            style={{ fontFamily: 'var(--font-geist-mono)', color: '#F5C518' }}
                        >
                            🎯 {formattedValue}
                        </p>
                        <p className="text-xs uppercase tracking-wider mt-1" style={{ color: '#7A7A8A' }}>Em skins entregues</p>
                    </div>
                    <div className="text-center">
                        <p
                            className="text-3xl font-black"
                            style={{ fontFamily: 'var(--font-geist-mono)', color: '#F5C518' }}
                        >
                            🎰 {stats.totalRaffles}
                        </p>
                        <p className="text-xs uppercase tracking-wider mt-1" style={{ color: '#7A7A8A' }}>Rifas realizadas</p>
                    </div>
                </div>

                {/* Seals row */}
                <div className="flex flex-wrap justify-center gap-4 mb-10">
                    {seals.map(seal => (
                        <div
                            key={seal}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
                            style={{
                                backgroundColor: 'rgba(45,198,83,0.08)',
                                border: '1px solid rgba(45,198,83,0.2)',
                                color: '#2DC653',
                            }}
                        >
                            <CheckCircle size={14} />
                            <span>{seal}</span>
                        </div>
                    ))}
                </div>

                {/* Copyright */}
                <p className="text-center text-xs" style={{ color: '#4A4A5A' }}>
                    © {new Date().getFullYear()} Romanov Rifas — Todos os direitos reservados.
                </p>
            </div>
        </footer>
    );
}
