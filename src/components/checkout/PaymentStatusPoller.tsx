'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export function PaymentStatusPoller({ tid }: { tid: string }) {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const [checking, setChecking] = useState(false);
  const maxAttempts = 24; // ~2 minutes (24 × 5s)

  const checkStatus = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch(`/api/confirm-payment?tid=${tid}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.status === 'paid') {
        router.refresh();
        return true;
      }
    } catch {
      // Ignore network errors, keep polling
    } finally {
      setChecking(false);
    }
    return false;
  }, [tid, router]);

  useEffect(() => {
    if (attempts >= maxAttempts) return;

    const timer = setTimeout(async () => {
      const paid = await checkStatus();
      if (!paid) {
        setAttempts(prev => prev + 1);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [attempts, checkStatus, maxAttempts]);

  if (attempts >= maxAttempts) {
    return (
      <div className="text-center mt-3 space-y-2">
        <p className="text-xs text-yellow-500/60">
          Confirmação automática não disponível.
        </p>
        <button
          onClick={() => { setAttempts(0); checkStatus(); }}
          className="text-xs underline text-yellow-400 hover:text-yellow-300 transition-colors"
        >
          Verificar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 mt-3">
      <span
        className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-ping"
        style={{ animationDuration: '1.2s' }}
      />
      <p className="text-xs text-yellow-500/70">
        {checking ? 'Verificando...' : 'Aguardando confirmação do pagamento...'}
      </p>
    </div>
  );
}
