'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, LogOut } from 'lucide-react';
import { logoutAction } from '@/server/auth-actions';

interface HeaderContentProps {
    user: any;
}

const navLinks = [
    { href: '/#rifas', label: 'Rifas' },
    { href: '/como-funciona', label: 'Como Funciona' },
    { href: '/ganhadores', label: 'Ganhadores' },
];

export default function HeaderContent({ user }: HeaderContentProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <header
            className="w-full h-[72px] px-6 md:px-10 flex items-center justify-between z-50 relative sticky top-0"
            style={{
                backgroundColor: 'rgba(10,10,11,0.92)',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid #2A2A32',
            }}
        >
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity shrink-0">
                <div className="relative w-10 h-10 shrink-0">
                    <Image src="/logo-icon.png" alt="Romanov Rifas Logo" fill className="object-contain" priority />
                </div>
                <span
                    className="text-[22px] tracking-wider hidden md:block"
                    style={{ fontFamily: 'var(--font-bebas-neue)', color: '#F5C518' }}
                >
                    ROMANOV RIFAS
                </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-8">
                {navLinks.map(link => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className="text-sm font-medium transition-colors hover:text-white"
                        style={{ color: '#7A7A8A' }}
                    >
                        {link.label}
                    </Link>
                ))}
            </nav>

            {/* Desktop actions */}
            <div className="hidden md:flex items-center gap-3">
                {user ? (
                    <>
                        <Link
                            href="/meus-tickets"
                            className="text-sm font-medium px-4 py-2 rounded-lg transition-colors hover:text-white"
                            style={{ color: '#7A7A8A', border: '1px solid #2A2A32' }}
                        >
                            Meus Tickets
                        </Link>
                        <span className="text-sm" style={{ color: '#7A7A8A' }}>
                            Olá, <strong style={{ color: '#F0EAD6' }}>{user.name}</strong>
                        </span>
                        <form action={logoutAction}>
                            <button
                                type="submit"
                                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg transition-all hover:bg-[#E63946]/10"
                                style={{ color: '#E63946', border: '1px solid rgba(230,57,70,0.25)' }}
                                title="Sair"
                            >
                                <LogOut size={14} />
                                Sair
                            </button>
                        </form>
                    </>
                ) : (
                    <>
                        <Link
                            href="/register"
                            className="px-4 py-2 text-sm font-bold rounded-lg transition-all hover:bg-white/5"
                            style={{ color: '#F0EAD6', border: '1px solid #2A2A32' }}
                        >
                            CRIAR CONTA
                        </Link>
                        <Link
                            href="/login"
                            className="px-5 py-2 text-sm font-black rounded-lg transition-all hover:opacity-90"
                            style={{ backgroundColor: '#F5C518', color: '#0A0A0B' }}
                        >
                            ENTRAR
                        </Link>
                    </>
                )}
            </div>

            {/* Mobile hamburger */}
            <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden p-2 transition-colors"
                style={{ color: isMenuOpen ? '#F5C518' : '#F0EAD6' }}
                aria-label="Menu"
            >
                {isMenuOpen ? <X size={26} /> : <Menu size={26} />}
            </button>

            {/* Mobile menu */}
            {isMenuOpen && (
                <div
                    className="absolute top-[72px] left-0 w-full flex flex-col items-center gap-5 py-8 md:hidden z-40"
                    style={{ backgroundColor: 'rgba(10,10,11,0.97)', borderTop: '1px solid #2A2A32' }}
                >
                    {navLinks.map(link => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className="text-base font-medium hover:text-yellow-400 transition-colors"
                            style={{ color: '#F0EAD6' }}
                            onClick={() => setIsMenuOpen(false)}
                        >
                            {link.label}
                        </Link>
                    ))}
                    <div
                        className="flex flex-col gap-3 w-full px-8 pt-4"
                        style={{ borderTop: '1px solid #2A2A32' }}
                    >
                        {user ? (
                            <>
                                <Link
                                    href="/meus-tickets"
                                    className="w-full py-3 text-center font-bold rounded-lg"
                                    style={{ border: '1px solid #2A2A32', color: '#F0EAD6' }}
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    Meus Tickets
                                </Link>
                                <form action={logoutAction}>
                                    <button
                                        type="submit"
                                        className="w-full py-3 flex items-center justify-center gap-2 font-bold rounded-lg transition-all hover:bg-[#E63946]/10"
                                        style={{ border: '1px solid rgba(230,57,70,0.3)', color: '#E63946' }}
                                    >
                                        <LogOut size={16} />
                                        Sair da Conta
                                    </button>
                                </form>
                            </>
                        ) : (
                            <>
                                <Link
                                    href="/register"
                                    className="w-full py-3 text-center font-bold rounded-lg"
                                    style={{ border: '1px solid #2A2A32', color: '#F0EAD6' }}
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    CRIAR CONTA
                                </Link>
                                <Link
                                    href="/login"
                                    className="w-full py-3 text-center font-black rounded-lg"
                                    style={{ backgroundColor: '#F5C518', color: '#0A0A0B' }}
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    ENTRAR
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
}
