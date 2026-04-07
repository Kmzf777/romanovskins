# Live Draw Room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **FRONTEND REQUIREMENT (OBRIGATÓRIO):** Qualquer task que toque UI/componentes DEVE invocar a skill `frontend-design:frontend-design` ANTES de escrever qualquer código de UI.

**Goal:** Criar uma sala pública de sorteio ao vivo em `/sorteio/[raffleId]` onde participantes assistem a uma contagem regressiva, animação de roleta e comprovante verificável — disparado automaticamente por qualquer viewer quando o countdown zera.

**Architecture:** Admin abre uma sessão de sorteio (`draw_sessions` table no Supabase), gerando uma URL compartilhável. Todos os viewers subscrevem ao Supabase Realtime na draw_session. Qualquer viewer detecta countdown = 0 e chama uma API route idempotente que atomicamente executa o sorteio, atualiza o status e transmite o resultado via Realtime para todos os conectados.

**Tech Stack:** Next.js 16 App Router, Supabase Realtime, Supabase PostgreSQL, TypeScript, Tailwind CSS, `tw-animate-css`, lucide-react

---

## File Map

**Novos arquivos:**
- `supabase/migrations/20260407000000_draw_sessions.sql` — Cria tabela draw_sessions + habilita Realtime
- `src/lib/draw-config.ts` — Config global: countdown padrão em minutos
- `src/app/api/sorteio/[raffleId]/draw/route.ts` — API route idempotente para executar o sorteio
- `src/app/sorteio/[raffleId]/page.tsx` — Server component: carrega estado inicial
- `src/app/sorteio/[raffleId]/DrawRoom.tsx` — Client component: Realtime + máquina de estados das fases
- `src/app/sorteio/[raffleId]/CountdownPhase.tsx` — Fase 1: countdown + explicação da Loteria Federal
- `src/app/sorteio/[raffleId]/RoulettePhase.tsx` — Fase 2: animação de roleta girando
- `src/app/sorteio/[raffleId]/ProofPhase.tsx` — Fase 3: resultado + comprovante verificável

**Arquivos modificados:**
- `src/server/raffle-actions.ts` — Adiciona `openDrawSessionAction`
- `src/components/admin/AdminDrawModal.tsx` — Substitui fluxo de sorteio por "Abrir Sala"

---

## Task 1: DB Migration — Tabela draw_sessions

**Files:**
- Create: `supabase/migrations/20260407000000_draw_sessions.sql`

- [ ] **Step 1: Criar migration**

Criar o arquivo com o conteúdo abaixo:

```sql
-- Tabela para sessões de sorteio ao vivo
CREATE TABLE IF NOT EXISTS draw_sessions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id            uuid NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  draw_at              timestamptz NOT NULL,
  countdown_minutes    integer NOT NULL DEFAULT 5,
  status               text NOT NULL DEFAULT 'waiting'
                         CHECK (status IN ('waiting', 'drawing', 'drawn')),
  winner_ticket_number integer,
  winner_name          text,
  concurso             integer,
  primeiro_premio      text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Apenas uma sessão ativa por rifa
CREATE UNIQUE INDEX IF NOT EXISTS draw_sessions_raffle_active
  ON draw_sessions (raffle_id)
  WHERE status IN ('waiting', 'drawing');

-- RLS: leitura pública, escrita apenas via service_role
ALTER TABLE draw_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read draw_sessions"
  ON draw_sessions FOR SELECT
  USING (true);

-- Habilitar Realtime nesta tabela
ALTER PUBLICATION supabase_realtime ADD TABLE draw_sessions;
```

- [ ] **Step 2: Aplicar no Supabase**

