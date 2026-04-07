# Future Concurso Commitment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **MANDATORY:** Any task that modifies frontend files MUST invoke `frontend-design:frontend-design` skill before writing any code.

**Goal:** When admin opens draw room, lock onto the *next* Loteria Federal concurso (N+1) so users cannot pre-calculate the winning ticket from a result already published.

**Architecture:** `openDrawSessionAction` calls `getNextLotoFederalInfo()` to resolve `nextConcurso` (current+1) and `drawAt` (next Wed/Sat at 20h BRT), stores both in `draw_sessions.target_concurso`. The draw API fetches that specific concurso by number; if not yet published it returns `CONCURSO_NOT_AVAILABLE` and reverts to `waiting`, letting the client poll every 60 seconds automatically.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (PostgreSQL + Realtime), Loteria Federal public APIs (guidi.dev.br + Caixa servicebus2)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260407000001_draw_sessions_target_concurso.sql` | Create | Add `target_concurso` column |
| `src/lib/loterias.ts` | Modify | Add `getNextLotoFederalInfo()` and `getLotoFederalByConcurso(n)` |
| `src/server/raffle-actions.ts` | Modify | `openDrawSessionAction` uses future concurso, remove countdown param |
| `src/app/api/sorteio/[raffleId]/draw/route.ts` | Modify | Use `getLotoFederalByConcurso(target_concurso)`, return `CONCURSO_NOT_AVAILABLE` |
| `src/app/sorteio/[raffleId]/DrawRoom.tsx` | Modify | Pass `targetConcurso` prop to CountdownPhase |
| `src/components/admin/AdminDrawModal.tsx` | Modify (FRONTEND) | Remove countdown input, show next concurso info |
| `src/app/sorteio/[raffleId]/CountdownPhase.tsx` | Modify (FRONTEND) | Show concurso badge, add `polling` spinState with 60s auto-retry |
| `src/lib/draw-config.ts` | Delete | No longer needed (countdown replaced by real schedule) |

---

## Task 1: DB Migration — add `target_concurso` column

**Files:**
- Create: `supabase/migrations/20260407000001_draw_sessions_target_concurso.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Add target_concurso to draw_sessions
-- This stores the specific Loteria Federal concurso number that will determine the winner.
-- Locking to a future concurso prevents users from pre-calculating results.
ALTER TABLE draw_sessions
  ADD COLUMN IF NOT EXISTS target_concurso integer;

COMMENT ON COLUMN draw_sessions.target_concurso IS
  'The specific Loteria Federal concurso number to use for this draw. Set to current+1 when session is created.';
```

- [ ] **Step 2: Apply manually in Supabase Dashboard**

Open Supabase Dashboard → SQL Editor → run the migration above.
Verify with: `SELECT column_name FROM information_schema.columns WHERE table_name = 'draw_sessions';`
Expected: `target_concurso` appears in the list.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260407000001_draw_sessions_target_concurso.sql
git commit -m "feat: add target_concurso column to draw_sessions"
```

---

## Task 2: loterias.ts — future concurso helpers

**Files:**
- Modify: `src/lib/loterias.ts`

- [ ] **Step 1: Add `getNextLotoFederalDrawDate()` (internal helper)**

Add this function at the top of the file, before the exports:

```typescript
/**
 * Calculates the UTC datetime of the next Loteria Federal draw.
 * Draws happen every Wednesday (3) and Saturday (6) at 20:00 BRT (UTC-3).
 */
function getNextLotoFederalDrawDate(): Date {
  const now = new Date();
  // Shift to BRT (UTC-3) for day-of-week and hour comparison
  const nowBRT = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const dayBRT = nowBRT.getUTCDay(); // 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
  const hourBRT = nowBRT.getUTCHours();

  const DRAW_DAYS = [3, 6]; // Wed, Sat
  let minDays = 7;

  for (const d of DRAW_DAYS) {
    let diff = (d - dayBRT + 7) % 7;
    // If today is a draw day but 20:00 BRT already passed, push to next week
    if (diff === 0 && hourBRT >= 20) diff = 7;
    if (diff < minDays) minDays = diff;
  }

  // Build draw time in BRT: target day at 20:00:00
  const drawBRT = new Date(nowBRT);
  drawBRT.setUTCDate(nowBRT.getUTCDate() + minDays);
  drawBRT.setUTCHours(20, 0, 0, 0);

  // Convert BRT back to UTC (+3h)
  return new Date(drawBRT.getTime() + 3 * 60 * 60 * 1000);
}
```

