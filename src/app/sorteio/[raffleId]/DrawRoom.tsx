'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CountdownPhase } from './CountdownPhase';
import { ProofPhase } from './ProofPhase';

// Overlay defined outside component so React doesn't remount it on every render
function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        .dl-overlay-bg {
          background-color: #090704;
          background-image: url('/dlore9-16.png');
          background-size: cover;
          background-position: center top;
          background-repeat: no-repeat;
        }
        @media (min-width: 640px) {
          .dl-overlay-bg {
            background-image: url('/dlore16-9.png');
            background-position: center center;
          }
        }
      `}</style>
      {/* Background layer — fixed, never scrolls */}
      <div className="dl-overlay-bg fixed inset-0 z-[100]" aria-hidden="true" />
      {/* Content layer — scrollable, sits on top of background */}
      <div className="fixed inset-0 z-[101] overflow-y-auto overflow-x-hidden">
        {children}
      </div>
    </>
  );
}

type DrawPhase = 'countdown' | 'drawn' | 'no_session';

interface DrawSession {
  id: string;
  raffle_id: string;
  draw_at: string;
  countdown_minutes: number;
  status: 'waiting' | 'drawing' | 'drawn';
  winner_ticket_number: number | null;
  winner_name: string | null;
  concurso: number | null;
  primeiro_premio: string | null;
  target_concurso: number | null;
}

interface Raffle {
  id: string;
  title: string;
  image_url: string;
  total_numbers: number;
  status: string;
}

interface DrawRoomProps {
  raffle: Raffle;
  initialSession: DrawSession | null;
}

export function DrawRoom({ raffle, initialSession }: DrawRoomProps) {
  const [session, setSession] = useState<DrawSession | null>(initialSession);
  const [phase, setPhase] = useState<DrawPhase>(() => {
    if (!initialSession) return 'no_session';
    if (initialSession.status === 'drawn') return 'drawn';
    return 'countdown'; // 'waiting' e 'drawing' ficam no countdown (roleta integrada)
  });
  const [drawError, setDrawError] = useState<string | null>(null);
  const drawTriggered = useRef(false);
  // Keep a ref to session.draw_at so triggerDraw can check it without stale closure
  const drawAtRef = useRef<string | null>(initialSession?.draw_at ?? null);
  useEffect(() => { drawAtRef.current = session?.draw_at ?? null; }, [session?.draw_at]);

  // Lock body scroll while overlay is active
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Dispara o sorteio via API (idempotente — qualquer viewer pode chamar)
  const triggerDraw = useCallback(async () => {
    if (drawTriggered.current) return;
    drawTriggered.current = true;
    setDrawError(null);
    try {
      const res = await fetch(`/api/sorteio/${raffle.id}/draw`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDrawError(data.error || 'Erro ao realizar sorteio.');
        drawTriggered.current = false;
      } else if (data.skipped) {
        drawTriggered.current = false;
        // If draw_at has already passed (clock skew / timing edge case), retry shortly
        const drawAtMs = drawAtRef.current ? new Date(drawAtRef.current).getTime() : 0;
        if (drawAtMs > 0 && drawAtMs <= Date.now()) {
          setTimeout(() => triggerDraw(), 5000);
        }
      }
    } catch (err) {
      console.error('Error triggering draw:', err);
      setDrawError('Erro de conexão. Tente recarregar a página.');
      drawTriggered.current = false;
    }
  }, [raffle.id]);

  // Supabase Realtime — escuta mudanças na draw_session
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`draw_session:${raffle.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'draw_sessions',
          filter: `raffle_id=eq.${raffle.id}`,
        },
        (payload) => {
          const updated = payload.new as DrawSession;
          setSession(updated);
          // Não avança fase aqui — a CountdownPhase detecta winnerNumber
          // e chama onDrawComplete quando a animação da roleta termina
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'draw_sessions',
          filter: `raffle_id=eq.${raffle.id}`,
        },
        (payload) => {
          const inserted = payload.new as DrawSession;
          setSession(inserted);
          setPhase('countdown');
          drawTriggered.current = false;
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [raffle.id]);

  if (phase === 'no_session') {
    return (
      <Overlay>
        <div className="min-h-full flex items-center justify-center text-white">
          <div className="text-center space-y-3">
            <p className="text-2xl font-bold text-zinc-400">Nenhum sorteio agendado</p>
            <p className="text-zinc-600 text-sm">Aguarde o administrador abrir a sala.</p>
          </div>
        </div>
      </Overlay>
    );
  }

  if (phase === 'countdown' && session) {
    return (
      <Overlay>
        <CountdownPhase
          raffle={raffle}
          drawAt={session.draw_at}
          onCountdownEnd={triggerDraw}
          onDrawComplete={() => setPhase('drawn')}
          drawError={drawError}
          winnerNumber={session.winner_ticket_number}
          targetConcurso={session.target_concurso ?? undefined}
        />
      </Overlay>
    );
  }

  if (phase === 'drawn' && session?.winner_ticket_number !== null) {
    return (
      <Overlay>
        <ProofPhase
          raffle={raffle}
          session={session!}
        />
      </Overlay>
    );
  }

  // drawn mas winner_ticket_number ainda nulo (edge case de falha parcial)
  if (phase === 'drawn') {
    return (
      <Overlay>
        <div className="min-h-full flex items-center justify-center text-white">
          <div className="text-center space-y-3">
            <p className="text-2xl font-bold text-zinc-400">Aguardando resultado...</p>
            <p className="text-zinc-600 text-sm">Resultado será atualizado em breve.</p>
          </div>
        </div>
      </Overlay>
    );
  }

  // Fallback (não deveria chegar aqui)
  return (
    <Overlay>
      <div className="min-h-full flex items-center justify-center text-white">
        <div className="text-center space-y-4 animate-pulse">
          <div className="text-6xl font-black text-yellow-400">⚡</div>
          <p className="text-xl font-bold">Sorteando...</p>
        </div>
      </div>
    </Overlay>
  );
}