Acesse o Supabase Dashboard → SQL Editor e execute o conteúdo do arquivo acima. Confirme que a tabela `draw_sessions` aparece em Table Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260407000000_draw_sessions.sql
git commit -m "feat: add draw_sessions table with realtime and RLS"
```

---

## Task 2: Draw Config

**Files:**
- Create: `src/lib/draw-config.ts`

- [ ] **Step 1: Criar arquivo de config**

```typescript
// Duração padrão da contagem regressiva em minutos.
// Pode ser sobrescrito por NEXT_PUBLIC_DRAW_COUNTDOWN_MINUTES no .env
export const DRAW_COUNTDOWN_MINUTES =
  Number(process.env.NEXT_PUBLIC_DRAW_COUNTDOWN_MINUTES ?? '5');
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/draw-config.ts
git commit -m "feat: add draw config with configurable countdown"
```

---

## Task 3: Server Action — openDrawSessionAction

**Files:**
- Modify: `src/server/raffle-actions.ts`

- [ ] **Step 1: Adicionar o import de DRAW_COUNTDOWN_MINUTES no topo do arquivo**

Após os imports existentes, adicionar:

```typescript
import { DRAW_COUNTDOWN_MINUTES } from '@/lib/draw-config';
```

- [ ] **Step 2: Adicionar a função openDrawSessionAction no final do arquivo**

```typescript
export async function openDrawSessionAction(
  raffleId: string,
  countdownMinutes?: number
): Promise<{ success: boolean; drawUrl?: string; error?: string }> {
  const cookieStore = await cookies();
  const adminSession = cookieStore.get('admin_session')?.value;
  if (!adminSession) return { success: false, error: 'Não autorizado.' };

  const supabase = createAdminClient();

  // Verificar que a rifa existe e está fechada
  const { data: raffle } = await supabase
    .from('raffles')
    .select('id, status')
    .eq('id', raffleId)
    .single();

  if (!raffle) return { success: false, error: 'Rifa não encontrada.' };
  if (raffle.status !== 'closed')
    return { success: false, error: 'A rifa precisa estar fechada para abrir a sala.' };

  // Verificar se já existe sessão ativa para esta rifa
  const { data: existing } = await supabase
    .from('draw_sessions')
    .select('id')
    .eq('raffle_id', raffleId)
    .in('status', ['waiting', 'drawing'])
    .maybeSingle();

  if (existing) {
    const drawUrl = `/sorteio/${raffleId}`;
    return { success: true, drawUrl };
  }

  const minutes = countdownMinutes ?? DRAW_COUNTDOWN_MINUTES;
  const drawAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();

  const { error } = await supabase.from('draw_sessions').insert({
    raffle_id: raffleId,
    draw_at: drawAt,
    countdown_minutes: minutes,
    status: 'waiting',
  });

  if (error) {
    console.error('Error creating draw session:', error);
    return { success: false, error: 'Erro ao criar sessão de sorteio.' };
  }

  return { success: true, drawUrl: `/sorteio/${raffleId}` };
}
```

- [ ] **Step 3: Verificar manualmente**

Abra o painel admin, feche uma rifa de teste, clique "Abrir Sala" (ainda não implementado — apenas confirme que o action compila sem erros rodando `npm run build`).

```bash
npm run build
```

Esperado: build sem erros de TypeScript.

- [ ] **Step 4: Commit**

```bash
git add src/server/raffle-actions.ts src/lib/draw-config.ts
git commit -m "feat: add openDrawSessionAction for live draw room"
```

---

## Task 4: API Route — Sorteio Idempotente

**Files:**
- Create: `src/app/api/sorteio/[raffleId]/draw/route.ts`

Esta rota é chamada por qualquer viewer quando o countdown zera. É idempotente: só um request ganha a corrida atômica, os demais retornam 200 silenciosamente.

- [ ] **Step 1: Criar a pasta e o arquivo**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getLatestLotoFederal, calcularNumeroVencedor } from '@/lib/loterias';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ raffleId: string }> }
) {
  const { raffleId } = await params;
  const supabase = createAdminClient();

  // 1. Buscar draw_session waiting com draw_at <= now()
  const { data: session } = await supabase
    .from('draw_sessions')
    .select('*')
    .eq('raffle_id', raffleId)
    .eq('status', 'waiting')
    .lte('draw_at', new Date().toISOString())
    .maybeSingle();

  if (!session) {
    // Sessão não existe, já foi processada, ou ainda não é hora — ignorar
    return NextResponse.json({ ok: true, skipped: true });
  }

  // 2. Atualizar atomicamente para 'drawing' (apenas 1 request vence)
  const { data: claimed, error: claimError } = await supabase
    .from('draw_sessions')
    .update({ status: 'drawing' })
    .eq('id', session.id)
    .eq('status', 'waiting') // condição atômica: só atualiza se ainda 'waiting'
    .select()
    .maybeSingle();

  if (claimError || !claimed) {
    // Outro request já ganhou a corrida
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    // 3. Buscar raffle
    const { data: raffle } = await supabase
      .from('raffles')
      .select('*')
      .eq('id', raffleId)
      .single();

    if (!raffle || raffle.status !== 'closed') {
      throw new Error('Rifa não encontrada ou não está fechada.');
    }

    // 4. Buscar tickets vendidos
    const { data: soldTickets } = await supabase
      .from('tickets')
      .select('ticket_number, user_id')
      .eq('raffle_id', raffleId)
      .eq('status', 'sold');

    if (!soldTickets || soldTickets.length === 0) {
      throw new Error('Nenhuma cota vendida.');
    }

    // 5. Buscar resultado da Loteria Federal
    const lotoResult = await getLatestLotoFederal();
    let winnerTicketNumber = calcularNumeroVencedor(
      lotoResult.primeiroPremio,
      raffle.total_numbers
    );

    // 6. Encontrar dono do ticket (com fallback para ticket mais próximo)
    let winnerTicket = soldTickets.find(t => t.ticket_number === winnerTicketNumber);
    if (!winnerTicket) {
      winnerTicket = soldTickets.reduce((closest, t) => {
        const diffT = Math.abs(t.ticket_number - winnerTicketNumber);
        const diffC = Math.abs(closest.ticket_number - winnerTicketNumber);
        return diffT < diffC ? t : closest;
      });
      winnerTicketNumber = winnerTicket.ticket_number;
    }

    // 7. Buscar nome do ganhador
    const { data: winnerUser } = await supabase
      .from('users')
      .select('name')
      .eq('id', winnerTicket.user_id)
      .single();

    const winnerName = winnerUser?.name ?? 'Desconhecido';

    // 8. Atualizar raffle como 'drawn'
    await supabase
      .from('raffles')
      .update({
        status: 'drawn',
        drawn_at: new Date().toISOString(),
        winner_ticket_number: winnerTicketNumber,
        winner_user_id: winnerTicket.user_id,
      })
      .eq('id', raffleId);

    // 9. Atualizar draw_session como 'drawn' com resultado (dispara Realtime para todos)
    await supabase
      .from('draw_sessions')
      .update({
        status: 'drawn',
        winner_ticket_number: winnerTicketNumber,
        winner_name: winnerName,
        concurso: lotoResult.concurso,
        primeiro_premio: lotoResult.primeiroPremio,
      })
      .eq('id', session.id);

    return NextResponse.json({ ok: true, winnerTicketNumber });
  } catch (err) {
    console.error('Draw error:', err);
    // Reverter status para 'waiting' em caso de erro para permitir retry
    await supabase
      .from('draw_sessions')
      .update({ status: 'waiting' })
      .eq('id', session.id);

    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/sorteio/
git commit -m "feat: add idempotent draw API route with atomic race protection"
```