- [ ] **Step 2: Add `getNextLotoFederalInfo()`**

Add after `getLatestLotoFederal`:

```typescript
/**
 * Returns the next concurso number (current + 1) and the datetime of its draw.
 * Used when opening a draw room to commit to a future result.
 */
export async function getNextLotoFederalInfo(): Promise<{
  currentConcurso: number;
  nextConcurso: number;
  drawAt: Date;
}> {
  const latest = await getLatestLotoFederal();
  return {
    currentConcurso: latest.concurso,
    nextConcurso: latest.concurso + 1,
    drawAt: getNextLotoFederalDrawDate(),
  };
}
```

- [ ] **Step 3: Add `getLotoFederalByConcurso(concurso)`**

Add after `getNextLotoFederalInfo`:

```typescript
/**
 * Fetches a specific Loteria Federal concurso by number.
 * Throws 'CONCURSO_NOT_AVAILABLE' if the result hasn't been published yet.
 */
export async function getLotoFederalByConcurso(concurso: number): Promise<LotoFederalResult> {
  // Attempt 1: guidi community API
  try {
    const res = await fetch(`https://api.guidi.dev.br/loteria/federal/${concurso}`, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      const primeiroPremio =
        data.premios?.[0]?.numero ??
        data.listaDezenas?.[0] ??
        data.listaPremios?.[0]?.numeroCerteSorte;
      if (primeiroPremio) {
        return {
          concurso: data.concurso ?? data.numero ?? concurso,
          dataApuracao: data.data ?? data.dataApuracao ?? '',
          primeiroPremio: String(primeiroPremio).trim(),
        };
      }
    }
    if (res.status === 404) throw new Error('CONCURSO_NOT_AVAILABLE');
  } catch (err) {
    if (String(err).includes('CONCURSO_NOT_AVAILABLE')) throw err;
    // fallback to Caixa
  }

  // Attempt 2: Caixa direct API
  const res2 = await fetch(
    `https://servicebus2.caixa.gov.br/portaldeloterias/api/federal/${concurso}`,
    {
      next: { revalidate: 0 },
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(8000),
    }
  );

  if (res2.status === 404 || res2.status === 204) {
    throw new Error('CONCURSO_NOT_AVAILABLE');
  }
  if (!res2.ok) {
    throw new Error(`Loteria Federal API error: ${res2.status}`);
  }

  const data2 = await res2.json();
  const primeiroPremio =
    data2.listaDezenas?.[0] ??
    data2.listaPremios?.[0]?.numeroCerteSorte ??
    data2.premios?.[0]?.numero;

  if (!primeiroPremio) throw new Error('CONCURSO_NOT_AVAILABLE');

  return {
    concurso: data2.numero ?? concurso,
    dataApuracao: data2.dataApuracao ?? '',
    primeiroPremio: String(primeiroPremio).trim(),
  };
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```
Expected: `✓ Compiled successfully` with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/loterias.ts
git commit -m "feat: add getNextLotoFederalInfo and getLotoFederalByConcurso helpers"
```

---

## Task 3: openDrawSessionAction — commit to future concurso

**Files:**
- Modify: `src/server/raffle-actions.ts` (lines 605–655)

- [ ] **Step 1: Update imports at top of file**

The current import on line 8 is:
```typescript
import { getLatestLotoFederal, calcularNumeroVencedor } from '@/lib/loterias';
```
Change to:
```typescript
import { getLatestLotoFederal, calcularNumeroVencedor, getNextLotoFederalInfo } from '@/lib/loterias';
```

Also remove line 9:
```typescript
import { DRAW_COUNTDOWN_MINUTES } from '@/lib/draw-config';
```
(This import is no longer needed.)

- [ ] **Step 2: Replace `openDrawSessionAction`**

Replace the entire function (lines 605–655) with:

