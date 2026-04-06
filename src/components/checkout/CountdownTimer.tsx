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
            if (remaining <= 0) {
                setExpired(true);
                setTimeLeft(0);
                return;
            }
            setTimeLeft(remaining);
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [expiresAt]);

    useEffect(() => {
        if (!expired) return;
        const timeout = setTimeout(() => {
            router.push(`/rifa/${raffleId}`);
        }, 3000);
        return () => clearTimeout(timeout);
    }, [expired, raffleId, router]);

    // Evitar hydration mismatch
    if (!mounted) return null;

    if (expired) {
        return (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-red-400 text-sm font-medium">
                    Reserva expirada. Redirecionando...
                </span>
            </div>
        );
    }

    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    const isUrgent = timeLeft < 5 * 60 * 1000;

    return (
        <div className={`border rounded-lg p-3 flex items-center gap-2 mb-4 ${
            isUrgent
                ? 'bg-red-500/10 border-red-500/30'
                : 'bg-yellow-500/10 border-yellow-500/30'
        }`}>
            <Clock className={`w-4 h-4 shrink-0 ${isUrgent ? 'text-red-400' : 'text-yellow-400'}`} />
            <span className={`text-sm font-medium ${isUrgent ? 'text-red-400' : 'text-yellow-400'}`}>
                Reserva expira em{' '}
                <span className="font-mono font-bold text-lg">
                    {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </span>
            </span>
        </div>
    );
}