---

## Task 5: Atualizar AdminDrawModal — "Abrir Sala"

> **OBRIGATÓRIO:** Invocar a skill `frontend-design:frontend-design` antes de escrever qualquer código de UI nesta task.

**Files:**
- Modify: `src/components/admin/AdminDrawModal.tsx`

O modal atual executa o sorteio diretamente. Substituir por um fluxo de "Abrir Sala": o admin define o countdown (com valor padrão de `DRAW_COUNTDOWN_MINUTES`) e recebe o link para compartilhar no WhatsApp.

- [ ] **Step 1: Invocar frontend-design skill** (obrigatório antes de codar)

- [ ] **Step 2: Substituir o conteúdo de AdminDrawModal.tsx**

```typescript
'use client';

import { useState, useTransition } from 'react';
import { openDrawSessionAction } from '@/server/raffle-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Radio, Loader2, X, Copy, ExternalLink } from 'lucide-react';
import { DRAW_COUNTDOWN_MINUTES } from '@/lib/draw-config';

export function AdminDrawModal({
  raffleId,
  raffleTitle,
}: {
  raffleId: string;
  raffleTitle: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [countdown, setCountdown] = useState(String(DRAW_COUNTDOWN_MINUTES));
  const [drawUrl, setDrawUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleOpen = () => {
    startTransition(async () => {
      const minutes = Math.max(1, parseInt(countdown) || DRAW_COUNTDOWN_MINUTES);
      const res = await openDrawSessionAction(raffleId, minutes);
      if (res.success && res.drawUrl) {
        setDrawUrl(res.drawUrl);
      } else {
        toast.error(res.error || 'Erro ao abrir sala.');
      }
    });
  };

  const fullUrl =
    typeof window !== 'undefined' && drawUrl
      ? `${window.location.origin}${drawUrl}`
      : drawUrl ?? '';

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl);
    toast.success('Link copiado!');
  };

  const handleClose = () => {
    setIsOpen(false);
    setDrawUrl(null);
    setCountdown(String(DRAW_COUNTDOWN_MINUTES));
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-xs h-7 px-3 rounded border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 transition-colors flex items-center gap-1"
      >
        <Radio className="w-3 h-3" />
        Abrir Sala
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-red-400 animate-pulse" />
                Sala de Sorteio ao Vivo
              </h2>
              <button onClick={handleClose} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!drawUrl ? (
              <>
                <p className="text-sm text-zinc-400 mb-4">
                  Rifa: <span className="text-white font-medium">{raffleTitle}</span>
                </p>

                <div className="bg-zinc-800/50 rounded-lg p-4 mb-4 text-sm text-zinc-300">
                  Uma sala pública será criada com uma contagem regressiva. Compartilhe o
                  link no grupo do WhatsApp para que os participantes assistam ao sorteio
                  ao vivo. O sorteio acontece automaticamente ao zerar.
                </div>

                <div className="mb-4">
                  <label className="text-xs text-zinc-400 mb-1 block uppercase tracking-wider">
                    Duração da contagem (minutos)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={countdown}
                    onChange={e => setCountdown(e.target.value)}
                    className="font-mono w-28"
                  />
                </div>

                <Button
                  onClick={handleOpen}
                  disabled={isPending}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-bold"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando sala...
                    </>
                  ) : (
                    <>
                      <Radio className="w-4 h-4 mr-2" /> Abrir Sala ao Vivo
                    </>
                  )}
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                  <p className="text-green-400 font-semibold text-sm mb-1">
                    ✓ Sala criada! Compartilhe o link:
                  </p>
                  <p className="text-xs text-zinc-400 mt-2 break-all font-mono">{fullUrl}</p>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleCopy} variant="outline" className="flex-1">
                    <Copy className="w-4 h-4 mr-2" /> Copiar Link
                  </Button>
                  <Button
                    onClick={() => window.open(fullUrl, '_blank')}
                    variant="outline"
                    className="flex-1"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" /> Abrir Sala
                  </Button>
                </div>

                <p className="text-xs text-zinc-500 text-center">
                  Você pode fechar esta janela. O sorteio acontecerá automaticamente.
                </p>

                <Button onClick={handleClose} variant="ghost" className="w-full">
                  Fechar
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Verificar build**

```bash
npm run build
```

Esperado: sem erros. O botão "Abrir Sala" deve aparecer na lista admin para rifas com status `closed`.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/AdminDrawModal.tsx
git commit -m "feat: replace draw modal with live room flow (Abrir Sala)"
```