```typescript
export async function openDrawSessionAction(
  raffleId: string
): Promise<{ success: boolean; drawUrl?: string; nextConcurso?: number; drawAt?: string; error?: string }> {
  const cookieStore = await cookies();
  const adminSession = cookieStore.get('admin_session')?.value;
  if (!adminSession) return { success: false, error: 'Não autorizado.' };

  const supabase = createAdminClient();

  const { data: raffle } = await supabase
    .from('raffles')
    .select('id, status')
    .eq('id', raffleId)
    .single();

  if (!raffle) return { success: false, error: 'Rifa não encontrada.' };
  if (raffle.status !== 'closed')
    return { success: false, error: 'A rifa precisa estar fechada para abrir a sala.' };

  // Return existing active session if one already exists
  const { data: existing } = await supabase
    .from('draw_sessions')
    .select('target_concurso, draw_at')
    .eq('raffle_id', raffleId)
    .in('status', ['waiting', 'drawing'])
    .maybeSingle();

  if (existing) {
    return {
      success: true,
      drawUrl: `/sorteio/${raffleId}`,
      nextConcurso: existing.target_concurso ?? undefined,
      drawAt: existing.draw_at,
    };
  }

  // Fetch next concurso info from Loteria Federal
  let nextInfo: { nextConcurso: number; drawAt: Date };
  try {
    nextInfo = await getNextLotoFederalInfo();
  } catch (err) {
    console.error('Error fetching next concurso info:', err);
    return { success: false, error: 'Erro ao consultar próximo concurso da Loteria Federal.' };
  }

  const { error } = await supabase.from('draw_sessions').insert({
    raffle_id: raffleId,
    draw_at: nextInfo.drawAt.toISOString(),
    countdown_minutes: 0, // kept for schema compat; no longer used
    target_concurso: nextInfo.nextConcurso,
    status: 'waiting',
  });

  if (error) {
    console.error('Error creating draw session:', error);
    return { success: false, error: 'Erro ao criar sessão de sorteio.' };
  }

  return {
    success: true,
    drawUrl: `/sorteio/${raffleId}`,
    nextConcurso: nextInfo.nextConcurso,
    drawAt: nextInfo.drawAt.toISOString(),
  };
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```
Expected: `✓ Compiled successfully`. If TypeScript complains about `DRAW_COUNTDOWN_MINUTES` still imported elsewhere, fix by removing the import line.

- [ ] **Step 4: Commit**

```bash
git add src/server/raffle-actions.ts
git commit -m "feat: openDrawSessionAction commits to next Loteria Federal concurso"
```

---

## Task 4: Draw API — fetch specific concurso with polling support

**Files:**
- Modify: `src/app/api/sorteio/[raffleId]/draw/route.ts`

