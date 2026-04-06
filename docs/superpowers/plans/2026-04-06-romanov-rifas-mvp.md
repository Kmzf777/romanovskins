# Romanov Rifas MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir todos os bugs críticos do MVP, implementar sorteio via Loteria Federal, timer de reserva, barra de progresso de cotas e página "Meus Tickets".

**Architecture:** Next.js 15 App Router + Supabase (PostgreSQL) + AbacatePay. Server Actions para toda lógica de negócio. Client Components apenas para interatividade (timer, grid, modal). Nova SQL function `get_raffle_ticket_counts` para contagens agregadas.

**Tech Stack:** Next.js 16, Supabase, Zustand, sonner (a instalar), Tailwind CSS, TypeScript

---

## Task 1: SQL Migrations no Supabase

**Files:**
- Run SQL in: Supabase Dashboard → SQL Editor

- [ ] **Step 1: Adicionar colunas à tabela `raffles`**

Abra o Supabase Dashboard → SQL Editor e execute:

```sql
-- Campos para sorteio
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS drawn_at TIMESTAMPTZ;
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS winner_ticket_number INT;
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS winner_user_id UUID REFERENCES users(id);

-- Campos de metadata da skin (opcionais)
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS float_value TEXT;
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS wear_condition TEXT;
```

- [ ] **Step 2: Corrigir o CHECK de status para incluir 'drawn'**

```sql
-- Descobrir o nome real do constraint (copie o nome que aparecer)
SELECT conname FROM pg_constraint 
WHERE conrelid = 'raffles'::regclass AND contype = 'c';

-- Substituir pelo nome real encontrado acima
ALTER TABLE raffles DROP CONSTRAINT IF EXISTS raffles_status_check;
ALTER TABLE raffles ADD CONSTRAINT raffles_status_check
  CHECK (status IN ('active', 'closed', 'drawn', 'cancelled'));
```

- [ ] **Step 3: Criar SQL Function para contagem de tickets**

```sql
CREATE OR REPLACE FUNCTION get_raffle_ticket_counts(raffle_ids uuid[])
RETURNS TABLE(raffle_id uuid, available_count bigint, sold_count bigint) 
LANGUAGE sql STABLE AS $$
  SELECT 
    t.raffle_id,
    COUNT(*) FILTER (WHERE t.status = 'available') AS available_count,
    COUNT(*) FILTER (WHERE t.status = 'sold') AS sold_count
  FROM tickets t
  WHERE t.raffle_id = ANY(raffle_ids)
  GROUP BY t.raffle_id;
$$;
```

- [ ] **Step 4: Configurar pg_cron para liberar reservas expiradas**

No Supabase Dashboard → Database → Extensions, ative `pg_cron`. Depois execute:

```sql
SELECT cron.schedule(
  'release-expired-reservations',
  '*/1 * * * *',
  $$
    UPDATE tickets
    SET status = 'available', 
        user_id = NULL, 
        reserved_at = NULL, 
        expires_at = NULL
    WHERE status = 'reserved' 
      AND expires_at < NOW();
  $$
);

-- Verificar que o job foi criado:
SELECT * FROM cron.job;
```

- [ ] **Step 5: Verificar que as alterações foram aplicadas**

```sql
-- Deve listar as novas colunas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'raffles' 
ORDER BY ordinal_position;

-- Deve retornar vazio (sem erro)
SELECT get_raffle_ticket_counts(ARRAY[]::uuid[]);
```

Expected: lista de colunas inclui `drawn_at`, `winner_ticket_number`, `winner_user_id`, `float_value`, `wear_condition`.

---

## Task 2: Instalar sonner + Atualizar TypeScript types

**Files:**
- Modify: `src/types/index.ts`
- Run: `npm install sonner`

- [ ] **Step 1: Instalar sonner**

```bash
cd "C:\Users\rafae\OneDrive\Desktop\Canastra Inteligencia\Sites\romanovrifas"
npm install sonner
```

Expected: `added 1 package` sem erros.

- [ ] **Step 2: Atualizar `src/types/index.ts`**

Substituir o conteúdo completo do arquivo por:

```typescript
export type RaffleStatus = 'active' | 'closed' | 'drawn' | 'cancelled';
export type TicketStatus = 'available' | 'reserved' | 'sold';

export interface User {
    id: string;
    name: string;
    whatsapp: string;
    created_at: string;
}

export interface Raffle {
    id: string;
    title: string;
    description: string | null;
    image_url: string;
    price_per_ticket: number;
    total_numbers: number;
    status: RaffleStatus;
    winner_number: number | null;
    winner_ticket_number: number | null;
    winner_user_id: string | null;
    drawn_at: string | null;
    float_value: string | null;
    wear_condition: string | null;
    created_at: string;
    // Computed by getRaffles()
    available_count?: number;
    sold_count?: number;
}

export interface Ticket {
    id: number;
    raffle_id: string;
    ticket_number: number;
    status: TicketStatus;
    user_id: string | null;
    reserved_at: string | null;
    expires_at: string | null;
}

export interface Transaction {
    id: string;
    user_id: string;
    raffle_id: string;
    external_id: string | null;
    amount: number;
    status: 'pending' | 'paid' | 'failed';
    ticket_numbers: number[];
    created_at: string;
}

export interface AdminStats {
    totalRaffles: number;
    activeRaffles: number;
    soldTickets: number;
    totalRevenue: number;
    totalUsers: number;
}

export interface Winner {
    id: string;
    name: string;
    raffle_title: string;
    raffle_image: string;
    ticket_number: number;
    draw_date: string;
}
```

- [ ] **Step 3: Verificar que o TypeScript compila**

```bash
npx tsc --noEmit
```

Expected: 0 erros (ou apenas erros pré-existentes não relacionados a types/index.ts).

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts package.json package-lock.json
git commit -m "chore: install sonner, update TypeScript types for MVP features"
```

---

## Task 3: Fix getRaffles() com contagem real de cotas

**Files:**
- Modify: `src/server/raffle-actions.ts` (função `getRaffles`)
- Modify: `src/components/ui/ticket-card.tsx`

- [ ] **Step 1: Atualizar `getRaffles()` em `src/server/raffle-actions.ts`**

Substituir apenas a função `getRaffles` (linhas 170–185):

```typescript
export async function getRaffles() {
    if (!checkEnv()) return MOCK_RAFFLES;

    const supabase = await createClient();
    const { data: raffles, error } = await supabase
        .from('raffles')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

    if (error || !raffles || raffles.length === 0) {
        if (error) console.error('Error fetching raffles:', error);
        return [];
    }

    // Buscar contagens reais de tickets por rifa
    const { data: counts } = await supabase.rpc('get_raffle_ticket_counts', {
        raffle_ids: raffles.map(r => r.id)
    });

    const countMap: Record<string, { available_count: number; sold_count: number }> = {};
    (counts || []).forEach((c: any) => {
        countMap[c.raffle_id] = {
            available_count: Number(c.available_count),
            sold_count: Number(c.sold_count)
        };
    });

    return raffles.map(r => ({
        ...r,
        available_count: countMap[r.id]?.available_count ?? r.total_numbers,
        sold_count: countMap[r.id]?.sold_count ?? 0,
    }));
}
```

- [ ] **Step 2: Atualizar `src/components/ui/ticket-card.tsx` — dados reais + progress bar**

Substituir o conteúdo completo do arquivo por:

```typescript
'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Ticket } from 'lucide-react';