---

## Task 6: Página do Sorteio — Server Component

**Files:**
- Create: `src/app/sorteio/[raffleId]/page.tsx`

Server component que carrega o estado inicial (raffle + draw_session) e passa para o DrawRoom client component.

- [ ] **Step 1: Criar o arquivo**

```typescript
import { createClient } from '@/lib/supabase/server';
import { DrawRoom } from './DrawRoom';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

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

export default async function SorteioPage({
  params,
}: {
  params: Promise<{ raffleId: string }>;
}) {
  const { raffleId } = await params;
  const supabase = await createClient();

  const [{ data: raffle }, { data: session }] = await Promise.all([
    supabase
      .from('raffles')
      .select('id, title, image_url, total_numbers, status')
      .eq('id', raffleId)
      .single(),
    supabase
      .from('draw_sessions')
      .select('*')
      .eq('raffle_id', raffleId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!raffle) notFound();

  return (
    <DrawRoom
      raffle={raffle as Raffle}
      initialSession={session as DrawSession | null}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/sorteio/
git commit -m "feat: add sorteio server page with initial state loading"
```

---

## Task 7: DrawRoom — Client Component com Realtime

> **OBRIGATÓRIO:** Invocar a skill `frontend-design:frontend-design` antes de escrever qualquer código de UI nesta task.