- [ ] **Step 1: Replace the file content entirely**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getLotoFederalByConcurso, getLatestLotoFederal, calcularNumeroVencedor } from '@/lib/loterias';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ raffleId: string }> }
) {
  const { raffleId } = await params;
  const supabase = createAdminClient();

  // 1. Find waiting session with draw_at <= now()
  const { data: session } = await supabase
    .from('draw_sessions')
    .select('*')
    .eq('raffle_id', raffleId)
    .eq('status', 'waiting')
    .lte('draw_at', new Date().toISOString())
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // 2. Atomically claim the session (only 1 concurrent request wins)
  const { data: claimed, error: claimError } = await supabase
    .from('draw_sessions')
    .update({ status: 'drawing' })
    .eq('id', session.id)
    .eq('status', 'waiting')
    .select()
    .maybeSingle();

  if (claimError || !claimed) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    // 3. Fetch raffle
    const { data: raffle } = await supabase
      .from('raffles')
      .select('*')
      .eq('id', raffleId)
      .single();

    if (!raffle || raffle.status !== 'closed') {
      throw new Error('Rifa não encontrada ou não está fechada.');
    }

    // 4. Fetch sold tickets
    const { data: soldTickets } = await supabase
      .from('tickets')
      .select('ticket_number, user_id')
      .eq('raffle_id', raffleId)
      .eq('status', 'sold');

    if (!soldTickets || soldTickets.length === 0) {
      throw new Error('Nenhuma cota vendida.');
    }

    // 5. Fetch the specific committed concurso result
    //    Falls back to latest if target_concurso is not set (legacy sessions)
    let lotoResult;
    try {
      if (session.target_concurso) {
        lotoResult = await getLotoFederalByConcurso(session.target_concurso);
      } else {
        lotoResult = await getLatestLotoFederal();
      }
    } catch (err) {
      if (String(err).includes('CONCURSO_NOT_AVAILABLE')) {
        // Result not published yet — revert to waiting so client can retry
        await supabase
          .from('draw_sessions')
          .update({ status: 'waiting' })
          .eq('id', session.id);
        return NextResponse.json(
          { ok: false, error: 'CONCURSO_NOT_AVAILABLE' },
          { status: 503 }
        );
      }
      throw err;
    }

    let winnerTicketNumber = calcularNumeroVencedor(
      lotoResult.primeiroPremio,
      raffle.total_numbers
    );

    // 6. Find ticket owner (with fallback to nearest sold ticket)
    let winnerTicket = soldTickets.find(t => t.ticket_number === winnerTicketNumber);
    if (!winnerTicket) {
      winnerTicket = soldTickets.reduce((closest, t) => {
        const diffT = Math.abs(t.ticket_number - winnerTicketNumber);
        const diffC = Math.abs(closest.ticket_number - winnerTicketNumber);
        return diffT < diffC ? t : closest;
      });
      winnerTicketNumber = winnerTicket.ticket_number;
    }

    // 7. Fetch winner name
    const { data: winnerUser } = await supabase
      .from('users')
      .select('name')
      .eq('id', winnerTicket.user_id)
      .single();

    const winnerName = winnerUser?.name ?? 'Desconhecido';

    // 8. Mark raffle as drawn
    await supabase
      .from('raffles')
      .update({
        status: 'drawn',
        drawn_at: new Date().toISOString(),
        winner_ticket_number: winnerTicketNumber,
        winner_user_id: winnerTicket.user_id,
      })
      .eq('id', raffleId);

    // 9. Update draw_session as drawn (triggers Realtime for all viewers)
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
    // Revert to waiting to allow retry
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

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/sorteio/[raffleId]/draw/route.ts
git commit -m "feat: draw API uses committed target_concurso, returns CONCURSO_NOT_AVAILABLE for polling"
```

---

## Task 5: DrawRoom.tsx — pass targetConcurso to CountdownPhase

**Files:**
- Modify: `src/app/sorteio/[raffleId]/DrawRoom.tsx`

- [ ] **Step 1: Update DrawSession interface and CountdownPhase props**

In `DrawRoom.tsx`, the `DrawSession` interface already has `concurso: number | null`. Add `target_concurso`:

```typescript
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
  target_concurso: number | null;  // ADD THIS
}
```

Then in the `CountdownPhase` render (around line 131), add the new prop:

```typescript
<CountdownPhase
  raffle={raffle}
  drawAt={session.draw_at}
  onCountdownEnd={triggerDraw}
  onDrawComplete={() => setPhase('drawn')}
  drawError={drawError}
  winnerNumber={session.winner_ticket_number}
  targetConcurso={session.target_concurso ?? undefined}
/>
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: build succeeds (TypeScript will warn that `CountdownPhase` doesn't have the new prop yet — that's OK for now, Task 7 adds it).

- [ ] **Step 3: Commit**

```bash
git add src/app/sorteio/[raffleId]/DrawRoom.tsx
git commit -m "feat: pass targetConcurso from DrawSession to CountdownPhase"
```

---

## Task 6: AdminDrawModal.tsx — show next concurso, remove countdown input (FRONTEND)

> **MANDATORY: Invoke `frontend-design:frontend-design` skill before writing any code in this task.**

**Files:**
- Modify: `src/components/admin/AdminDrawModal.tsx`

- [ ] **Step 1: Invoke frontend-design skill**

Before writing any code, invoke `frontend-design:frontend-design` to establish aesthetic direction. The modal must match the existing zinc/yellow design system.

- [ ] **Step 2: Update `openDrawSessionAction` call signature**

The action no longer takes `countdownMinutes`. Update the call:

```typescript
// OLD
const res = await openDrawSessionAction(raffleId, minutes);

// NEW
const res = await openDrawSessionAction(raffleId);
```

- [ ] **Step 3: Update state**

Remove `countdown` state (no longer needed):
```typescript
// Remove:
const [countdown, setCountdown] = useState(String(DRAW_COUNTDOWN_MINUTES));
```

Add state to store next concurso info returned from the action:
```typescript
const [concursoInfo, setConcursoInfo] = useState<{ nextConcurso: number; drawAt: string } | null>(null);
```

