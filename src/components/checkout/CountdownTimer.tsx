'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
    expiresAt: string;
    raffleId: string;
}

export function CountdownTimer({ expiresAt, raffleId }: CountdownTimerProps) {
    const router = useRouter();
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [expired, setExpired] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const target = new Date(expiresAt).getTime();
        const tick = () => {
            const remaining = target - Date.now();
            if (remaining <= 0) { setExpired(true); setTimeLeft(0); return; }
            setTimeLeft(remaining);
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [expiresAt]);

    useEffect(() => {
        if (!expired) return;
        const timeout = setTimeout(() => router.push(`/rifa/${raffleId}`), 3000);
        return () => clearTimeout(timeout);
    }, [expired, raffleId, router]);

    if (!mounted) return null;

    if (expired) {
        return (
            <div
                className="flex items-center gap-3 px-4 py-3 rounded-xl mb-6 text-sm font-medium"
                style={{ backgroundColor: 'rgba(230,57,70,0.1)', border: '1px solid rgba(230,57,70,0.3)', color: '#E63946' }}
            >
                <Clock size={16} />
                Reserva expirada. Redirecionando...
            </div>
        );
    }

    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    const isUrgent = timeLeft < 5 * 60 * 1000;

    return (
        <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl mb-6"
            style={{
                backgroundColor: isUrgent ? 'rgba(230,57,70,0.1)' : 'rgba(245,197,24,0.08)',
                border: `1px solid ${isUrgent ? 'rgba(230,57,70,0.3)' : 'rgba(245,197,24,0.25)'}`,
            }}
        >
            <Clock size={16} style={{ color: isUrgent ? '#E63946' : '#F5C518', flexShrink: 0 }} />
            <span className="text-sm" style={{ color: isUrgent ? '#E63946' : '#7A7A8A' }}>
                Reserva expira em{' '}
                <span
                    className="font-black text-xl"
                    style={{ fontFamily: 'var(--font-geist-mono)', color: isUrgent ? '#E63946' : '#F5C518' }}
                >
                    {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </span>
            </span>
        </div>
    );
}