**Files:**
- Create: `src/app/sorteio/[raffleId]/DrawRoom.tsx`

Gerencia a subscription Realtime, a máquina de estados das fases, e o dispatch automático do sorteio.

- [ ] **Step 1: Invocar frontend-design skill** (obrigatório antes de codar)

- [ ] **Step 2: Criar DrawRoom.tsx**

```typescript
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
```

- [ ] **Step 3: Verificar build**

```bash
npm run build
```

Esperado: sem erros de TypeScript.

- [ ] **Step 4: Commit**

```bash
git add src/app/sorteio/[raffleId]/DrawRoom.tsx
git commit -m "feat: add DrawRoom client component with Realtime subscription"
```

---

## Task 8: CountdownPhase — Fase 1

> **OBRIGATÓRIO:** Invocar a skill `frontend-design:frontend-design` antes de escrever qualquer código de UI nesta task.

**Files:**
- Create: `src/app/sorteio/[raffleId]/CountdownPhase.tsx`

Exibe contagem regressiva grande, imagem/nome da rifa, número de viewers online, e explicação do método da Loteria Federal.

- [ ] **Step 1: Invocar frontend-design skill** (obrigatório antes de codar)

- [ ] **Step 2: Criar CountdownPhase.tsx**

```typescript
'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChevronDown, ChevronUp, Shield, ExternalLink } from 'lucide-react';
import Image from 'next/image';

interface CountdownPhaseProps {
  raffle: { id: string; title: string; image_url: string; total_numbers: number };
  drawAt: string;
  onCountdownEnd: () => void;
}

function formatTime(ms: number) {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function CountdownPhase({ raffle, drawAt, onCountdownEnd }: CountdownPhaseProps) {
  const [timeLeft, setTimeLeft] = useState(() =>
    Math.max(0, new Date(drawAt).getTime() - Date.now())
  );
  const [viewers, setViewers] = useState(1);
  const [faqOpen, setFaqOpen] = useState(false);
  const endCalled = useRef(false);

  // Countdown tick
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, new Date(drawAt).getTime() - Date.now());
      setTimeLeft(remaining);
      if (remaining === 0 && !endCalled.current) {
        endCalled.current = true;
        clearInterval(interval);
        onCountdownEnd();
      }
    }, 500);
    return () => clearInterval(interval);
  }, [drawAt, onCountdownEnd]);

  // Viewers online via Presence (Supabase Realtime)
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`presence:${raffle.id}`, {
      config: { presence: { key: crypto.randomUUID() } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        setViewers(Object.keys(channel.presenceState()).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [raffle.id]);

  const isUrgent = timeLeft < 60_000; // último minuto

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs text-red-400 font-semibold uppercase tracking-wider">
            Ao Vivo
          </span>
        </div>
        <span className="text-xs text-zinc-500">{viewers} assistindo</span>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 gap-8">
        {/* Raffle info */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative w-32 h-32 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            <Image
              src={raffle.image_url}
              alt={raffle.title}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
          <h1 className="text-2xl font-bold text-white max-w-sm">{raffle.title}</h1>
          <p className="text-zinc-500 text-sm">{raffle.total_numbers} cotas</p>
        </div>

        {/* Countdown */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs uppercase tracking-widest text-zinc-500">
            Sorteio em
          </p>
          <div
            className={`text-8xl md:text-9xl font-black font-mono tabular-nums transition-colors duration-500 ${
              isUrgent ? 'text-red-400' : 'text-white'
            }`}
          >
            {formatTime(timeLeft)}
          </div>
          <p className="text-zinc-600 text-xs">
            {new Date(drawAt).toLocaleString('pt-BR')}
          </p>
        </div>
      </main>

      {/* FAQ — Como funciona */}
      <div className="border-t border-white/5">
        <button
          onClick={() => setFaqOpen(v => !v)}
          className="w-full flex items-center justify-between px-6 py-4 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-yellow-500" />
            Como funciona o sorteio? (Loteria Federal)
          </span>
          {faqOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {faqOpen && (
          <div className="px-6 pb-6 space-y-4 text-sm text-zinc-400">
            <div className="bg-zinc-900 rounded-xl p-4 space-y-3 border border-white/5">
              <p className="text-white font-semibold">Transparência 100% verificável</p>
              <p>
                O número vencedor é determinado pelo resultado oficial da{' '}
                <strong className="text-yellow-400">Loteria Federal da Caixa</strong> —
                ninguém controla o resultado.
              </p>

              <div className="bg-zinc-800 rounded-lg p-3 space-y-2">
                <p className="text-zinc-300 font-medium text-xs uppercase tracking-wider">
                  Fórmula
                </p>
                <div className="font-mono text-sm space-y-1">
                  <p className="text-zinc-300">1. Pegamos os <span className="text-yellow-400">2 últimos dígitos</span> do 1º Prêmio</p>
                  <p className="text-zinc-300">2. Calculamos: <span className="text-yellow-400">(últimos2 % total_cotas) + 1</span></p>
                </div>
                <div className="border-t border-white/5 pt-2 text-zinc-500 text-xs">
                  Exemplo: 1º Prêmio <span className="text-white">097680</span> → últimos2 = <span className="text-white">80</span>
                  {' '}→ (80 % {raffle.total_numbers}) + 1 = <span className="text-yellow-400 font-bold">{(80 % raffle.total_numbers) + 1}</span>
                </div>
              </div>

              <a
                href="https://loterias.caixa.gov.br/Paginas/Federal.aspx"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-yellow-500 hover:text-yellow-400 text-xs"
              >
                <ExternalLink className="w-3 h-3" />
                Verificar resultados no site da Caixa
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar build**

```bash
npm run build
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/app/sorteio/[raffleId]/CountdownPhase.tsx
git commit -m "feat: add CountdownPhase with live viewers and Loteria Federal FAQ"
```

---

## Task 9: RoulettePhase — Fase 2 (Animação)

> **OBRIGATÓRIO:** Invocar a skill `frontend-design:frontend-design` antes de escrever qualquer código de UI nesta task.

**Files:**
- Create: `src/app/sorteio/[raffleId]/RoulettePhase.tsx`

Animação de slot machine: números ciclam rapidamente, desaceleram e travam no vencedor.

- [ ] **Step 1: Invocar frontend-design skill** (obrigatório antes de codar)

- [ ] **Step 2: Criar RoulettePhase.tsx**

```typescript
'use client';

