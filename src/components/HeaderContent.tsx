'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';

interface HeaderContentProps {
    user: any;
}

export default function HeaderContent({ user }: HeaderContentProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

    return (
        <header className="w-full h-20 px-8 flex items-center justify-between z-50 relative" style={{ backgroundColor: '#101011' }}>
            {/* Mobile Hamburger Button */}
            <button
                onClick={toggleMenu}
                className="md:hidden p-2 -ml-2 text-white hover:text-[#F5C518] transition-colors z-20"
                aria-label="Menu"
            >
                {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>

            {/* Logo Section */}
            {/* Mobile: Absolute Center. Desktop: Relative Left */}
            <Link
                href="/"
                className={`
                    flex items-center gap-3 hover:opacity-90 transition-opacity
                    absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0 md:mr-auto
                `}
            >
                <div className="relative w-16 h-16 shrink-0">
                    <Image
                        src="/logo-icon.png"
                        alt="Romanov Rifas Logo"
                        fill
                        className="object-contain"
                        priority
                    />
                </div>
                {/* User said "somente o logo" for mobile. Let's hide the text on mobile if that's the intent.
                    "deixe somente o logo. centralizado" -> likely implies just the icon.
                    But to be safe and consistent with brand, I'll keep the text hidden on mobile if space is tight,
                    or show it if it fits. The prompt says "somente o logo". Literal interpretation: Only the graphic.
                    Let's hide the text on small screens.
                */}
                <span
                    className="hidden md:block text-xl md:text-2xl text-[#F5C518] uppercase tracking-wider"
                    style={{ fontWeight: 900 }}
                >
                    ROMANOV RIFAS
                </span>
            </Link>

            {/* Desktop Right Section (Actions) */}
            <div className="hidden md:flex items-center gap-3 md:gap-4">
                {user ? (
                    <div className="flex items-center gap-2 text-white">
                        <span className="text-sm font-medium opacity-70">Olá,</span>
                        <span className="font-bold">{user.whatsapp}</span>
                    </div>
                ) : (
                    <>
                        <Link
                            href="/register"
                            className="px-4 py-2 text-sm md:text-base font-bold text-white border-2 border-white hover:bg-white/10 transition-colors text-center whitespace-nowrap"
                            style={{ borderRadius: '8px' }}
                        >
                            CRIAR CONTA
                        </Link>
                        <Link
                            href="/login"
                            className="px-4 py-2 text-sm md:text-base font-bold text-[#1A1A1D] border-2 border-[#F5C518] bg-[#F5C518] hover:bg-[#F5C518]/90 transition-colors text-center whitespace-nowrap"
                            style={{ borderRadius: '8px' }}
                        >
                            ENTRAR
                        </Link>
                    </>
                )}
            </div>

            {/* Mobile Menu Dropdown */}
            {isMenuOpen && (
                <div
                    className="absolute top-20 left-0 w-full flex flex-col items-center gap-6 py-8 shadow-xl md:hidden z-40"
                    style={{ backgroundColor: '#101011', borderTop: '1px solid #2A2A2E' }}
                >
                    {user ? (
                        <div className="flex flex-col items-center gap-2 text-white">
                            <span className="text-sm font-medium opacity-70">Logado como</span>
                            <span className="font-bold text-lg">{user.whatsapp}</span>
                            {/* Maybe add Logout here later if requested */}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 w-full px-8">
                            <Link
                                href="/register"
                                className="w-full px-4 py-3 text-base font-bold text-white border-2 border-white hover:bg-white/10 transition-colors text-center"
                                style={{ borderRadius: '8px' }}
                                onClick={() => setIsMenuOpen(false)}
                            >
                                CRIAR CONTA
                            </Link>
                            <Link
                                href="/login"
                                className="w-full px-4 py-3 text-base font-bold text-[#1A1A1D] border-2 border-[#F5C518] bg-[#F5C518] hover:bg-[#F5C518]/90 transition-colors text-center"
                                style={{ borderRadius: '8px' }}
                                onClick={() => setIsMenuOpen(false)}
                            >
                                ENTRAR
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </header>
    );
}
