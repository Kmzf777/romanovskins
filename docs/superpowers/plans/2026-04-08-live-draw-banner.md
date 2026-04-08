# Live Draw Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Sorteio AO VIVO!" section to the home page that displays cards for all active draw sessions (status 'waiting' or 'drawing'), each linking to `/sorteio/[raffleId]`.

**Architecture:** New server action `getLiveDrawSessions()` fetches active sessions joined with raffle data and ticket counts. A new pure server component `LiveDrawBanner` renders the section with a pulsing "AO VIVO" effect. The home page `page.tsx` fetches the data and conditionally renders the banner as the first section.

**Tech Stack:** Next.js 14 App Router (RSC), Supabase, Tailwind CSS, inline styles (matching existing codebase patterns)

---

## File Map

- **Modify:** `src/server/raffle-actions.ts` — add `getLiveDrawSessions()` export
- **Create:** `src/components/ui/live-draw-banner.tsx` — server component for the banner
- **Modify:** `src/app/page.tsx` — add live draw data fetch and render `<LiveDrawBanner>`

---

### Task 1: Add `getLiveDrawSessions()` to raffle-actions.ts

**Files:**
- Modify: `src/server/raffle-actions.ts`

- [ ] **Step 1: Add the `getLiveDrawSessions` function at the end of the exports (before the last closing of the file, after `getAllWinners`)**

Find the end of `raffle-actions.ts` and add:

```typescript
export interface LiveDrawData {
  session_id: string;
  raffle_id: string;
  draw_at: string;
  session_status: 'waiting' | 'drawing';
  title: string;
  image_url: string;
  price_per_ticket: number;
  total_numbers: number;
  float_value: string | null;
  wear_condition: string | null;
  original_price: number | null;
  available_count: number;
  sold_count: number;
}

export async function getLiveDrawSessions(): Promise<LiveDrawData[]> {
  if (!checkEnv()) return [];

  const supabase = await createClient();

  const { data: sessions, error } = await supabase
    .from('draw_sessions')
    .select('id, raffle_id, draw_at, status')
    .in('status', ['waiting', 'drawing']);

  if (error || !sessions || sessions.length === 0) {
    if (error) console.error('Error fetching live draw sessions:', error);
    return [];
  }

  const raffleIds = sessions.map(s => s.raffle_id);

  const { data: raffles, error: raffleError } = await supabase
    .from('raffles')
    .select('id, title, image_url, price_per_ticket, total_numbers, float_value, wear_condition, original_price')
    .in('id', raffleIds);

  if (raffleError || !raffles) {
    console.error('Error fetching raffles for live sessions:', raffleError);
    return [];
  }

  const { data: counts } = await supabase.rpc('get_raffle_ticket_counts', {
    raffle_ids: raffleIds,
  });

  const countMap: Record<string, { available_count: number; sold_count: number }> = {};
  (counts || []).forEach((c: any) => {
    countMap[c.raffle_id] = {
      available_count: Number(c.available_count),
      sold_count: Number(c.sold_count),
    };
  });

  const raffleMap: Record<string, any> = {};
  raffles.forEach(r => { raffleMap[r.id] = r; });

  return sessions
    .filter(s => raffleMap[s.raffle_id])
    .map(s => {
      const r = raffleMap[s.raffle_id];
      return {
        session_id: s.id,
        raffle_id: s.raffle_id,
        draw_at: s.draw_at,
        session_status: s.status as 'waiting' | 'drawing',
        title: r.title,
        image_url: r.image_url,
        price_per_ticket: r.price_per_ticket,
        total_numbers: r.total_numbers,
        float_value: r.float_value,
        wear_condition: r.wear_condition,
        original_price: r.original_price,
        available_count: countMap[r.id]?.available_count ?? r.total_numbers,
        sold_count: countMap[r.id]?.sold_count ?? 0,
      };
    });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/raffle-actions.ts
git commit -m "feat: add getLiveDrawSessions server action"
```

---

### Task 2: Create `LiveDrawBanner` component

**Files:**
- Create: `src/components/ui/live-draw-banner.tsx`

- [ ] **Step 1: Create the component file**