import { useEffect, useState, useRef } from 'react';
import { Trophy } from 'lucide-react';

interface RoulettePhaseProps {
  totalNumbers: number;
  winnerNumber: number;
  isResultReady: boolean;  // true quando Realtime confirmou resultado
  onAnimationEnd: () => void;
}

export function RoulettePhase({
  totalNumbers,
  winnerNumber,
  isResultReady,
  onAnimationEnd,
}: RoulettePhaseProps) {
  const [displayNumber, setDisplayNumber] = useState<number | null>(null);
  const [stopped, setStopped] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    // Só inicia a animação quando o resultado estiver disponível
    if (!isResultReady || startedRef.current) return;
    startedRef.current = true;

    const TOTAL_DURATION = 5000; // 5 segundos
    let elapsed = 0;

    const spin = () => {
      if (elapsed >= TOTAL_DURATION) {
        setDisplayNumber(winnerNumber);
        setStopped(true);
        timeoutRef.current = setTimeout(onAnimationEnd, 2500);
        return;
      }

      const progress = elapsed / TOTAL_DURATION;
      // Desaceleração exponencial: rápido no início, lento no fim
      const intervalMs = 60 + Math.pow(progress, 2) * 940;

      setDisplayNumber(Math.floor(Math.random() * totalNumbers) + 1);
      elapsed += intervalMs;
      timeoutRef.current = setTimeout(spin, intervalMs);
    };

    timeoutRef.current = setTimeout(spin, 60);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isResultReady, winnerNumber, totalNumbers, onAnimationEnd]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center gap-8">
      {/* Header ao vivo */}
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        <span className="text-xs text-red-400 font-semibold uppercase tracking-wider">
          Sorteando ao Vivo
        </span>
      </div>

      {/* Display do número */}
      <div
        className={`relative flex items-center justify-center w-64 h-64 rounded-3xl border-4 transition-all duration-700 ${
          stopped
            ? 'border-yellow-400 bg-yellow-500/10 shadow-[0_0_60px_rgba(234,179,8,0.4)]'
            : 'border-white/10 bg-white/5'
        }`}
      >
        {stopped && (
          <Trophy className="absolute top-4 right-4 w-8 h-8 text-yellow-400" />
        )}
        <span
          className={`font-black font-mono tabular-nums transition-all duration-500 ${
            stopped
              ? 'text-8xl text-yellow-400 scale-110'
              : 'text-7xl text-white'
          }`}
        >
          {displayNumber !== null
            ? String(displayNumber).padStart(String(totalNumbers).length, '0')
            : '···'}
        </span>
      </div>

      {/* Status */}
      <div className="text-center">
        {!isResultReady && (
          <p className="text-zinc-500 text-sm animate-pulse">
            Buscando resultado da Loteria Federal...
          </p>
        )}
        {isResultReady && !stopped && (
          <p className="text-zinc-400 text-sm">Revelando o número sorteado...</p>
        )}
        {stopped && (
          <div className="space-y-1">
            <p className="text-yellow-400 text-2xl font-bold">🏆 Número Sorteado!</p>
            <p className="text-zinc-500 text-xs">Aguarde o comprovante...</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar build**

```bash
npm run build
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/app/sorteio/[raffleId]/RoulettePhase.tsx
git commit -m "feat: add RoulettePhase with slot machine deceleration animation"
```

---

## Task 10: ProofPhase — Fase 3 (Comprovante)

> **OBRIGATÓRIO:** Invocar a skill `frontend-design:frontend-design` antes de escrever qualquer código de UI nesta task.

**Files:**
- Create: `src/app/sorteio/[raffleId]/ProofPhase.tsx`

Exibe o resultado final: número vencedor em destaque, nome mascarado, bloco de verificação com dados da Loteria Federal e link para a Caixa.

- [ ] **Step 1: Invocar frontend-design skill** (obrigatório antes de codar)

- [ ] **Step 2: Criar ProofPhase.tsx**

```typescript
'use client';

import { ExternalLink, Copy, Share2, Trophy, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

interface DrawSession {
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
}

interface ProofPhaseProps {
  raffle: Raffle;
  session: DrawSession;
}

function maskName(name: string): string {
  const parts = name.trim().split(' ');
  return parts
    .map((part) => {
      if (part.length <= 2) return part;
      return part[0] + '*'.repeat(part.length - 2) + part[part.length - 1];
    })
    .join(' ');
}

export function ProofPhase({ raffle, session }: ProofPhaseProps) {
  const {
    winner_ticket_number,
    winner_name,
    concurso,
    primeiro_premio,
  } = session;

  const maskedName = winner_name ? maskName(winner_name) : 'Desconhecido';

  const lastTwo = primeiro_premio
    ? parseInt(primeiro_premio.replace(/\D/g, '').slice(-2), 10)
    : null;

  const calculatedWinner =
    lastTwo !== null ? (lastTwo % raffle.total_numbers) + 1 : winner_ticket_number;

  const isFallback =
    calculatedWinner !== winner_ticket_number;

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleShare = async () => {
    const text = `🏆 Sorteio realizado! Número vencedor: #${winner_ticket_number} — Rifa: ${raffle.title}\n\nVerifique: ${shareUrl}`;
    if (navigator.share) {
      await navigator.share({ title: 'Resultado do Sorteio', text, url: shareUrl });
    } else {
      navigator.clipboard.writeText(text);
      toast.success('Resultado copiado!');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 gap-8">

        {/* Trofeu + título */}
        <div className="flex flex-col items-center gap-3 text-center">
          <Trophy className="w-12 h-12 text-yellow-400" />
          <h1 className="text-3xl font-black">Sorteio Encerrado!</h1>
          <p className="text-zinc-500 text-sm">{raffle.title}</p>
        </div>

        {/* Número vencedor */}
        <div className="relative flex flex-col items-center gap-3 bg-gradient-to-b from-yellow-500/20 to-yellow-500/5 border border-yellow-500/30 rounded-3xl p-10 w-full max-w-xs shadow-[0_0_80px_rgba(234,179,8,0.2)]">
          <p className="text-xs text-zinc-400 uppercase tracking-widest">Número Vencedor</p>
          <span className="text-8xl font-black font-mono text-yellow-400">
            #{winner_ticket_number}
          </span>
          <p className="text-zinc-300 font-semibold">{maskedName}</p>
        </div>

        {/* Comprovante */}
        <div className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/3">
            <ShieldCheck className="w-4 h-4 text-green-400" />
            <span className="text-sm font-semibold text-white">Comprovante de Transparência</span>
          </div>

          <div className="p-4 space-y-3 text-sm">
            {concurso && concurso > 0 && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Concurso Federal</span>
                <span className="text-white font-mono">#{concurso}</span>
              </div>
            )}

            {primeiro_premio && (
              <div className="flex justify-between">
                <span className="text-zinc-500">1º Prêmio</span>
                <span className="text-white font-mono">{primeiro_premio}</span>
              </div>
            )}

            {lastTwo !== null && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Últimos 2 dígitos</span>
                <span className="text-yellow-400 font-mono font-bold">{String(lastTwo).padStart(2, '0')}</span>
              </div>
            )}

            <div className="border-t border-white/5 pt-3">
              <p className="text-zinc-500 text-xs mb-1">Fórmula aplicada</p>
              <code className="text-xs bg-zinc-800 rounded px-2 py-1 block text-zinc-300">
                ({lastTwo} % {raffle.total_numbers}) + 1 ={' '}
                <span className="text-yellow-400 font-bold">{calculatedWinner}</span>
                {isFallback && (
                  <span className="text-zinc-500 ml-1">
                    → fallback #{winner_ticket_number}*
                  </span>
                )}
              </code>
              {isFallback && (
                <p className="text-xs text-zinc-600 mt-1">
                  * Número calculado não foi vendido — usado o ticket vendido mais próximo.
                </p>
              )}
            </div>

            <a
              href="https://loterias.caixa.gov.br/Paginas/Federal.aspx"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-yellow-500 hover:text-yellow-400 text-xs pt-1"
            >
              <ExternalLink className="w-3 h-3" />
              Verificar resultado oficial no site da Caixa
            </a>
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-3 w-full max-w-sm">
          <button
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl transition-colors"
          >
            <Share2 className="w-4 h-4" />
            Compartilhar
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(shareUrl);
              toast.success('Link copiado!');
            }}
            className="flex items-center justify-center gap-2 border border-white/10 hover:bg-white/5 text-zinc-300 px-4 rounded-xl transition-colors"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>

        {/* Imagem da rifa */}
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-white/10">
            <Image src={raffle.image_url} alt={raffle.title} fill className="object-cover" unoptimized />
          </div>
          <span>{raffle.title}</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar build final completo**