interface TicketCardProps {
    raffle: {
        id: string;
        title: string;
        description: string | null;
        image_url: string;
        price_per_ticket: number;
        total_numbers: number;
        status: string;
        float_value?: string | null;
        wear_condition?: string | null;
        available_count?: number;
        sold_count?: number;
    };
}

export function TicketCard({ raffle }: TicketCardProps) {
    const available = raffle.available_count ?? raffle.total_numbers;
    const sold = raffle.sold_count ?? 0;
    const soldPercent = raffle.total_numbers > 0
        ? Math.round((sold / raffle.total_numbers) * 100)
        : 0;

    const progressColor =
        soldPercent >= 80 ? 'bg-red-500' :
        soldPercent >= 50 ? 'bg-yellow-500' :
        'bg-green-500';

    return (
        <Card className="group relative overflow-hidden bg-zinc-900 border-zinc-800 hover:border-primary/50 transition-all duration-300">
            <div className="flex flex-col md:flex-row">
                {/* Left Side - Image Area */}
                <div className="relative w-full md:w-80 aspect-square md:aspect-auto shrink-0 md:p-4 p-0">
                    <div className="w-full h-full relative overflow-hidden rounded-xl">
                        <img
                            src={raffle.image_url}
                            alt={raffle.title}
                            className="w-full h-full object-cover transition-transform duration-500"
                        />
                        <div className="absolute top-0 left-0 p-2 w-full flex justify-between items-start text-[10px] sm:text-xs font-mono tracking-wider">
                            {raffle.float_value && (
                                <span className="bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-zinc-400 border border-zinc-800">
                                    {raffle.float_value}
                                </span>
                            )}
                            {raffle.wear_condition && (
                                <span className="bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-yellow-500 border border-zinc-800 uppercase ml-auto">
                                    {raffle.wear_condition}
                                </span>
                            )}
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-zinc-900/50" />
                    </div>
                </div>

                {/* Right Side - Content */}
                <div className="flex-1 p-6 flex flex-col justify-between relative">
                    <div
                        className="hidden md:block absolute left-0 top-6 bottom-6 w-[2px]"
                        style={{
                            backgroundImage: 'linear-gradient(to bottom, #27272a 50%, transparent 50%)',
                            backgroundSize: '2px 14px',
                            backgroundRepeat: 'repeat-y'
                        }}
                    />
                    <div
                        className="md:hidden absolute top-0 left-6 right-6 h-[2px]"
                        style={{
                            backgroundImage: 'linear-gradient(to right, #27272a 50%, transparent 50%)',
                            backgroundSize: '14px 2px',
                            backgroundRepeat: 'repeat-x'
                        }}
                    />

                    <div className="space-y-4">
                        <div className="flex justify-between items-start gap-4">
                            <div>
                                <h3 className="text-xl md:text-2xl font-bold text-white group-hover:text-primary transition-colors line-clamp-1">
                                    {raffle.title}
                                </h3>
                                <p className="text-sm text-zinc-400 mt-1 line-clamp-2">
                                    {raffle.description}
                                </p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-sm text-zinc-500">Cota</p>
                                <p className="text-2xl md:text-3xl font-black text-primary">
                                    R$ {raffle.price_per_ticket.toFixed(2)}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 py-4 border-t border-zinc-800/50 border-b">
                            <div>
                                <p className="text-xs text-zinc-500 uppercase tracking-wider">Total de Cotas</p>
                                <p className="text-lg font-semibold text-zinc-300">{raffle.total_numbers}</p>
                            </div>
                            <div>
                                <p className="text-xs text-zinc-500 uppercase tracking-wider">Cotas Restantes</p>
                                <p className="text-lg font-semibold text-zinc-300">{available}</p>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div>
                            <div className="flex justify-between text-xs text-zinc-500 mb-1">
                                <span>{sold} vendidas</span>
                                <span>{soldPercent}%</span>
                            </div>
                            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                                    style={{ width: `${soldPercent}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 mt-auto">
                        <Button asChild className="w-full h-14 text-lg bg-primary text-black hover:bg-primary/90 font-black tracking-widest uppercase shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300">
                            <Link href={`/rifa/${raffle.id}`}>
                                Comprar Cota
                                <Ticket className="w-6 h-6 ml-3" />
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </Card>
    );
}
```

- [ ] **Step 3: Verificar build**

```bash
npm run build 2>&1 | tail -20
```

Expected: nenhum erro de TypeScript nos arquivos modificados.

- [ ] **Step 4: Commit**

```bash
git add src/server/raffle-actions.ts src/components/ui/ticket-card.tsx
git commit -m "fix: real ticket counts in raffle listing, real progress bar"
```

---

## Task 4: Fix getRecentWinners() e getPastRaffles()

**Files:**
- Modify: `src/server/raffle-actions.ts`

- [ ] **Step 1: Substituir `getRecentWinners()` (linhas 305–315 aprox.)**

Localizar e substituir a função completa `getRecentWinners`:

```typescript
export async function getRecentWinners() {
    if (!checkEnv()) return MOCK_WINNERS;

    const supabase = await createClient();

    const { data, error } = await supabase
        .from('raffles')
        .select(`
            id,
            title,
            image_url,
            winner_ticket_number,
            drawn_at,
            winner_user:users!winner_user_id ( name )
        `)
        .eq('status', 'drawn')
        .not('winner_user_id', 'is', null)
        .order('drawn_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching winners:', error);
        return [];
    }

    return (data || []).map((r: any) => ({
        id: r.id,
        name: r.winner_user?.name ?? 'Desconhecido',
        raffle_title: r.title,
        raffle_image: r.image_url,
        ticket_number: r.winner_ticket_number,
        draw_date: r.drawn_at
            ? new Date(r.drawn_at).toLocaleDateString('pt-BR')
            : '',
    }));
}
```

- [ ] **Step 2: Substituir `getPastRaffles()` (linhas 288–303 aprox.)**

Localizar e substituir a função completa `getPastRaffles`:

```typescript
export async function getPastRaffles() {
    if (!checkEnv()) return MOCK_PAST_RAFFLES;

    const supabase = await createClient();
    const { data, error } = await supabase
        .from('raffles')
        .select('*, winner_user:users!winner_user_id ( name )')
        .in('status', ['closed', 'drawn'])
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching past raffles:', error);
        return [];
    }
    return data || [];
}
```

- [ ] **Step 3: Verificar build**

```bash
npm run build 2>&1 | tail -20
```

Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/server/raffle-actions.ts
git commit -m "fix: real DB queries for winners and past raffles"
```

---

## Task 5: Fix createCheckoutAction — transaction ID no returnUrl

**Files:**
- Modify: `src/server/payment-actions.ts`

- [ ] **Step 1: Substituir o conteúdo completo de `src/server/payment-actions.ts`**

```typescript
'use server';

import { abacatePay } from '@/lib/abacatepay';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function createCheckoutAction(raffleId: string) {
    const supabase = await createClient();
    const cookieStore = await cookies();
    const userId = cookieStore.get('romanov_user')?.value;

    if (!userId) {
        return { error: 'Usuário não autenticado' };
    }

    const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
    if (!user) return { error: 'Usuário não encontrado' };

    const { data: tickets } = await supabase
        .from('tickets')
        .select('*')
        .eq('raffle_id', raffleId)
        .eq('user_id', userId)
        .eq('status', 'reserved');

    if (!tickets || tickets.length === 0) {
        return { error: 'Nenhuma cota reservada encontrada. Selecione cotas primeiro.' };
    }

    const { data: raffle } = await supabase
        .from('raffles')
        .select('*')
        .eq('id', raffleId)
        .single();

    if (!raffle) return { error: 'Rifa não encontrada' };

    const totalAmount = tickets.length * raffle.price_per_ticket;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://romanovdasrifas.vercel.app';

    // Gerar ID da transação ANTES do POST para poder incluir na returnUrl
    const transactionId = crypto.randomUUID();

    try {
        if (!user.whatsapp) {
            return { error: 'Número de WhatsApp não cadastrado.' };
        }

        const phoneDigits = user.whatsapp.replace(/\D/g, '');

        const payload = {
            frequency: 'ONE_TIME',
            methods: ['PIX'],
            products: [
                {
                    externalId: raffleId,
                    name: `Rifa: ${raffle.title}`,
                    quantity: tickets.length,
                    price: Math.round(raffle.price_per_ticket * 100),
                }
            ],
            returnUrl: `${appUrl}/checkout/success?tid=${transactionId}`,
            completionUrl: `${appUrl}/checkout/success?tid=${transactionId}`,
            customer: {
                name: user.name,
                cellphone: phoneDigits,
                email: `user${phoneDigits}@romanovrifas.com`,
                taxId: '529.982.247-25'
            }
        };

        console.log('📤 Creating billing:', JSON.stringify(payload, null, 2));

        const response = await abacatePay.post('/billing/create', payload);

        console.log('📥 AbacatePay response:', JSON.stringify(response.data, null, 2));

        const billingData = response.data.data || response.data;
        const billingId = billingData.id || billingData.billing?.id;
        const billingUrl = billingData.url || billingData.billing?.url || billingData.payment_url;

        if (!billingUrl) {
            console.error('❌ No billing URL in response:', response.data);
            return { error: 'Erro ao obter link de pagamento. Tente novamente.' };
        }

        // Salvar transação com o ID pré-gerado
        const { error: insertError } = await supabase.from('transactions').insert({
            id: transactionId,
            user_id: userId,
            raffle_id: raffleId,
            external_id: billingId || 'unknown',
            amount: totalAmount,
            status: 'pending',
            ticket_numbers: tickets.map(t => t.ticket_number)
        });

        if (insertError) {
            console.error('❌ Error saving transaction:', insertError);
            return { error: 'Erro ao salvar transação.' };
        }

        return { url: billingUrl };

    } catch (e: any) {
        console.error('❌ Payment Error:', e.response?.data || e.message);
        const errorMessage = e.response?.data?.error?.message
            || e.response?.data?.message
            || 'Erro ao gerar pagamento. Tente novamente mais tarde.';
        return { error: errorMessage };
    }
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build 2>&1 | tail -20
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/server/payment-actions.ts
git commit -m "fix: include transaction ID in AbacatePay returnUrl so receipt works"
```

---

## Task 6: Fix layout.tsx metadata + Toaster

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Substituir `src/app/layout.tsx`**

```typescript
import type { Metadata } from "next";
import { Space_Grotesk, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import HeroAscii from '@/components/ui/hero-ascii';
import { Toaster } from 'sonner';

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Romanov Rifas | Skins de CS2",
  description: "Concorra a skins raras de CS2. Rifas com pagamento via PIX, sorteio transparente pela Loteria Federal e entrega imediata.",
  openGraph: {
    title: "Romanov Rifas | Skins de CS2",
    description: "Concorra a skins raras de CS2. Rifas com pagamento via PIX e sorteio transparente.",
    type: "website",
    images: ["/logo-icon.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${spaceGrotesk.variable} ${sourceSans.variable} antialiased`}>
        <HeroAscii />
        <Header />
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1A1A1D',
              border: '1px solid #3A3A3F',
              color: '#FFFFFF',
            },
          }}
        />
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build 2>&1 | tail -20
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "fix: site metadata with correct title/OG tags, add sonner Toaster"
```

---

## Task 7: Substituir alert() por toast em RaffleDetailClient

**Files:**
- Modify: `src/components/raffle/RaffleDetailClient.tsx`

- [ ] **Step 1: Substituir `src/components/raffle/RaffleDetailClient.tsx`**

```typescript
'use client';
import { TicketGrid } from './TicketGrid';
import { useCartStore } from '@/store/cart-store';
import { Button } from '@/components/ui/button';
import { reserveTicketsAction } from '@/server/raffle-actions';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function RaffleDetailClient({ raffle, tickets, userId }: any) {
    const { selectedNumbers, clearCart } = useCartStore();
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    // Calcular progresso
    const sold = tickets.filter((t: any) => t.status !== 'available').length;
    const soldPercent = raffle.total_numbers > 0
        ? Math.round((sold / raffle.total_numbers) * 100)
        : 0;
    const progressColor =
        soldPercent >= 80 ? 'bg-red-500' :
        soldPercent >= 50 ? 'bg-yellow-500' :
        'bg-green-500';

    const handleReserve = () => {
        if (!userId) {
            router.push(`/login?next=/rifa/${raffle.id}`);
            return;
        }
        startTransition(async () => {
            const result = await reserveTicketsAction(raffle.id, selectedNumbers);
            if (result.success) {
                clearCart();
                router.push(`/checkout/${raffle.id}`);
            } else {
                toast.error(result.error || 'Erro ao reservar cotas.');
                router.refresh();
            }
        });
    };

    return (
        <div className="pb-24">
            <div className="mb-6 bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-lg shadow-sm">
                <div className="aspect-square relative mb-4 rounded-lg overflow-hidden bg-zinc-900/50 max-w-md mx-auto">
                    <img src={raffle.image_url} alt={raffle.title} className="w-full h-full object-cover" />
                </div>
                <h1 className="text-3xl font-bold text-white">{raffle.title}</h1>
                <p className="text-zinc-400 mt-2">{raffle.description}</p>
                <div className="mt-4 flex items-center gap-4">
                    <span className="text-2xl font-bold text-green-500">R$ {raffle.price_per_ticket.toFixed(2)}</span>
                    <span className="text-sm text-zinc-500">por cota</span>
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                    <div className="flex justify-between text-xs text-zinc-500 mb-1">
                        <span>{sold} de {raffle.total_numbers} cotas vendidas</span>
                        <span>{soldPercent}%</span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                            style={{ width: `${soldPercent}%` }}
                        />
                    </div>
                </div>
            </div>

            <div className="bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-lg shadow-sm">
                <h2 className="text-xl font-semibold mb-4 text-white">Escolha seus números</h2>
                <TicketGrid tickets={tickets} raffleId={raffle.id} userId={userId} />
            </div>

            {selectedNumbers.length > 0 && (
                <div className="fixed bottom-0 left-0 w-full bg-zinc-900/90 backdrop-blur-xl border-t border-white/10 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.5)] flex justify-between items-center z-50 px-4 md:px-8">
                    <div>
                        <p className="font-bold text-lg text-white">{selectedNumbers.length} cota(s)</p>
                        <p className="text-sm text-zinc-400">Total: R$ {(selectedNumbers.length * raffle.price_per_ticket).toFixed(2)}</p>
                    </div>
                    <Button onClick={handleReserve} disabled={isPending} size="lg" className="bg-green-600 hover:bg-green-700 text-white border-0">
                        {isPending ? 'Reservando...' : 'Reservar Agora'}
                    </Button>
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/raffle/RaffleDetailClient.tsx
git commit -m "fix: replace alert() with sonner toast in raffle detail, add progress bar"
```

---

## Task 8: Update CreateRaffleForm + createRaffleAction com float/condition

**Files:**
- Modify: `src/components/admin/CreateRaffleForm.tsx`
- Modify: `src/server/raffle-actions.ts` (função `createRaffleAction` e schema)

- [ ] **Step 1: Atualizar o schema de validação em `raffle-actions.ts`**

Localizar `const createRaffleSchema = z.object({...})` e substituir por:

```typescript
const createRaffleSchema = z.object({
    title: z.string().min(3, 'Título muito curto'),
    description: z.string().optional(),
    image_url: z.string().url('URL da imagem inválida'),
    price_per_ticket: z.number().min(0.01, 'Preço deve ser maior que 0'),
    total_numbers: z.number().int().min(1).max(100000, 'Máximo de 100.000 cotas'),
    float_value: z.string().optional(),
    wear_condition: z.string().optional(),
});
```

- [ ] **Step 2: Atualizar a função `createRaffleAction` para ler os novos campos**

Dentro de `createRaffleAction`, após a linha `const total_numbers = parseInt(...)`, adicionar:

```typescript
    const float_value = (formData.get('float_value') as string) || null;
    const wear_condition = (formData.get('wear_condition') as string) || null;
```

E no `supabase.from('raffles').insert({...})`, adicionar os campos:

```typescript
    const { data: raffle, error: raffleError } = await supabase
        .from('raffles')
        .insert({
            title,
            description,
            image_url,
            price_per_ticket,
            total_numbers,
            status: 'active',
            float_value: float_value || null,
            wear_condition: wear_condition || null,
        })
        .select()
        .single();
```

- [ ] **Step 3: Substituir `src/components/admin/CreateRaffleForm.tsx`**

```typescript
'use client';
import { useActionState } from 'react';
import { createRaffleAction } from '@/server/raffle-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';

const initialState = { error: '' };

const WEAR_CONDITIONS = [
    'Factory New',
    'Minimal Wear',
    'Field-Tested',
    'Well-Worn',
    'Battle-Scarred',
];

export function CreateRaffleForm() {
    const [state, formAction, isPending] = useActionState(createRaffleAction, initialState);

    return (
        <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>Criar Nova Rifa</CardTitle>
            </CardHeader>
            <form action={formAction}>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Título</Label>
                        <Input id="title" name="title" required placeholder="Ex: AK-47 Redline" disabled={isPending} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Descrição</Label>
                        <Textarea id="description" name="description" placeholder="Detalhes da skin..." disabled={isPending} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="image_url">URL da Imagem</Label>
                        <Input id="image_url" name="image_url" type="url" required placeholder="https://..." disabled={isPending} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="price_per_ticket">Preço por Cota (R$)</Label>
                            <Input id="price_per_ticket" name="price_per_ticket" type="number" step="0.01" min="0.01" required placeholder="0.50" disabled={isPending} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="total_numbers">Total de Números</Label>
                            <Input id="total_numbers" name="total_numbers" type="number" min="1" max="100000" required placeholder="100" disabled={isPending} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="float_value">Float (opcional)</Label>
                            <Input id="float_value" name="float_value" placeholder="Ex: 0.0123456789" disabled={isPending} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="wear_condition">Condição (opcional)</Label>
                            <select
                                id="wear_condition"
                                name="wear_condition"
                                disabled={isPending}
                                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <option value="">Selecione...</option>
                                {WEAR_CONDITIONS.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {state?.error && (
                        <p className="text-sm text-red-500 font-medium">{state.error}</p>
                    )}
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isPending}>
                        {isPending ? 'Criando...' : 'Criar Rifa'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
```

- [ ] **Step 4: Verificar build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add src/server/raffle-actions.ts src/components/admin/CreateRaffleForm.tsx
git commit -m "feat: add float_value and wear_condition fields to raffle creation"
```

---

## Task 9: Admin Dashboard — stats reais + lista de rifas + closeRaffleAction

**Files:**
- Modify: `src/server/raffle-actions.ts` (novas funções: `getAdminStats`, `getAllRafflesAdmin`, `closeRaffleAction`)
- Modify: `src/app/adminromanovskins/page.tsx`

- [ ] **Step 1: Adicionar novas server actions ao final de `src/server/raffle-actions.ts`**

Adicionar antes do final do arquivo:

```typescript
export async function getAdminStats() {
    if (!checkEnv()) return {
        totalRaffles: 2, activeRaffles: 2, soldTickets: 47, totalRevenue: 94.00, totalUsers: 5
    };

    const supabase = createAdminClient();

    const [rafflesRes, soldRes, revenueRes, usersRes] = await Promise.all([
        supabase.from('raffles').select('id, status'),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'sold'),
        supabase.from('transactions').select('amount').eq('status', 'paid'),
        supabase.from('users').select('id', { count: 'exact', head: true }),
    ]);

    const totalRevenue = (revenueRes.data || []).reduce((sum, t) => sum + Number(t.amount), 0);
    const activeRaffles = (rafflesRes.data || []).filter(r => r.status === 'active').length;

    return {
        totalRaffles: rafflesRes.data?.length ?? 0,
        activeRaffles,
        soldTickets: soldRes.count ?? 0,
        totalRevenue,
        totalUsers: usersRes.count ?? 0,
    };
}

export async function getAllRafflesAdmin() {
    if (!checkEnv()) return [...MOCK_RAFFLES, ...MOCK_PAST_RAFFLES];

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('raffles')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching admin raffles:', error);
        return [];
    }

    if (!data || data.length === 0) return [];

    const { data: counts } = await supabase.rpc('get_raffle_ticket_counts', {
        raffle_ids: data.map(r => r.id)
    });

    const countMap: Record<string, { available_count: number; sold_count: number }> = {};
    (counts || []).forEach((c: any) => {
        countMap[c.raffle_id] = {
            available_count: Number(c.available_count),
            sold_count: Number(c.sold_count),
        };
    });

    return data.map(r => ({
        ...r,
        available_count: countMap[r.id]?.available_count ?? r.total_numbers,
        sold_count: countMap[r.id]?.sold_count ?? 0,
    }));
}

export async function closeRaffleAction(raffleId: string) {
    if (!checkEnv()) return { success: true };

    const supabase = createAdminClient();
    const { error } = await supabase
        .from('raffles')
        .update({ status: 'closed' })
        .eq('id', raffleId)
        .eq('status', 'active');

    if (error) {
        console.error('Error closing raffle:', error);
        return { success: false, error: 'Erro ao fechar rifa.' };
    }

    revalidatePath('/adminromanovskins');
    revalidatePath('/');
    return { success: true };
}
```

- [ ] **Step 2: Substituir `src/app/adminromanovskins/page.tsx`**

```typescript
import { cookies } from 'next/headers';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getAdminStats, getAllRafflesAdmin } from '@/server/raffle-actions';
import { AdminRaffleList } from '@/components/admin/AdminRaffleList';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
    const cookieStore = await cookies();
    const adminSession = cookieStore.get('admin_session')?.value;

    if (!adminSession) {
        return (
            <div className="flex min-h-screen items-center justify-center p-4 relative z-10">
                <AdminLoginForm />
            </div>
        );
    }

    const [stats, raffles] = await Promise.all([
        getAdminStats(),
        getAllRafflesAdmin(),
    ]);

    return (
        <div className="min-h-screen relative z-10 text-white">
            <header className="bg-white/10 backdrop-blur-md shadow p-4 mb-6 border-b border-white/10">
                <h1 className="text-xl font-bold">Painel Administrativo</h1>
            </header>
            <main className="container mx-auto p-4 space-y-8">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Dashboard</h2>
                    <Link href="/adminromanovskins/create">
                        <Button>Nova Rifa</Button>
                    </Link>
                </div>

                {/* Stats */}
                <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
                    {[
                        { label: 'Total de Rifas', value: stats.totalRaffles },
                        { label: 'Rifas Ativas', value: stats.activeRaffles },
                        { label: 'Cotas Vendidas', value: stats.soldTickets },
                        { label: 'Receita Total', value: `R$ ${stats.totalRevenue.toFixed(2)}` },
                        { label: 'Usuários', value: stats.totalUsers },
                    ].map(s => (
                        <div key={s.label} className="bg-white/5 p-4 rounded-lg border border-white/10">
                            <p className="text-xs text-zinc-400 uppercase tracking-wider">{s.label}</p>
                            <p className="text-2xl font-bold text-white mt-1">{s.value}</p>
                        </div>
                    ))}
                </div>

                {/* Raffle List */}
                <div>
                    <h3 className="text-xl font-semibold mb-4">Rifas</h3>
                    <AdminRaffleList raffles={raffles} />
                </div>
            </main>
        </div>
    );
}
```

- [ ] **Step 3: Criar `src/components/admin/AdminRaffleList.tsx`**

```typescript
'use client';

import { useTransition } from 'react';
import { closeRaffleAction } from '@/server/raffle-actions';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { AdminDrawModal } from './AdminDrawModal';

export function AdminRaffleList({ raffles }: { raffles: any[] }) {
    const [isPending, startTransition] = useTransition();

    const handleClose = (raffleId: string) => {
        startTransition(async () => {
            const res = await closeRaffleAction(raffleId);
            if (res.success) {
                toast.success('Rifa fechada com sucesso.');
            } else {
                toast.error(res.error || 'Erro ao fechar rifa.');
            }
        });
    };

    if (raffles.length === 0) {
        return <p className="text-zinc-400">Nenhuma rifa cadastrada.</p>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-white/10 text-zinc-400 text-left">
                        <th className="py-3 pr-4">Título</th>
                        <th className="py-3 pr-4">Status</th>
                        <th className="py-3 pr-4">Progresso</th>
                        <th className="py-3 pr-4">Preço</th>
                        <th className="py-3">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    {raffles.map((raffle: any) => {
                        const sold = raffle.sold_count ?? 0;
                        const percent = raffle.total_numbers > 0
                            ? Math.round((sold / raffle.total_numbers) * 100)
                            : 0;

                        return (
                            <tr key={raffle.id} className="border-b border-white/5 hover:bg-white/5">
                                <td className="py-3 pr-4 font-medium">{raffle.title}</td>
                                <td className="py-3 pr-4">
                                    <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${
                                        raffle.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                        raffle.status === 'drawn' ? 'bg-yellow-500/20 text-yellow-400' :
                                        'bg-zinc-500/20 text-zinc-400'
                                    }`}>
                                        {raffle.status}
                                    </span>
                                </td>
                                <td className="py-3 pr-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-24 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary rounded-full"
                                                style={{ width: `${percent}%` }}
                                            />
                                        </div>
                                        <span className="text-zinc-400 text-xs">{sold}/{raffle.total_numbers}</span>
                                    </div>
                                </td>
                                <td className="py-3 pr-4 text-zinc-300">
                                    R$ {Number(raffle.price_per_ticket).toFixed(2)}
                                </td>
                                <td className="py-3">
                                    <div className="flex gap-2">
                                        {raffle.status === 'active' && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleClose(raffle.id)}
                                                disabled={isPending}
                                                className="text-xs h-7"
                                            >
                                                Fechar
                                            </Button>
                                        )}
                                        {raffle.status === 'closed' && (
                                            <AdminDrawModal raffleId={raffle.id} raffleTitle={raffle.title} />
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
```

- [ ] **Step 4: Criar `src/components/admin/AdminDrawModal.tsx` (placeholder — implementado na Task 11)**

```typescript
'use client';

// Implementado na Task 11
export function AdminDrawModal({ raffleId, raffleTitle }: { raffleId: string; raffleTitle: string }) {
    return (
        <button className="text-xs h-7 px-3 rounded border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10">
            Sortear
        </button>
    );
}
```

- [ ] **Step 5: Verificar build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
git add src/server/raffle-actions.ts src/app/adminromanovskins/page.tsx src/components/admin/AdminRaffleList.tsx src/components/admin/AdminDrawModal.tsx
git commit -m "feat: admin dashboard with real stats, raffle list, and close raffle action"
```

---

## Task 10: Loteria Federal lib + performDrawAction

**Files:**
- Create: `src/lib/loterias.ts`
- Modify: `src/server/raffle-actions.ts` (adicionar `performDrawAction`)

- [ ] **Step 1: Criar `src/lib/loterias.ts`**

```typescript
export interface LotoFederalResult {
    concurso: number;
    dataApuracao: string;
    primeiroPremio: string; // Número do bilhete vencedor (ex: "097680")
}

export async function getLatestLotoFederal(): Promise<LotoFederalResult> {
    // Tentativa 1: API comunitária com resposta previsível
    try {
        const res = await fetch('https://api.guidi.dev.br/loteria/federal/ultimo', {
            next: { revalidate: 0 },
            signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
            const data = await res.json();
            // Estrutura: { concurso, data, premios: [{ numero, valor }] }
            const primeiroPremio = data.premios?.[0]?.numero
                ?? data.listaDezenas?.[0]
                ?? data.listaPremios?.[0]?.numeroCerteSorte;
            if (primeiroPremio) {
                return {
                    concurso: data.concurso ?? data.numero,
                    dataApuracao: data.data ?? data.dataApuracao ?? '',
                    primeiroPremio: String(primeiroPremio).trim(),
                };
            }
        }
    } catch {
        // Fallback para API direta da Caixa
    }

    // Tentativa 2: API direta da Caixa
    const res2 = await fetch('https://servicebus2.caixa.gov.br/portaldeloterias/api/federal/', {
        next: { revalidate: 0 },
        headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(8000),
    });

    if (!res2.ok) {
        throw new Error(`Loteria Federal API error: ${res2.status}`);
    }

    const data2 = await res2.json();

    const primeiroPremio = data2.listaDezenas?.[0]
        ?? data2.listaPremios?.[0]?.numeroCerteSorte
        ?? data2.premios?.[0]?.numero;

    if (!primeiroPremio) {
        throw new Error('Não foi possível obter o 1º prêmio da Loteria Federal. Verifique o site da Caixa.');
    }

    return {
        concurso: data2.numero ?? 0,
        dataApuracao: data2.dataApuracao ?? '',
        primeiroPremio: String(primeiroPremio).trim(),
    };
}

/**
 * Calcula o número vencedor da rifa com base no bilhete da Loteria Federal.
 * Usa os 2 últimos dígitos do 1º prêmio.
 * 
 * Exemplo: 1º prêmio "097680", total_numbers=100
 * ultimos2 = 80
 * winner = (80 % 100) + 1 = 81
 */
export function calcularNumeroVencedor(primeiroPremio: string, totalNumbers: number): number {
    const digits = primeiroPremio.replace(/\D/g, '');
    const lastTwo = parseInt(digits.slice(-2), 10);
    return (lastTwo % totalNumbers) + 1;
}
```

- [ ] **Step 2: Adicionar import estático no TOPO de `src/server/raffle-actions.ts`**

Adicionar após os imports existentes (linha 8, após `import { cookies } from 'next/headers'`):

```typescript
import { getLatestLotoFederal, calcularNumeroVencedor } from '@/lib/loterias';
```

- [ ] **Step 3: Adicionar `performDrawAction` ao final de `src/server/raffle-actions.ts`**

```typescript
export async function performDrawAction(raffleId: string, manualPrimeiroPremio?: string) {
    const cookieStore = await cookies();
    const adminSession = cookieStore.get('admin_session')?.value;

    if (!adminSession) {
        return { success: false, error: 'Não autorizado.' };
    }

    const supabase = createAdminClient();

    // Verificar que a rifa está fechada
    const { data: raffle } = await supabase
        .from('raffles')
        .select('*')
        .eq('id', raffleId)
        .single();

    if (!raffle) return { success: false, error: 'Rifa não encontrada.' };
    if (raffle.status !== 'closed') return { success: false, error: 'A rifa precisa estar fechada para sortear.' };

    // Buscar todos os tickets vendidos
    const { data: soldTickets } = await supabase
        .from('tickets')
        .select('ticket_number, user_id')
        .eq('raffle_id', raffleId)
        .eq('status', 'sold');

    if (!soldTickets || soldTickets.length === 0) {
        return { success: false, error: 'Nenhuma cota vendida nesta rifa.' };
    }

    // Obter resultado da Loteria Federal (ou usar o manual)
    let lotoResult: { concurso: number; dataApuracao: string; primeiroPremio: string };
    if (manualPrimeiroPremio) {
        lotoResult = { concurso: 0, dataApuracao: '', primeiroPremio: manualPrimeiroPremio };
    } else {
        lotoResult = await getLatestLotoFederal();
    }

    let winnerTicketNumber = calcularNumeroVencedor(lotoResult.primeiroPremio, raffle.total_numbers);

    // Buscar o dono do ticket vencedor
    let winnerTicket = soldTickets.find(t => t.ticket_number === winnerTicketNumber);

    // Fallback: ticket não vendido → ticket vendido com número mais próximo
    if (!winnerTicket) {
        winnerTicket = soldTickets.reduce((closest, t) => {
            const diffT = Math.abs(t.ticket_number - winnerTicketNumber);
            const diffC = Math.abs(closest.ticket_number - winnerTicketNumber);
            return diffT < diffC ? t : closest;
        });
        winnerTicketNumber = winnerTicket.ticket_number;
    }

    // Atualizar a rifa com o resultado
    const { error: updateError } = await supabase
        .from('raffles')
        .update({
            status: 'drawn',
            drawn_at: new Date().toISOString(),
            winner_ticket_number: winnerTicketNumber,
            winner_user_id: winnerTicket.user_id,
        })
        .eq('id', raffleId);

    if (updateError) {
        console.error('Error performing draw:', updateError);
        return { success: false, error: 'Erro ao registrar sorteio.' };
    }

    revalidatePath('/adminromanovskins');
    revalidatePath('/');

    // Buscar nome do ganhador para exibir no modal
    const { data: winner } = await supabase
        .from('users')
        .select('name, whatsapp')
        .eq('id', winnerTicket.user_id)
        .single();

    return {
        success: true,
        winnerTicketNumber,
        winnerName: winner?.name ?? 'Desconhecido',
        winnerWhatsapp: winner?.whatsapp ?? '',
        concurso: lotoResult.concurso,
        primeiroPremio: lotoResult.primeiroPremio,
    };
}
```

- [ ] **Step 4: Verificar build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/loterias.ts src/server/raffle-actions.ts
git commit -m "feat: Loteria Federal lib and performDrawAction server action"
```

---

## Task 11: AdminDrawModal — UI completa do sorteio

**Files:**
- Modify: `src/components/admin/AdminDrawModal.tsx` (substituir o placeholder da Task 9)

- [ ] **Step 1: Substituir `src/components/admin/AdminDrawModal.tsx`**

```typescript
'use client';

import { useState, useTransition } from 'react';
import { performDrawAction } from '@/server/raffle-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Trophy, Loader2, X } from 'lucide-react';

interface DrawResult {
    winnerTicketNumber: number;
    winnerName: string;
    winnerWhatsapp: string;
    concurso: number;
    primeiroPremio: string;
}

export function AdminDrawModal({ raffleId, raffleTitle }: { raffleId: string; raffleTitle: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [manualPremio, setManualPremio] = useState('');
    const [useManual, setUseManual] = useState(false);
    const [result, setResult] = useState<DrawResult | null>(null);
    const [isPending, startTransition] = useTransition();

    const handleDraw = () => {
        startTransition(async () => {
            const res = await performDrawAction(
                raffleId,
                useManual && manualPremio ? manualPremio : undefined
            );

            if (res.success) {
                setResult({
                    winnerTicketNumber: res.winnerTicketNumber!,
                    winnerName: res.winnerName!,
                    winnerWhatsapp: res.winnerWhatsapp!,
                    concurso: res.concurso!,
                    primeiroPremio: res.primeiroPremio!,
                });
            } else {
                toast.error(res.error || 'Erro ao realizar sorteio.');
            }
        });
    };

    const handleClose = () => {
        setIsOpen(false);
        setResult(null);
        setManualPremio('');
        setUseManual(false);
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="text-xs h-7 px-3 rounded border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 transition-colors"
            >
                Sortear
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-yellow-400" />
                                Realizar Sorteio
                            </h2>
                            <button onClick={handleClose} className="text-zinc-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {!result ? (
                            <>
                                <p className="text-sm text-zinc-400 mb-4">
                                    Rifa: <span className="text-white font-medium">{raffleTitle}</span>
                                </p>

                                <div className="bg-zinc-800/50 rounded-lg p-4 mb-4 text-sm text-zinc-300">
                                    O número vencedor será determinado pelos <strong className="text-white">2 últimos dígitos do 1º prêmio</strong> da Loteria Federal mais recente.
                                    <br /><br />
                                    Fórmula: <code className="bg-zinc-700 px-1 rounded">(ultimos2 % total_cotas) + 1</code>
                                </div>

                                <div className="mb-4">
                                    <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer mb-3">
                                        <input
                                            type="checkbox"
                                            checked={useManual}
                                            onChange={e => setUseManual(e.target.checked)}
                                            className="rounded"
                                        />
                                        Inserir número do 1º prêmio manualmente
                                    </label>

                                    {useManual && (
                                        <Input
                                            value={manualPremio}
                                            onChange={e => setManualPremio(e.target.value)}
                                            placeholder="Ex: 097680"
                                            className="font-mono"
                                        />
                                    )}
                                    {!useManual && (
                                        <p className="text-xs text-zinc-500">
                                            O sistema buscará automaticamente o último resultado em api.guidi.dev.br/loteria
                                        </p>
                                    )}
                                </div>

                                <Button
                                    onClick={handleDraw}
                                    disabled={isPending || (useManual && !manualPremio)}
                                    className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold"
                                >
                                    {isPending ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sorteando...</>
                                    ) : 'Confirmar Sorteio'}
                                </Button>
                            </>
                        ) : (
                            <div className="text-center space-y-4">
                                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-6">
                                    <p className="text-zinc-400 text-sm mb-1">Número Vencedor</p>
                                    <p className="text-5xl font-black text-yellow-400 font-mono">
                                        #{result.winnerTicketNumber}
                                    </p>
                                </div>

                                <div className="text-left space-y-2 bg-zinc-800/50 rounded-lg p-4 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400">Ganhador</span>
                                        <span className="text-white font-medium">{result.winnerName}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400">WhatsApp</span>
                                        <span className="text-white font-mono">{result.winnerWhatsapp}</span>
                                    </div>
                                    {result.concurso > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-zinc-400">Concurso Federal</span>
                                            <span className="text-white">#{result.concurso}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400">1º Prêmio</span>
                                        <span className="text-white font-mono">{result.primeiroPremio}</span>
                                    </div>
                                </div>

                                <Button onClick={handleClose} className="w-full">
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

- [ ] **Step 2: Verificar build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminDrawModal.tsx
git commit -m "feat: admin draw modal with Loteria Federal integration and manual fallback"
```

---

## Task 12: CountdownTimer + integrar no checkout

**Files:**
- Create: `src/components/checkout/CountdownTimer.tsx`
- Modify: `src/components/checkout/CheckoutSummary.tsx`
- Modify: `src/app/checkout/[id]/page.tsx`

- [ ] **Step 1: Criar `src/components/checkout/CountdownTimer.tsx`**

```typescript
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
```

- [ ] **Step 2: Atualizar `src/app/checkout/[id]/page.tsx` para passar `expiresAt`**

Substituir o conteúdo completo:

```typescript
import { getRaffleDetails } from '@/server/raffle-actions';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { CheckoutSummary } from '@/components/checkout/CheckoutSummary';

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const raffle = await getRaffleDetails(id);

    if (!raffle) redirect('/');

    const supabase = await createClient();
    const cookieStore = await cookies();
    const userId = cookieStore.get('romanov_user')?.value;

    if (!userId) redirect('/login');

    const { data: tickets } = await supabase
        .from('tickets')
        .select('*')
        .eq('raffle_id', id)
        .eq('user_id', userId)
        .eq('status', 'reserved');

    if (!tickets || tickets.length === 0) {
        redirect(`/rifa/${id}`);
    }

    // Pegar expires_at do primeiro ticket (todos têm o mesmo)
    const expiresAt = tickets[0].expires_at ?? new Date(Date.now() + 20 * 60 * 1000).toISOString();

    return (
        <div className="container mx-auto p-4 min-h-screen relative z-10">
            <CheckoutSummary raffle={raffle} tickets={tickets} expiresAt={expiresAt} />
        </div>
    );
}
```

- [ ] **Step 3: Atualizar `src/components/checkout/CheckoutSummary.tsx` para usar o timer**

Substituir o conteúdo completo:

```typescript
'use client';

import { createCheckoutAction } from '@/server/payment-actions';
import { Button } from '@/components/ui/button';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { CountdownTimer } from './CountdownTimer';

export function CheckoutSummary({ raffle, tickets, expiresAt }: any) {
    const [isPending, startTransition] = useTransition();

    const handlePayment = () => {
        startTransition(async () => {
            const res = await createCheckoutAction(raffle.id);
            if (res.error) {
                toast.error(res.error);
            } else if (res.url) {
                window.location.href = res.url;
            }
        });
    };

    const total = tickets.length * raffle.price_per_ticket;

    return (
        <div className="max-w-md mx-auto mt-10">
            <h1 className="text-2xl font-bold mb-4 text-white">Resumo do Pedido</h1>

            <CountdownTimer expiresAt={expiresAt} raffleId={raffle.id} />

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-sm text-white">
                <div className="border-b border-zinc-800 pb-4 mb-4">
                    <h2 className="font-semibold text-lg">{raffle.title}</h2>
                    <p className="text-sm text-zinc-400">{raffle.description}</p>
                </div>

                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-zinc-500 uppercase">Cotas Reservadas</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {tickets.map((t: any) => (
                            <span key={t.id} className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-xs font-bold px-2 py-1 rounded">
                                {t.ticket_number}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="flex justify-between items-center text-lg font-bold mb-6">
                    <span>Total</span>
                    <span className="text-green-500">R$ {total.toFixed(2)}</span>
                </div>

                <Button
                    onClick={handlePayment}
                    disabled={isPending}
                    className="w-full h-12 text-lg font-bold uppercase tracking-wide"
                >
                    {isPending ? 'Gerando PIX...' : 'Pagar Agora (PIX)'}
                </Button>
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Verificar build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add src/components/checkout/CountdownTimer.tsx src/components/checkout/CheckoutSummary.tsx src/app/checkout/[id]/page.tsx
git commit -m "feat: countdown timer in checkout showing 20min reservation expiry"
```

---

## Task 13: Página Meus Tickets

**Files:**
- Create: `src/app/meus-tickets/page.tsx`
- Modify: `src/components/HeaderContent.tsx`

- [ ] **Step 1: Criar `src/app/meus-tickets/page.tsx`**

```typescript
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function MeusTicketsPage() {
    const cookieStore = await cookies();
    const userId = cookieStore.get('romanov_user')?.value;

    if (!userId) redirect('/login?next=/meus-tickets');

    const supabase = await createClient();

    const { data: transactions } = await supabase
        .from('transactions')
        .select(`
            id,
            amount,
            status,
            ticket_numbers,
            created_at,
            raffle:raffles ( id, title, image_url, status, winner_ticket_number, winner_user_id )
        `)
        .eq('user_id', userId)
        .eq('status', 'paid')
        .order('created_at', { ascending: false });

    return (
        <div className="container mx-auto p-4 max-w-4xl relative z-10 pb-20">
            <header className="mt-8 mb-10 text-center">
                <h1 className="text-4xl font-extrabold tracking-tight text-primary">Meus Tickets</h1>
                <p className="text-zinc-400 mt-2">Todas as suas cotas compradas</p>
            </header>

            {!transactions || transactions.length === 0 ? (
                <div className="text-center py-20 space-y-4">
                    <p className="text-zinc-400 text-lg">Você ainda não comprou nenhuma cota.</p>
                    <Link href="/">
                        <Button className="mt-4">Ver Rifas Disponíveis</Button>
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {transactions.map((tx: any) => {
                        const raffle = tx.raffle;
                        const isWinner = raffle?.winner_user_id === userId
                            && raffle?.status === 'drawn';
                        const isDrawn = raffle?.status === 'drawn';

                        return (
                            <div
                                key={tx.id}
                                className={`bg-zinc-900 border rounded-xl p-5 ${
                                    isWinner
                                        ? 'border-yellow-500/50 bg-yellow-500/5'
                                        : 'border-zinc-800'
                                }`}
                            >
                                <div className="flex gap-4">
                                    {raffle?.image_url && (
                                        <img
                                            src={raffle.image_url}
                                            alt={raffle.title}
                                            className="w-20 h-20 object-cover rounded-lg shrink-0"
                                        />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 flex-wrap">
                                            <h3 className="font-bold text-white truncate">
                                                {raffle?.title ?? 'Rifa'}
                                            </h3>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {isWinner && (
                                                    <span className="text-xs font-bold px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                                        🏆 VOCÊ GANHOU!
                                                    </span>
                                                )}
                                                <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${
                                                    raffle?.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                                    raffle?.status === 'drawn' ? 'bg-zinc-500/20 text-zinc-400' :
                                                    'bg-zinc-700/50 text-zinc-400'
                                                }`}>
                                                    {raffle?.status ?? 'desconhecido'}
                                                </span>
                                            </div>
                                        </div>

                                        <p className="text-xs text-zinc-500 mt-1">
                                            Comprado em {new Date(tx.created_at).toLocaleDateString('pt-BR', {
                                                day: '2-digit', month: '2-digit', year: 'numeric'
                                            })} • R$ {Number(tx.amount).toFixed(2)}
                                        </p>

                                        {isDrawn && (
                                            <p className="text-xs text-zinc-400 mt-1">
                                                Número vencedor:{' '}
                                                <span className="font-mono font-bold text-white">
                                                    #{raffle.winner_ticket_number}
                                                </span>
                                            </p>
                                        )}

                                        <div className="flex flex-wrap gap-1.5 mt-3">
                                            {(tx.ticket_numbers || []).map((num: number) => (
                                                <span
                                                    key={num}
                                                    className={`text-xs font-mono font-bold px-2 py-1 rounded border ${
                                                        isDrawn && num === raffle?.winner_ticket_number
                                                            ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                                                            : 'bg-white/5 text-zinc-300 border-zinc-700'
                                                    }`}
                                                >
                                                    #{num}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Adicionar link "Meus Tickets" em `src/components/HeaderContent.tsx`**

Localizar o bloco onde `user` está logado no desktop (linha 61-66 aprox.):

```typescript
{user ? (
    <div className="flex items-center gap-2 text-white">
        <span className="text-sm font-medium opacity-70">Olá,</span>
        <span className="font-bold">{user.whatsapp}</span>
    </div>
```

Substituir por:

```typescript
{user ? (
    <div className="flex items-center gap-4">
        <Link
            href="/meus-tickets"
            className="text-sm font-medium text-zinc-300 hover:text-white transition-colors"
        >
            Meus Tickets
        </Link>
        <div className="flex items-center gap-2 text-white">
            <span className="text-sm font-medium opacity-70">Olá,</span>
            <span className="font-bold">{user.whatsapp}</span>
        </div>
    </div>
```

Também adicionar o link no menu mobile (dentro do `isMenuOpen && user` block, após a linha com `user.whatsapp`):

```typescript
<Link
    href="/meus-tickets"
    className="text-base font-medium text-zinc-300 hover:text-white"
    onClick={() => setIsMenuOpen(false)}
>
    Meus Tickets
</Link>
```

- [ ] **Step 3: Verificar build**

```bash
npm run build 2>&1 | tail -20
```

Expected: Build bem-sucedido, 0 erros.

- [ ] **Step 4: Commit**

```bash
git add src/app/meus-tickets/page.tsx src/components/HeaderContent.tsx
git commit -m "feat: Meus Tickets page with purchase history and winner highlight"
```

---

## Task 14: Build final e deploy

**Files:**
- Verificação final antes do push para produção

- [ ] **Step 1: Build completo e limpo**

```bash
npm run build 2>&1
```

Expected: output com `✓ Compiled successfully` e nenhum erro de TypeScript ou build.

- [ ] **Step 2: Verificar variáveis de ambiente na Vercel**

No painel da Vercel (vercel.com/dashboard → seu projeto → Settings → Environment Variables), confirmar que todas estão presentes:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ABACATEPAY_API_TOKEN`
- `ABACATEPAY_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL` (deve ser a URL de produção, ex: `https://romanovrifas.vercel.app`)
- `User` (email do admin)
- `Password` (senha do admin)

- [ ] **Step 3: Push para produção**

```bash
git push origin master
```

Expected: Vercel detecta o push e inicia um novo deploy automaticamente.

- [ ] **Step 4: Testes manuais em produção**

Após o deploy completar no painel da Vercel:

**Teste 1 — Metadata:**
- Acessar a URL de produção
- Título da aba deve ser "Romanov Rifas | Skins de CS2"
- Compartilhar a URL no WhatsApp → verificar que o preview exibe título e descrição corretos

**Teste 2 — Cotas Restantes:**
- Criar uma rifa pelo admin com 10 cotas a R$ 1,00
- Na home, o card deve exibir "10 cotas restantes" (real, não mock)

**Teste 3 — Checkout Timer:**
- Fazer login, selecionar 1 cota, clicar "Reservar Agora"
- Na página de checkout, um timer de 20:00 deve aparecer e contar regressivamente

**Teste 4 — Comprovante:**
- Completar um pagamento via PIX (modo de teste do AbacatePay)
- A página de sucesso deve mostrar os dados reais da transação

**Teste 5 — Admin → Fechar → Sortear:**
- No admin, criar uma rifa, comprar uma cota
- Clicar "Fechar" → status muda para "closed"
- Clicar "Sortear" → modal abre → inserir número manual → vencedor é exibido

**Teste 6 — Meus Tickets:**
- Fazer login e acessar `/meus-tickets`
- Tickets comprados aparecem com raffle e números corretos

---

## Checklist de Spec Coverage

| Requisito da Spec | Task |
|---|---|
| Schema: drawn_at, winner_ticket_number, winner_user_id | Task 1 |
| Schema: float_value, wear_condition | Task 1 |
| pg_cron para reservas expiradas | Task 1 |
| getRecentWinners() com dados reais | Task 4 |
| getPastRaffles() com status 'drawn' | Task 4 |
| Transaction ID no returnUrl | Task 5 |
| Cotas Restantes — contagem real | Task 3 |
| Float/Condição — campos reais | Task 8 |
| Admin stats reais | Task 9 |
| Admin lista de rifas com ações | Task 9 |
| closeRaffleAction | Task 9 |
| Metadata do site / OG tags | Task 6 |
| Notificações toast (substituir alert) | Tasks 6, 7, 9 |
| Sorteio via Loteria Federal | Tasks 10, 11 |
| Admin draw modal | Task 11 |
| CountdownTimer no checkout | Task 12 |
| Barra de progresso (listagem) | Task 3 |
| Barra de progresso (detalhe) | Task 7 |
| Página Meus Tickets | Task 13 |
| Link Meus Tickets no Header | Task 13 |