- [ ] **Step 4: Update handleOpen to store concurso info**

```typescript
const handleOpen = () => {
  startTransition(async () => {
    const res = await openDrawSessionAction(raffleId);
    if (res.success && res.drawUrl) {
      setDrawUrl(res.drawUrl);
      if (res.nextConcurso && res.drawAt) {
        setConcursoInfo({ nextConcurso: res.nextConcurso, drawAt: res.drawAt });
      }
    } else {
      toast.error(res.error || 'Erro ao abrir sala.');
    }
  });
};
```

- [ ] **Step 5: Update handleClose to reset concursoInfo**

```typescript
const handleClose = () => {
  setIsOpen(false);
  setDrawUrl(null);
  setConcursoInfo(null);
};
```

- [ ] **Step 6: Replace the modal body — remove countdown input, add concurso info badge**

Replace the entire `{!drawUrl ? (...) : (...)}` block:

```tsx
{!drawUrl ? (
  <>
    <p className="text-sm text-zinc-400 mb-4">
      Rifa: <span className="text-white font-medium">{raffleTitle}</span>
    </p>

    <div className="bg-zinc-800/50 rounded-lg p-4 mb-4 text-sm text-zinc-300">
      O sorteio será vinculado ao{' '}
      <span className="text-yellow-400 font-semibold">próximo concurso da Loteria Federal</span>.
      O resultado será obtido automaticamente na data do sorteio oficial. Compartilhe o link
      no grupo do WhatsApp para os participantes assistirem ao vivo.
    </div>

    <Button
      onClick={handleOpen}
      disabled={isPending}
      className="w-full bg-red-600 hover:bg-red-500 text-white font-bold"
    >
      {isPending ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Consultando Loteria Federal...
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
    {concursoInfo && (
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex items-center gap-3">
        <div className="text-yellow-400 text-xl font-black tabular-nums">
          #{concursoInfo.nextConcurso}
        </div>
        <div>
          <p className="text-yellow-300 text-xs font-semibold uppercase tracking-wider">
            Concurso vinculado
          </p>
          <p className="text-zinc-400 text-xs">
            {new Date(concursoInfo.drawAt).toLocaleString('pt-BR', {
              weekday: 'long',
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'America/Sao_Paulo',
            })}
          </p>
        </div>
      </div>
    )}

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
      Você pode fechar esta janela. O sorteio acontecerá automaticamente na data do concurso.
    </p>

    <Button onClick={handleClose} variant="ghost" className="w-full">
      Fechar
    </Button>
  </div>
)}
```

- [ ] **Step 7: Remove unused import**

Remove `import { DRAW_COUNTDOWN_MINUTES } from '@/lib/draw-config';` from the top of the file.

- [ ] **Step 8: Verify build**

```bash
npm run build
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 9: Commit**

```bash
git add src/components/admin/AdminDrawModal.tsx
git commit -m "feat: admin modal shows locked concurso info, removes manual countdown input"
```

---

## Task 7: CountdownPhase.tsx — concurso badge + polling state (FRONTEND)

> **MANDATORY: Invoke `frontend-design:frontend-design` skill before writing any code in this task.**

**Files:**
- Modify: `src/app/sorteio/[raffleId]/CountdownPhase.tsx`

- [ ] **Step 1: Invoke frontend-design skill**

Before writing any code, invoke `frontend-design:frontend-design`.

- [ ] **Step 2: Add `targetConcurso` to props interface**

Find the `CountdownPhaseProps` interface and add:

```typescript
interface CountdownPhaseProps {
  raffle: { id: string; title: string; image_url: string; total_numbers: number };
  drawAt: string;
  onCountdownEnd: () => void;
  onDrawComplete: () => void;
  drawError?: string | null;
  winnerNumber?: number | null;
  targetConcurso?: number;  // ADD THIS
}
```

- [ ] **Step 3: Add `'polling'` to SpinState type**

Find `type SpinState = ...` and add `'polling'`:

```typescript
type SpinState = 'idle' | 'waiting' | 'spinning' | 'stopped' | 'error' | 'polling';
```

- [ ] **Step 4: Add polling timer state**

Inside the component, after existing `useState` calls add:

```typescript
const [pollCountdown, setPollCountdown] = useState(60);
const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

- [ ] **Step 5: Add useEffect for `CONCURSO_NOT_AVAILABLE` detection**