```bash
npm run build
```

Esperado: build limpo, sem erros de TypeScript.

- [ ] **Step 4: Commit final**

```bash
git add src/app/sorteio/[raffleId]/ProofPhase.tsx
git commit -m "feat: add ProofPhase with winner reveal and Loteria Federal proof block"
```

---

## Checklist Final — Teste Manual

Após todas as tasks, verificar o fluxo completo:

- [ ] No admin, fechar uma rifa → botão "Abrir Sala" aparece
- [ ] Clicar "Abrir Sala" → modal exibe campo de minutos + botão
- [ ] Confirmar → URL `/sorteio/[raffleId]` é exibida e copiável
- [ ] Acessar a URL → CountdownPhase exibe contagem regressiva
- [ ] Acordeão "Como funciona" abre e exibe a fórmula corretamente
- [ ] Viewer count exibe corretamente (abrir em 2 abas)
- [ ] Ao zerar → RoulettePhase inicia automaticamente
- [ ] Números giram e desaceleram → travam no vencedor
- [ ] ProofPhase exibe: número vencedor, nome mascarado, comprovante com concurso/1º prêmio/fórmula
- [ ] Link da Caixa abre corretamente
- [ ] Botão compartilhar funciona
- [ ] Viewer que entra depois do sorteio → vê direto a ProofPhase