```tsx
import Link from 'next/link';
import { LiveDrawData } from '@/server/raffle-actions';

interface LiveDrawBannerProps {
  liveDraws: LiveDrawData[];
}

export function LiveDrawBanner({ liveDraws }: LiveDrawBannerProps) {
  if (liveDraws.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-6 md:px-10 pt-10 pb-4">
      {/* Animated styles */}
      <style>{`
        @keyframes live-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
        @keyframes live-glow {
          0%, 100% { text-shadow: 0 0 8px rgba(230,57,70,0.8), 0 0 20px rgba(230,57,70,0.4); }
          50% { text-shadow: 0 0 16px rgba(230,57,70,1), 0 0 40px rgba(230,57,70,0.6), 0 0 60px rgba(230,57,70,0.3); }
        }
        @keyframes border-live {
          0%, 100% { box-shadow: 0 0 0 1px rgba(230,57,70,0.4), 0 0 20px rgba(230,57,70,0.08); }
          50% { box-shadow: 0 0 0 1px rgba(230,57,70,0.8), 0 0 30px rgba(230,57,70,0.18); }
        }
        .live-glow-text {
          animation: live-glow 2s ease-in-out infinite;
          color: #E63946;
        }
        .live-dot {
          animation: live-pulse 1.2s ease-in-out infinite;
          background-color: #E63946;
        }
        .live-card {
          animation: border-live 2.5s ease-in-out infinite;
        }
      `}</style>

      {/* Section header */}
      <div className="flex items-center gap-4 mb-6">
        <h2
          style={{
            fontFamily: 'var(--font-bebas-neue)',
            fontSize: 'clamp(28px, 4vw, 44px)',
            color: '#F0EAD6',
            lineHeight: 1,
          }}
        >
          SORTEIO{' '}
          <span className="live-glow-text">AO VIVO!</span>
        </h2>
        <span
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-widest shrink-0"
          style={{
            backgroundColor: 'rgba(230,57,70,0.12)',
            border: '1px solid rgba(230,57,70,0.4)',
            color: '#E63946',
          }}
        >
          <span className="live-dot inline-block w-2 h-2 rounded-full" />
          LIVE
        </span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {liveDraws.map(draw => {
          const sold = draw.sold_count;
          const total = draw.total_numbers;
          const available = draw.available_count;
          const soldPercent = total > 0 ? Math.round((sold / total) * 100) : 0;
          const isUrgent = soldPercent >= 80;
          const progressColor = isUrgent ? '#E63946' : soldPercent >= 50 ? '#F5C518' : '#2DC653';

          return (
            <div
              key={draw.session_id}
              className="live-card rounded-2xl overflow-hidden"
              style={{
                backgroundColor: '#111114',
                border: '1px solid rgba(230,57,70,0.4)',
              }}
            >
              {/* Image */}
              <div className="relative aspect-video overflow-hidden">
                <img
                  src={draw.image_url}
                  alt={draw.title}
                  className="w-full h-full object-cover"
                  style={{ filter: 'brightness(0.9)' }}
                />
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: 'linear-gradient(to top, #111114 0%, transparent 60%)' }}
                />
                {/* LIVE badge */}
                <div
                  className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-widest"
                  style={{ backgroundColor: '#E63946', color: '#fff' }}
                >
                  <span className="live-dot inline-block w-1.5 h-1.5 rounded-full bg-white" />
                  AO VIVO
                </div>
                {/* Wear + Float badges */}
                <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
                  {draw.wear_condition && (
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                      style={{
                        backgroundColor: 'rgba(10,10,11,0.85)',
                        color: '#F5C518',
                        border: '1px solid rgba(245,197,24,0.3)',
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      {draw.wear_condition}
                    </span>
                  )}
                  {draw.float_value && (
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-mono"
                      style={{
                        backgroundColor: 'rgba(10,10,11,0.85)',
                        color: '#7A7A8A',
                        border: '1px solid #2A2A32',
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      {draw.float_value}
                    </span>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="p-4 space-y-3">
                <h3
                  className="font-bold leading-tight line-clamp-2"
                  style={{ color: '#F0EAD6', fontSize: '14px' }}
                >
                  {draw.title}
                </h3>

                <p
                  className="text-xl font-black"
                  style={{ fontFamily: 'var(--font-bebas-neue)', color: '#F5C518' }}
                >
                  R$ {draw.price_per_ticket.toFixed(2).replace('.', ',')}
                  <span
                    className="text-xs ml-1"
                    style={{ color: '#7A7A8A', fontFamily: 'var(--font-space-grotesk)' }}
                  >
                    / cota
                  </span>
                </p>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#2A2A32' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${soldPercent}%`,
                        backgroundColor: progressColor,
                        transition: 'width 0.5s ease',
                      }}
                    />
                  </div>
                  <div
                    className="flex justify-between text-[10px]"
                    style={{ color: '#4A4A5A', fontFamily: 'var(--font-geist-mono)' }}
                  >
                    <span>{soldPercent}% vendido</span>
                    <span>{available} restantes</span>
                  </div>
                </div>

                {/* CTA */}
                <Link
                  href={`/sorteio/${draw.raffle_id}`}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all duration-200 hover:scale-[1.02]"
                  style={{
                    backgroundColor: '#E63946',
                    color: '#fff',
                    boxShadow: '0 0 20px rgba(230,57,70,0.3)',
                  }}
                >
                  <span
                    className="live-dot inline-block w-2 h-2 rounded-full bg-white shrink-0"
                  />
                  ASSISTIR AO VIVO
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div className="mt-8 h-px" style={{ background: 'linear-gradient(to right, transparent, #2A2A32, transparent)' }} />
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/live-draw-banner.tsx
git commit -m "feat: add LiveDrawBanner component with AO VIVO effect"
```

---

### Task 3: Wire up in page.tsx

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add the import and data fetch**

Add import at the top:
```tsx
import { getRaffles, getRecentWinners, getPublicStats, getLiveDrawSessions } from '@/server/raffle-actions';
import { LiveDrawBanner } from '@/components/ui/live-draw-banner';
```

Change the `Promise.all` from:
```tsx
const [raffles, recentWinners, stats] = await Promise.all([
    getRaffles(),
    getRecentWinners(),
    getPublicStats(),
]);
```
to:
```tsx
const [raffles, recentWinners, stats, liveDraws] = await Promise.all([
    getRaffles(),
    getRecentWinners(),
    getPublicStats(),
    getLiveDrawSessions(),
]);
```

- [ ] **Step 2: Render the banner as first child of the z-10 div**

Change:
```tsx
<div className="relative z-10">
    {/* Featured Raffles */}
```
to:
```tsx
<div className="relative z-10">
    {/* Live Draw Banner */}
    <LiveDrawBanner liveDraws={liveDraws} />

    {/* Featured Raffles */}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: render LiveDrawBanner on home page when draw sessions are live"
```
