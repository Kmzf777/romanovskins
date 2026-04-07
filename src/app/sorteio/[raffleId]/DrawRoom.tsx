'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CountdownPhase } from './CountdownPhase';
import { RoulettePhase } from './RoulettePhase';
import { ProofPhase } from './ProofPhase';

type DrawPhase = 'countdown' | 'drawing' | 'drawn' | 'no_session';

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
    if (initialSession.status === 'drawing') return 'drawing';
    return 'countdown';
  });
  const drawTriggered = useRef(false);

  // Dispara o sorteio via API (idempotente — qualquer viewer pode chamar)
  const triggerDraw = useCallback(async () => {
    if (drawTriggered.current) return;
    drawTriggered.current = true;
    try {
      await fetch(`/api/sorteio/${raffle.id}/draw`, { method: 'POST' });
    } catch (err) {
      console.error('Error triggering draw:', err);
      drawTriggered.current = false; // permite retry
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
          if (updated.status === 'drawing' || updated.status === 'drawn') {
            setPhase(updated.status === 'drawn' ? 'drawn' : 'drawing');
          }
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
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <div className="text-center space-y-3">
          <p className="text-2xl font-bold text-zinc-400">Nenhum sorteio agendado</p>
          <p className="text-zinc-600 text-sm">Aguarde o administrador abrir a sala.</p>
        </div>
      </div>
    );
  }

  if (phase === 'countdown' && session) {
    return (
      <CountdownPhase
        raffle={raffle}
        drawAt={session.draw_at}
        onCountdownEnd={triggerDraw}
      />
    );
  }

  if (phase === 'drawing' && session) {
    return (
      <RoulettePhase
        totalNumbers={raffle.total_numbers}
        winnerNumber={session.winner_ticket_number ?? 1}
        isResultReady={session.status === 'drawn' && session.winner_ticket_number !== null}
        onAnimationEnd={() => setPhase('drawn')}
      />
    );
  }

  if (phase === 'drawn' && session?.winner_ticket_number !== null) {
    return (
      <ProofPhase
        raffle={raffle}
        session={session!}
      />
    );
  }

  // drawn mas winner_ticket_number ainda nulo (edge case de falha parcial)
  if (phase === 'drawn') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <div className="text-center space-y-3">
          <p className="text-2xl font-bold text-zinc-400">Aguardando resultado...</p>
          <p className="text-zinc-600 text-sm">Resultado será atualizado em breve.</p>
        </div>
      </div>
    );
  }

  // Estado 'drawing' enquanto aguarda o resultado chegar via Realtime
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
      <div className="text-center space-y-4 animate-pulse">
        <div className="text-6xl font-black text-yellow-400">⚡</div>
        <p className="text-xl font-bold">Sorteando...</p>
      </div>
    </div>
  );
}
