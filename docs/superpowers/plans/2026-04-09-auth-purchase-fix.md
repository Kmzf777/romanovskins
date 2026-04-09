# Auth + Purchase Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **FRONTEND NOTE:** Any task marked with 🎨 **MUST use the `frontend-design` skill** before writing UI code.

**Goal:** Replace the insecure cookie-based auth with Supabase Auth Email OTP, and fix the purchase flow so tickets correctly transition from `reserved` → `sold` after payment.

**Architecture:** Phase 1 migrates auth to Supabase Auth (Email OTP + `profiles` table). Phase 2 fixes `billingId` extraction in `payment-actions.ts` and adds a safety-net `/api/confirm-payment` endpoint. Each phase is independently deployable.

**Tech Stack:** Next.js 14 App Router, Supabase (Auth + DB), Supabase SSR, AbacatePay API, TypeScript

---

## File Map

### Phase 1 — Auth
| File | Action | Responsibility |
|------|--------|----------------|
| `src/middleware.ts` | CREATE | Protect routes; refresh Supabase session |
| `src/server/auth-actions.ts` | REWRITE | Supabase OTP send/verify, getCurrentUser, logout |
| `src/components/auth/LoginForm.tsx` | REWRITE 🎨 | Step 1: collect name + email + WhatsApp |
| `src/app/login/page.tsx` | MODIFY | Use new LoginForm |
| `src/app/login/verify/page.tsx` | CREATE 🎨 | Step 2: enter 6-digit OTP code |
| `src/server/raffle-actions.ts` | MODIFY | Replace cookie read with `getCurrentUser()` in `reserveTicketsAction` |
| `src/app/checkout/[id]/page.tsx` | MODIFY | Replace cookie read with `getCurrentUser()` |
| `src/app/meus-tickets/page.tsx` | MODIFY | Replace cookie read with `getCurrentUser()` |
| `src/lib/supabase/server.ts` | NO CHANGE | Already correct |

### Phase 2 — Purchase Fix
| File | Action | Responsibility |
|------|--------|----------------|
| `src/server/payment-actions.ts` | MODIFY | Fix billingId extraction; fail loudly if undefined |
| `src/app/api/webhooks/abacatepay/route.ts` | MODIFY | Add detailed logs; try multiple field paths for billingId |
| `src/app/api/confirm-payment/route.ts` | CREATE | Safety-net: query AbacatePay status + confirm locally |
| `src/app/checkout/success/page.tsx` | MODIFY 🎨 | Show real payment status; trigger confirm-payment if pending |

---

## Phase 1 — Auth Migration

---

### Task 1: Create Supabase `profiles` table (SQL migration)

**Files:**
- Create: `supabase/migrations/20260409_profiles.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260409_profiles.sql

-- 1. Create profiles table linked to auth.users
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  whatsapp text not null,
  created_at timestamptz default now() not null
);

-- 2. Enable RLS
alter table public.profiles enable row level security;

-- 3. Policies
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 4. Service role can do everything (for admin operations)
create policy "Service role full access"
  on public.profiles for all
  using (true)
  with check (true);
```

- [ ] **Step 2: Run migration in Supabase dashboard**

Go to Supabase Dashboard → SQL Editor → paste and run the migration above.

Verify with:
```sql
select * from public.profiles limit 1;
```
Expected: empty table, no error.

- [ ] **Step 3: Enable Email OTP in Supabase Auth settings**

Supabase Dashboard → Authentication → Providers → Email:
- Enable "Email OTP" (not magic link)
- Set OTP expiry to 600 seconds (10 min)
- Disable "Confirm email" requirement (OTP handles this)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260409_profiles.sql
git commit -m "feat: add profiles table for Supabase Auth migration"
```

---

### Task 2: Create Next.js middleware for session refresh

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create middleware**

```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — do NOT call getUser() outside of this block
  const { data: { user } } = await supabase.auth.getUser()

  const protectedRoutes = ['/checkout', '/meus-tickets']
  const isProtected = protectedRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  )

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)',
  ],
}
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add Next.js middleware for Supabase Auth session refresh"
```

---

### Task 3: Rewrite `auth-actions.ts` for Supabase OTP

**Files:**
- Modify: `src/server/auth-actions.ts`

- [ ] **Step 1: Replace the entire file**

```typescript
// src/server/auth-actions.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const loginSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  whatsapp: z.string().min(10, 'WhatsApp inválido'),
});