The existing `useEffect` watching `drawError` handles generic errors. Add detection for the specific polling case:

```typescript
useEffect(() => {
  if (drawError === 'CONCURSO_NOT_AVAILABLE' && spinState === 'waiting') {
    setSpinState('polling');
    setPollCountdown(60);
  } else if (drawError && drawError !== 'CONCURSO_NOT_AVAILABLE' && spinState === 'waiting') {
    setSpinState('error');
  }
}, [drawError, spinState]);
```

- [ ] **Step 6: Add useEffect for polling auto-retry countdown**

```typescript
useEffect(() => {
  if (spinState !== 'polling') {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    return;
  }

  pollIntervalRef.current = setInterval(() => {
    setPollCountdown(prev => {
      if (prev <= 1) {
        clearInterval(pollIntervalRef.current!);
        // Trigger retry: reset to waiting and call onCountdownEnd
        setSpinState('waiting');
        onCountdownEnd();
        return 60;
      }
      return prev - 1;
    });
  }, 1000);

  return () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
  };
}, [spinState, onCountdownEnd]);
```

- [ ] **Step 7: Add concurso badge below the countdown timer**

In the JSX, find where the countdown digits (`HH:MM:SS`) are rendered. Right below the countdown display (before or after the existing subtitle), add:

```tsx
{targetConcurso && (
  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-xs font-mono">
    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
    <span className="text-zinc-400">Concurso</span>
    <span className="text-yellow-400 font-bold">{targetConcurso}</span>
    <span className="text-zinc-500">· Loteria Federal</span>
  </div>
)}
```

- [ ] **Step 8: Add polling state UI**

In the section that currently renders the error state (the `spinState === 'error'` branch), add a sibling branch for `polling`:

```tsx
{spinState === 'polling' && (
  <div className="flex flex-col items-center gap-3 py-6">
    <div className="w-8 h-8 rounded-full border-2 border-yellow-400/30 border-t-yellow-400 animate-spin" />
    <p className="text-yellow-300 font-semibold text-sm text-center">
      Aguardando resultado do Concurso {targetConcurso ?? ''}
    </p>
    <p className="text-zinc-500 text-xs text-center">
      A Loteria Federal ainda não publicou o resultado.<br />
      Próxima verificação em{' '}
      <span className="text-zinc-300 font-mono">{pollCountdown}s</span>
    </p>
  </div>
)}
```

- [ ] **Step 9: Verify build**

```bash
npm run build
```
Expected: `✓ Compiled successfully` with no TypeScript errors.

- [ ] **Step 10: Commit**

```bash
git add src/app/sorteio/[raffleId]/CountdownPhase.tsx
git commit -m "feat: countdown shows concurso badge and polling state when result not yet available"
```

---

## Task 8: Cleanup — delete draw-config.ts

**Files:**
- Delete: `src/lib/draw-config.ts`

- [ ] **Step 1: Verify no remaining imports**

```bash
grep -r "draw-config" src/
```
Expected: no output (all imports already removed in Tasks 3 and 6).

- [ ] **Step 2: Delete the file**

```bash
rm src/lib/draw-config.ts
```

- [ ] **Step 3: Final build check**

```bash
npm run build
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove draw-config.ts (countdown replaced by Loteria Federal schedule)"
```

---

## Self-Review

**Spec coverage:**
- ✅ System auto-suggests next concurso (N+1) when admin opens draw room
- ✅ Admin just confirms (one click "Abrir Sala")
- ✅ Countdown replaced by real Loteria Federal draw datetime
- ✅ Polling every 60s if result not available
- ✅ target_concurso stored in draw_sessions
- ✅ Draw API uses committed concurso, not latest

**Placeholder scan:** None found.

**Type consistency:**
- `openDrawSessionAction` returns `{ nextConcurso?: number; drawAt?: string }` — used in Task 6 ✅
- `CountdownPhaseProps.targetConcurso?: number` — passed from DrawRoom in Task 5 ✅
- `DrawSession.target_concurso: number | null` — added in Task 5 ✅
- `getLotoFederalByConcurso(concurso: number)` — called in Task 4 ✅
- `getNextLotoFederalInfo()` returns `{ currentConcurso, nextConcurso, drawAt: Date }` — used in Task 3 ✅