// Normalize WhatsApp: keep only digits
function normalizeWhatsApp(raw: string): string {
  return raw.replace(/\D/g, '');
}

// Step 1: Send OTP to email
export async function loginAction(prevState: any, formData: FormData) {
  const name = (formData.get('name') as string)?.trim();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const whatsapp = normalizeWhatsApp(formData.get('whatsapp') as string);
  const redirectTo = (formData.get('redirectTo') as string) || '/';

  const valid = loginSchema.safeParse({ name, email, whatsapp });
  if (!valid.success) {
    return { error: valid.error.errors[0].message };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  });

  if (error) {
    console.error('OTP send error:', error);
    return { error: 'Erro ao enviar código. Tente novamente.' };
  }

  // Store pending profile data in search params for verify step
  const params = new URLSearchParams({
    email,
    name,
    whatsapp,
    next: redirectTo,
  });

  redirect(`/login/verify?${params.toString()}`);
}

// Step 2: Verify OTP and create/update profile
export async function verifyOtpAction(prevState: any, formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const token = (formData.get('token') as string)?.trim();
  const name = (formData.get('name') as string)?.trim();
  const whatsapp = (formData.get('whatsapp') as string)?.trim();
  const next = (formData.get('next') as string) || '/';

  if (!email || !token || token.length !== 6) {
    return { error: 'Código inválido. Deve ter 6 dígitos.' };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });

  if (error) {
    console.error('OTP verify error:', error);
    return { error: 'Código inválido ou expirado. Solicite um novo.' };
  }

  // Upsert profile (create or update name/whatsapp)
  const { data: { user } } = await supabase.auth.getUser();
  if (user && name && whatsapp) {
    await supabase.from('profiles').upsert({
      id: user.id,
      name,
      whatsapp,
    });
  }

  redirect(next);
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  return {
    id: user.id,
    email: user.email ?? '',
    name: profile.name,
    whatsapp: profile.whatsapp,
    created_at: profile.created_at,
  };
}

// Admin login remains unchanged
const adminSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

export async function loginAdminAction(prevState: any, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const valid = adminSchema.safeParse({ email, password });
  if (!valid.success) {
    return { error: 'Dados inválidos.' };
  }

  if (email !== process.env.User || password !== process.env.Password) {
    return { error: 'Credenciais inválidas.' };
  }

  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  cookieStore.set('admin_session', 'true', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24,
    path: '/',
  });

  redirect('/adminromanovskins');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/auth-actions.ts
git commit -m "feat: rewrite auth-actions to use Supabase Auth Email OTP"
```

---

### Task 4: 🎨 Rewrite LoginForm (Step 1 — collect credentials)

> **REQUIRED:** Use `frontend-design` skill before writing this component.

**Files:**
- Modify: `src/components/auth/LoginForm.tsx`

- [ ] **Step 1: Invoke frontend-design skill, then implement**

The form collects: Nome completo, Email, WhatsApp (com DDD). Uses `loginAction`. On submit shows "Enviando código..." state. Matches the dark CS2-themed aesthetic of the site (dark bg, yellow accent `#F5C518`, mono font for inputs).

Hidden fields: `redirectTo` from `searchParams`.

```typescript
// src/components/auth/LoginForm.tsx
'use client';
import { useActionState } from 'react';
import { loginAction } from '@/server/auth-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Phone, User } from 'lucide-react';

const initialState = { error: '' };

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="redirectTo" value={redirectTo || '/'} />

      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-sm font-medium" style={{ color: '#7A7A8A' }}>
          <User size={14} className="inline mr-1.5" />Nome Completo
        </Label>
        <Input
          id="name"
          name="name"
          placeholder="Seu nome completo"
          required
          disabled={isPending}
          className="h-12 rounded-xl border-[#2A2A32] bg-[#111114] text-[#F0EAD6] placeholder:text-[#4A4A5A] focus:border-[#F5C518] focus:ring-[#F5C518]/20"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-sm font-medium" style={{ color: '#7A7A8A' }}>
          <Mail size={14} className="inline mr-1.5" />Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="seu@email.com"
          required
          disabled={isPending}
          className="h-12 rounded-xl border-[#2A2A32] bg-[#111114] text-[#F0EAD6] placeholder:text-[#4A4A5A] focus:border-[#F5C518] focus:ring-[#F5C518]/20"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="whatsapp" className="text-sm font-medium" style={{ color: '#7A7A8A' }}>
          <Phone size={14} className="inline mr-1.5" />WhatsApp (com DDD)
        </Label>
        <Input
          id="whatsapp"
          name="whatsapp"
          type="tel"
          placeholder="11999999999"
          required
          disabled={isPending}
          className="h-12 rounded-xl border-[#2A2A32] bg-[#111114] text-[#F0EAD6] placeholder:text-[#4A4A5A] focus:border-[#F5C518] focus:ring-[#F5C518]/20"
        />
      </div>

      {state?.error && (
        <p className="text-sm font-medium px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="w-full h-12 text-base font-black uppercase tracking-wider rounded-xl transition-all"
        style={{
          backgroundColor: isPending ? '#2A2A32' : '#F5C518',
          color: isPending ? '#7A7A8A' : '#0A0A0B',
        }}
      >
        {isPending ? 'Enviando código...' : 'Receber Código'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Update `src/app/login/page.tsx`**

```typescript
// src/app/login/page.tsx
import { LoginForm } from '@/components/auth/LoginForm';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative z-10">
      <div
        className="w-full max-w-md p-8 rounded-2xl"
        style={{
          backgroundColor: 'rgba(17,17,20,0.95)',
          border: '1px solid #2A2A32',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="mb-8">
          <h1
            className="text-4xl font-black uppercase"
            style={{ fontFamily: 'var(--font-bebas-neue)', color: '#F0EAD6' }}
          >
            Entrar
          </h1>
          <p className="mt-1 text-sm" style={{ color: '#7A7A8A' }}>
            Insira seus dados para receber o código de acesso.
          </p>
        </div>
        <LoginForm redirectTo={next} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/LoginForm.tsx src/app/login/page.tsx
git commit -m "feat: update LoginForm for Supabase OTP step 1 (collect credentials)"
```

---

### Task 5: 🎨 Create OTP verification page (`/login/verify`)

> **REQUIRED:** Use `frontend-design` skill before writing this component.

**Files:**
- Create: `src/app/login/verify/page.tsx`
- Create: `src/components/auth/VerifyOtpForm.tsx`

- [ ] **Step 1: Create VerifyOtpForm component**

Dark CS2 theme. Shows the email the code was sent to. Single 6-digit input. "Reenviar código" link. Uses `verifyOtpAction`.

```typescript
// src/components/auth/VerifyOtpForm.tsx
'use client';
import { useActionState } from 'react';
import { verifyOtpAction } from '@/server/auth-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldCheck } from 'lucide-react';

const initialState = { error: '' };

interface Props {
  email: string;
  name: string;
  whatsapp: string;
  next: string;
}

export function VerifyOtpForm({ email, name, whatsapp, next }: Props) {
  const [state, formAction, isPending] = useActionState(verifyOtpAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="whatsapp" value={whatsapp} />
      <input type="hidden" name="next" value={next} />

      <div className="space-y-1.5">
        <label
          htmlFor="token"
          className="block text-sm font-medium"
          style={{ color: '#7A7A8A' }}
        >
          Código de 6 dígitos
        </label>
        <Input
          id="token"
          name="token"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="000000"
          required
          disabled={isPending}
          autoFocus
          className="h-14 text-center text-2xl tracking-[0.5em] font-mono rounded-xl border-[#2A2A32] bg-[#111114] text-[#F5C518] placeholder:text-[#4A4A5A] focus:border-[#F5C518] focus:ring-[#F5C518]/20"
        />
      </div>

      {state?.error && (
        <p className="text-sm font-medium px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="w-full h-12 text-base font-black uppercase tracking-wider rounded-xl transition-all"
        style={{
          backgroundColor: isPending ? '#2A2A32' : '#F5C518',
          color: isPending ? '#7A7A8A' : '#0A0A0B',
        }}
      >
        <ShieldCheck size={18} className="mr-2" />
        {isPending ? 'Verificando...' : 'Confirmar Código'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Create verify page**

```typescript
// src/app/login/verify/page.tsx
import { VerifyOtpForm } from '@/components/auth/VerifyOtpForm';
import { redirect } from 'next/navigation';

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; name?: string; whatsapp?: string; next?: string }>;
}) {
  const { email, name, whatsapp, next } = await searchParams;

  if (!email || !name || !whatsapp) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative z-10">
      <div
        className="w-full max-w-md p-8 rounded-2xl"
        style={{
          backgroundColor: 'rgba(17,17,20,0.95)',
          border: '1px solid #2A2A32',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="mb-8">
          <h1
            className="text-4xl font-black uppercase"
            style={{ fontFamily: 'var(--font-bebas-neue)', color: '#F0EAD6' }}
          >
            Verificar Email
          </h1>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: '#7A7A8A' }}>
            Enviamos um código de 6 dígitos para{' '}
            <span className="font-semibold" style={{ color: '#F0EAD6' }}>{email}</span>.
            Verifique sua caixa de entrada.
          </p>
        </div>
        <VerifyOtpForm
          email={email}
          name={name}
          whatsapp={whatsapp}
          next={next || '/'}
        />
        <p className="mt-6 text-center text-xs" style={{ color: '#4A4A5A' }}>
          Não recebeu?{' '}
          <a href="/login" className="underline" style={{ color: '#7A7A8A' }}>
            Solicitar novo código
          </a>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/VerifyOtpForm.tsx src/app/login/verify/page.tsx
git commit -m "feat: add OTP verification page for Supabase Auth step 2"
```

---

### Task 6: Update all files that read `romanov_user` cookie directly

**Files:**
- Modify: `src/server/raffle-actions.ts:268-271`
- Modify: `src/app/checkout/[id]/page.tsx:14-17`
- Modify: `src/app/meus-tickets/page.tsx:10-12`
- Modify: `src/server/payment-actions.ts:10-13`

- [ ] **Step 1: Fix `reserveTicketsAction` in `raffle-actions.ts`**

Replace lines 268-271:
```typescript
// OLD (remove this):
const cookieStore = await cookies();
const userId = cookieStore.get('romanov_user')?.value;
if (!userId) {
  return { success: false, error: 'Usuário não autenticado' };
}
```

With:
```typescript
// NEW:
const { getCurrentUser } = await import('@/server/auth-actions');
const user = await getCurrentUser();
if (!user) {
  return { success: false, error: 'Usuário não autenticado' };
}
const userId = user.id;
```

Also remove the `cookies` import from the top of `raffle-actions.ts` if it's no longer used elsewhere in the file.

- [ ] **Step 2: Fix `src/app/checkout/[id]/page.tsx`**

Replace:
```typescript
const cookieStore = await cookies();
const userId = cookieStore.get('romanov_user')?.value;

if (!userId) redirect('/login');
```

With:
```typescript
import { getCurrentUser } from '@/server/auth-actions';
// ...
const user = await getCurrentUser();
if (!user) redirect('/login?next=/checkout/' + id);
const userId = user.id;
```

Full updated file:
```typescript
// src/app/checkout/[id]/page.tsx
import { getRaffleDetails } from '@/server/raffle-actions';
import { getCurrentUser } from '@/server/auth-actions';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CheckoutSummary } from '@/components/checkout/CheckoutSummary';

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raffle = await getRaffleDetails(id);
  if (!raffle) redirect('/');

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/checkout/${id}`);

  const supabase = await createClient();
  const { data: tickets } = await supabase
    .from('tickets')
    .select('*')
    .eq('raffle_id', id)
    .eq('user_id', user.id)
    .eq('status', 'reserved');

  if (!tickets || tickets.length === 0) {
    redirect(`/rifa/${id}`);
  }

  const expiresAt = tickets[0].expires_at ?? new Date(Date.now() + 20 * 60 * 1000).toISOString();

  return (
    <div className="container mx-auto p-4 min-h-screen relative z-10">
      <CheckoutSummary raffle={raffle} tickets={tickets} expiresAt={expiresAt} />
    </div>
  );
}
```

- [ ] **Step 3: Fix `src/app/meus-tickets/page.tsx`**

Replace the auth check at the top:
```typescript
// OLD (remove):
const cookieStore = await cookies();
const userId = cookieStore.get('romanov_user')?.value;
if (!userId) redirect('/login?next=/meus-tickets');
```

With:
```typescript
import { getCurrentUser } from '@/server/auth-actions';
// ...
const user = await getCurrentUser();
if (!user) redirect('/login?next=/meus-tickets');
const userId = user.id;
```

Also remove the `cookies` and `createClient` imports from the top and replace with:
```typescript
import { getCurrentUser } from '@/server/auth-actions';
import { createClient } from '@/lib/supabase/server';
```

- [ ] **Step 4: Fix `src/server/payment-actions.ts`**

Replace lines 10-13:
```typescript
// OLD (remove):
const cookieStore = await cookies();
const userId = cookieStore.get('romanov_user')?.value;
if (!userId) {
  return { error: 'Usuário não autenticado' };
}
const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
if (!user) return { error: 'Usuário não encontrado' };
```

With:
```typescript
const { getCurrentUser } = await import('@/server/auth-actions');
const currentUser = await getCurrentUser();
if (!currentUser) return { error: 'Usuário não autenticado' };
const userId = currentUser.id;
const user = currentUser; // already has name and whatsapp
```

Also update the reference to `user.whatsapp` and `user.name` — they are now `currentUser.whatsapp` and `currentUser.name`. These field names match the `profiles` table, so no further changes needed.

- [ ] **Step 5: Remove `cookies` import from files that no longer need it**

In `raffle-actions.ts`, remove:
```typescript
import { cookies } from 'next/headers';
```
Only if `cookies` is no longer used anywhere else in the file. (It's only used in `reserveTicketsAction` and `performDrawAction` — check `performDrawAction` uses `admin_session` cookie, so keep the import.)

- [ ] **Step 6: Commit**

```bash
git add src/server/raffle-actions.ts src/app/checkout/[id]/page.tsx src/app/meus-tickets/page.tsx src/server/payment-actions.ts
git commit -m "feat: replace romanov_user cookie reads with getCurrentUser() across all pages"
```

---

### Task 7: Update Header logout button

**Files:**
- Modify: `src/components/HeaderContent.tsx`

- [ ] **Step 1: Read the current HeaderContent**

Check current logout call — it likely calls `logoutAction`. The signature of `logoutAction` is unchanged (still a server action with `redirect`), so no change needed unless the component reads the old `user.id` shape.

Verify that `user.id`, `user.name` fields used in `HeaderContent.tsx` match the shape returned by the new `getCurrentUser()`:
```typescript
{ id: string, email: string, name: string, whatsapp: string, created_at: string }
```

If `HeaderContent` references `user.whatsapp` for display, it will still work.

- [ ] **Step 2: Commit if changes needed, or note no changes required**

```bash
git add src/components/HeaderContent.tsx
git commit -m "fix: update HeaderContent for new getCurrentUser shape" 
# Only run this if changes were actually needed
```

---

## Phase 2 — Purchase Flow Fix

---

### Task 8: Fix `billingId` extraction in `payment-actions.ts`

**Files:**
- Modify: `src/server/payment-actions.ts`

- [ ] **Step 1: Replace the billingId extraction block**

Find and replace lines 79-86 (the block after the AbacatePay response):

```typescript
// OLD (remove):
const billingData = response.data.data || response.data;
const billingId = billingData.id || billingData.billing?.id;
const billingUrl = billingData.url || billingData.billing?.url || billingData.payment_url;

if (!billingUrl) {
  console.error('❌ No billing URL in response:', response.data);
  return { error: 'Erro ao obter link de pagamento. Tente novamente.' };
}
```

With:
```typescript
// NEW: Log full response for diagnosis, then extract defensively
console.log('📥 AbacatePay full response:', JSON.stringify(response.data, null, 2));

const billingData = response.data?.data ?? response.data;

// Try all known field paths for billing ID
const billingId: string | undefined =
  billingData?.id ??
  billingData?.billing?.id ??
  billingData?.billingId ??
  response.data?.id;

// Try all known field paths for payment URL
const billingUrl: string | undefined =
  billingData?.url ??
  billingData?.billing?.url ??
  billingData?.payment_url ??
  billingData?.checkoutUrl;

if (!billingId) {
  console.error('❌ Could not extract billingId from response:', JSON.stringify(response.data, null, 2));
  return { error: 'Erro ao processar resposta do pagamento. Contate o suporte.' };
}

if (!billingUrl) {
  console.error('❌ No billing URL in response:', JSON.stringify(response.data, null, 2));
  return { error: 'Erro ao obter link de pagamento. Tente novamente.' };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/payment-actions.ts
git commit -m "fix: defensive billingId extraction from AbacatePay response, fail loudly if missing"
```

---

### Task 9: Add detailed logging to webhook + robust lookup

**Files:**
- Modify: `src/app/api/webhooks/abacatepay/route.ts`

- [ ] **Step 1: Replace the POST handler with improved version**

```typescript
// src/app/api/webhooks/abacatepay/route.ts
import { createAdminClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

function verifyWebhookSignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret || secret === 'whsec_...') {
    console.warn('⚠️ Webhook signature verification skipped - configure ABACATEPAY_WEBHOOK_SECRET');
    return true;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

async function confirmPayment(supabase: ReturnType<typeof createAdminClient>, billingId: string) {
  console.log('🔍 Looking up transaction for billingId:', billingId);

  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .eq('external_id', billingId)
    .maybeSingle();

  if (txError) {
    console.error('❌ Transaction lookup error:', txError);
    return { error: 'Transaction lookup error' };
  }

  if (!transaction) {
    console.error('❌ No transaction found with external_id:', billingId);
    // Log all recent transactions to help diagnose
    const { data: recent } = await supabase
      .from('transactions')
      .select('id, external_id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    console.log('📋 Recent transactions:', JSON.stringify(recent, null, 2));
    return { error: 'Transaction not found' };
  }

  if (transaction.status === 'paid') {
    console.log('ℹ️ Transaction already paid, skipping:', transaction.id);
    return { ok: true };
  }

  console.log('✅ Found transaction:', transaction.id, '| tickets:', transaction.ticket_numbers);

  const { error: updateTxError } = await supabase
    .from('transactions')
    .update({ status: 'paid' })
    .eq('id', transaction.id);

  if (updateTxError) {
    console.error('❌ Error updating transaction:', updateTxError);
    return { error: 'Failed to update transaction' };
  }

  const { data: updatedTickets, error: updateTicketsError } = await supabase
    .from('tickets')
    .update({ status: 'sold', expires_at: null })
    .eq('raffle_id', transaction.raffle_id)
    .in('ticket_number', transaction.ticket_numbers)
    .select('ticket_number, status');

  if (updateTicketsError) {
    console.error('❌ Error updating tickets:', updateTicketsError);
    return { error: 'Failed to update tickets' };
  }

  console.log('✅ Updated tickets to sold:', updatedTickets?.map(t => t.ticket_number));
  return { ok: true };
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const headerPayload = await headers();
  const signature = headerPayload.get('x-webhook-signature') || headerPayload.get('abacatepay-signature');

  const webhookSecret = process.env.ABACATEPAY_WEBHOOK_SECRET || '';
  if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    console.error('❌ Invalid webhook signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch (e) {
    console.error('❌ Failed to parse webhook body:', e);
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = body.event;
  console.log('📥 Webhook event:', event);
  console.log('📥 Webhook body:', JSON.stringify(body, null, 2));

  if (event === 'billing.paid' || event === 'BILLING_PAID') {
    const data = body.data ?? body;
    // Try all known field paths for billing ID
    const billingId: string =
      data?.id ??
      data?.billing?.id ??
      data?.billingId ??
      body?.id;

    if (!billingId) {
      console.error('❌ Could not extract billingId from webhook body:', JSON.stringify(body, null, 2));
      return NextResponse.json({ error: 'Missing billing ID' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const result = await confirmPayment(supabase, billingId);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.error === 'Transaction not found' ? 404 : 500 });
    }
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/webhooks/abacatepay/route.ts
git commit -m "fix: robust billingId extraction in webhook + detailed logs for diagnosis"
```

---

### Task 10: Create `/api/confirm-payment` safety-net endpoint

**Files:**
- Create: `src/app/api/confirm-payment/route.ts`

- [ ] **Step 1: Create the endpoint**

This endpoint is called by the success page when `transaction.status === 'pending'`. It queries AbacatePay directly to confirm payment status and, if paid, updates the DB.

```typescript
// src/app/api/confirm-payment/route.ts
import { createAdminClient } from '@/lib/supabase/server';
import { abacatePay } from '@/lib/abacatepay';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tid = searchParams.get('tid');

  if (!tid) {
    return NextResponse.json({ error: 'Missing tid' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', tid)
    .maybeSingle();

  if (txError || !transaction) {
    return NextResponse.json({ status: 'not_found' }, { status: 404 });
  }

  // Already paid — nothing to do
  if (transaction.status === 'paid') {
    return NextResponse.json({ status: 'paid' });
  }

  // Transaction has no external_id or it's 'unknown' — can't query AbacatePay
  if (!transaction.external_id || transaction.external_id === 'unknown') {
    console.error('⚠️ Transaction has no valid external_id:', transaction.id);
    return NextResponse.json({ status: 'pending' });
  }

  // Query AbacatePay for current billing status
  try {
    const response = await abacatePay.get(`/billing/${transaction.external_id}`);
    const billingData = response.data?.data ?? response.data;
    const billingStatus: string = billingData?.status ?? billingData?.billing?.status ?? '';

    console.log('📥 AbacatePay billing status for', transaction.external_id, ':', billingStatus);

    if (billingStatus.toUpperCase() === 'PAID' || billingStatus === 'paid') {
      // Update transaction
      await supabase
        .from('transactions')
        .update({ status: 'paid' })
        .eq('id', transaction.id);

      // Update tickets
      const { data: updatedTickets, error: ticketErr } = await supabase
        .from('tickets')
        .update({ status: 'sold', expires_at: null })
        .eq('raffle_id', transaction.raffle_id)
        .in('ticket_number', transaction.ticket_numbers)
        .select('ticket_number');

      if (ticketErr) {
        console.error('❌ Error updating tickets in confirm-payment:', ticketErr);
      } else {
        console.log('✅ confirm-payment: tickets sold:', updatedTickets?.map(t => t.ticket_number));
      }

      return NextResponse.json({ status: 'paid' });
    }

    return NextResponse.json({ status: 'pending' });
  } catch (e: any) {
    console.error('❌ Error querying AbacatePay in confirm-payment:', e.response?.data || e.message);
    return NextResponse.json({ status: 'pending' });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/confirm-payment/route.ts
git commit -m "feat: add /api/confirm-payment safety-net endpoint for failed webhooks"
```

---

### Task 11: 🎨 Update checkout success page to show real payment status

> **REQUIRED:** Use `frontend-design` skill before writing this component.

**Files:**
- Modify: `src/app/checkout/success/page.tsx`

- [ ] **Step 1: Update the page to check real payment status**

The page must:
1. Load the transaction as before
2. If `transaction.status === 'pending'`, call `/api/confirm-payment?tid=...` on the server side during render
3. Re-fetch transaction after confirmation attempt
4. Show "Confirmado ✅" or "Aguardando confirmação ⏳" clearly

```typescript
// src/app/checkout/success/page.tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, Hash, Calendar, Ticket, CreditCard, AlertCircle } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ tid?: string }>;
}) {
  const { tid } = await searchParams;
  const supabase = createAdminClient();

  let transaction: any = null;
  let raffle: any = null;

  if (tid) {
    const { data: transData } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', tid)
      .single();

    if (transData) {
      // If still pending, attempt to confirm via safety-net
      if (transData.status === 'pending') {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://romanovdasrifas.vercel.app';
        try {
          await fetch(`${appUrl}/api/confirm-payment?tid=${tid}`, { cache: 'no-store' });
          // Re-fetch transaction after confirmation attempt
          const { data: refreshed } = await supabase
            .from('transactions')
            .select('*')
            .eq('id', tid)
            .single();
          transaction = refreshed ?? transData;
        } catch {
          transaction = transData;
        }
      } else {
        transaction = transData;
      }

      const { data: raffleData } = await supabase
        .from('raffles')
        .select('*')
        .eq('id', transaction.raffle_id)
        .single();
      raffle = raffleData;
    }
  }

  const isPaid = transaction?.status === 'paid';

  return (
    <div className="container mx-auto p-4 min-h-screen relative z-10 flex flex-col items-center justify-center">
      <div
        className="bg-black/40 backdrop-blur-md border border-white/10 p-8 rounded-2xl shadow-xl max-w-lg w-full"
      >
        <div className="flex justify-center mb-6">
          <div className={`p-4 rounded-full ${isPaid ? 'bg-green-500/20' : 'bg-yellow-500/10'}`}>
            {isPaid
              ? <CheckCircle className="w-16 h-16 text-green-500" />
              : <Clock className="w-16 h-16 text-yellow-500" />
            }
          </div>
        </div>

        <div className="text-center mb-8">
          <h1
            className="text-3xl font-bold text-white mb-2"
            style={{ fontFamily: 'var(--font-bebas-neue)' }}
          >
            {isPaid ? 'COMPROVANTE DE COMPRA' : 'AGUARDANDO PAGAMENTO'}
          </h1>
          <p className="text-zinc-400 text-sm">
            {isPaid
              ? 'Pagamento confirmado. Suas cotas estão garantidas!'
              : 'Seu pagamento ainda está sendo processado. Aguarde alguns instantes.'}
          </p>
        </div>

        {transaction && raffle ? (
          <div className="bg-zinc-900/60 rounded-xl p-6 border border-white/5 space-y-4 mb-8">
            {/* Payment Status Badge */}
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <span className="text-zinc-500 text-sm">Status</span>
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                  isPaid
                    ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                    : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                }`}
              >
                {isPaid ? 'Confirmado' : 'Pendente'}
              </span>
            </div>

            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <span className="text-zinc-500 text-sm flex items-center gap-2">
                <Hash className="w-4 h-4" /> ID da Transação
              </span>
              <span className="text-zinc-300 font-mono text-xs">{transaction.id}</span>
            </div>

            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <span className="text-zinc-500 text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Data
              </span>
              <span className="text-white text-sm">
                {new Date(transaction.created_at).toLocaleDateString('pt-BR', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>

            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <span className="text-zinc-500 text-sm flex items-center gap-2">
                <Ticket className="w-4 h-4" /> Rifa
              </span>
              <span className="text-white text-sm font-semibold truncate max-w-[150px]">
                {raffle.title}
              </span>
            </div>

            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <span className="text-zinc-500 text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Valor Total
              </span>
              <span className="text-green-500 font-bold">
                R$ {transaction.amount.toFixed(2)}
              </span>
            </div>

            <div className="pt-2">
              <span className="text-zinc-500 text-sm block mb-2">Números da Sorte</span>
              <div className="flex flex-wrap gap-2">
                {transaction.ticket_numbers?.map((num: number) => (
                  <span
                    key={num}
                    className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-xs font-mono font-bold px-2 py-1 rounded"
                  >
                    {num}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center p-4 bg-red-500/10 rounded mb-6 flex items-center gap-2 justify-center">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <p className="text-red-400 text-sm">Detalhes da transação não disponíveis.</p>
          </div>
        )}

        <div className="space-y-4 text-zinc-400 text-center mb-8 text-sm">
          <p>
            Informaremos o ganhador no grupo do WhatsApp assim que sair o sorteio.
          </p>
        </div>

        <Link href="/">
          <Button
            className="w-full h-12 text-lg font-bold rounded-xl"
            style={{ backgroundColor: '#F5C518', color: '#0A0A0B' }}
          >
            Voltar para o Início
          </Button>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/checkout/success/page.tsx
git commit -m "feat: success page shows real payment status and auto-confirms pending transactions"
```

---

### Task 12: End-to-end verification

- [ ] **Step 1: Run the dev server and test auth flow**

```bash
npm run dev
```

1. Navigate to `http://localhost:3000/login`
2. Enter name, email, WhatsApp → click "Receber Código"
3. Check email for 6-digit code
4. Enter code on `/login/verify` page
5. Verify redirect to home or `next` destination
6. Check Supabase Dashboard → Authentication → Users — new user should appear
7. Check Supabase Dashboard → Table Editor → `profiles` — profile row should exist

- [ ] **Step 2: Test purchase flow**

1. Select tickets on a raffle → Reservar Agora → checkout
2. Pay via PIX
3. After payment, check `/checkout/success?tid=...`
4. Verify transaction status is `paid` in Supabase
5. Verify tickets show `sold` in the `tickets` table

- [ ] **Step 3: Test webhook manually (if needed)**

If tickets are still `reserved` after payment, check Vercel logs for webhook errors. Use the AbacatePay dashboard to see if webhook delivery shows errors.

You can also test the safety-net manually:
```bash
curl "https://romanovdasrifas.vercel.app/api/confirm-payment?tid=<transaction-id>"
```
Expected: `{"status":"paid"}` if payment was confirmed.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final verification pass - auth and purchase flow complete"
```
