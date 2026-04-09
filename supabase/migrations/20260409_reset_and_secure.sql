-- =============================================================
-- RESET COMPLETO + SCHEMA SEGURO
-- Execute no SQL Editor do Supabase Dashboard
-- =============================================================

-- 1. DROP TUDO (ordem importa por causa dos FKs)
drop table if exists public.draw_sessions cascade;
drop table if exists public.transactions cascade;
drop table if exists public.tickets cascade;
drop table if exists public.raffles cascade;
drop table if exists public.users cascade;
drop table if exists public.profiles cascade;

-- Remove trigger antigo se existir
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- =============================================================
-- 2. CRIAR TABELAS
-- =============================================================

-- USERS (perfil do usuário, vinculado ao auth.users)
create table public.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  whatsapp   text not null,
  created_at timestamptz default now() not null
);

-- RAFFLES
create table public.raffles (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  description         text,
  image_url           text not null,
  price_per_ticket    numeric(10,2) not null,
  total_numbers       integer not null,
  status              text not null default 'active' check (status in ('active','closed','drawn')),
  featured            boolean not null default false,
  original_price      numeric(10,2),
  float_value         text,
  wear_condition      text,
  drawn_at            timestamptz,
  winner_ticket_number integer,
  winner_user_id      uuid references public.users(id) on delete set null,
  created_at          timestamptz default now() not null
);

-- TICKETS
create table public.tickets (
  id            bigserial primary key,
  raffle_id     uuid not null references public.raffles(id) on delete cascade,
  ticket_number integer not null,
  status        text not null default 'available' check (status in ('available','reserved','sold')),
  user_id       uuid references public.users(id) on delete set null,
  reserved_at   timestamptz,
  expires_at    timestamptz,
  unique (raffle_id, ticket_number)
);

-- TRANSACTIONS
create table public.transactions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  raffle_id      uuid not null references public.raffles(id) on delete cascade,
  external_id    text,
  amount         numeric(10,2) not null,
  status         text not null default 'pending' check (status in ('pending','paid','failed')),
  ticket_numbers integer[] not null default '{}',
  created_at     timestamptz default now() not null
);

-- DRAW_SESSIONS
create table public.draw_sessions (
  id                   uuid primary key default gen_random_uuid(),
  raffle_id            uuid not null references public.raffles(id) on delete cascade,
  draw_at              timestamptz not null,
  countdown_minutes    integer not null default 0,
  target_concurso      integer,
  status               text not null default 'waiting' check (status in ('waiting','drawing','drawn')),
  winner_ticket_number integer,
  winner_name          text,
  concurso             integer,
  primeiro_premio      text,
  created_at           timestamptz default now() not null
);

-- =============================================================
-- 3. ÍNDICES para performance
-- =============================================================
create index idx_tickets_raffle_id on public.tickets(raffle_id);
create index idx_tickets_status on public.tickets(status);
create index idx_tickets_user_id on public.tickets(user_id);
create index idx_transactions_user_id on public.transactions(user_id);
create index idx_transactions_external_id on public.transactions(external_id);
create index idx_raffles_status on public.raffles(status);
create index idx_draw_sessions_raffle_id on public.draw_sessions(raffle_id);
create index idx_draw_sessions_status on public.draw_sessions(status);

-- =============================================================
-- 4. FUNÇÃO RPC — contagem de tickets por rifa
-- =============================================================
create or replace function public.get_raffle_ticket_counts(raffle_ids uuid[])
returns table(raffle_id uuid, available_count bigint, sold_count bigint)
language sql stable as $$
  select
    t.raffle_id,
    count(*) filter (where t.status = 'available') as available_count,
    count(*) filter (where t.status = 'sold') as sold_count
  from public.tickets t
  where t.raffle_id = any(raffle_ids)
  group by t.raffle_id;
$$;

-- =============================================================
-- 5. TRIGGER — cria perfil automaticamente ao registrar
-- =============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Só cria se vier com metadata (registro completo via app)
  -- Caso contrário o registerAction cria via service role
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================================
-- 6. HABILITAR RLS EM TODAS AS TABELAS
-- =============================================================
alter table public.users         enable row level security;
alter table public.raffles        enable row level security;
alter table public.tickets        enable row level security;
alter table public.transactions   enable row level security;
alter table public.draw_sessions  enable row level security;

-- =============================================================
-- 7. POLÍTICAS RLS
-- =============================================================

-- ── USERS ──
-- Usuário lê apenas o próprio perfil
create policy "users: select own"
  on public.users for select
  using (auth.uid() = id);

-- Service role faz tudo (bypassa RLS automaticamente via service_role key)
-- Nenhuma escrita permitida para authenticated/anon — apenas service role

-- ── RAFFLES ──
-- Qualquer um pode ler rifas (necessário para exibir no site)
create policy "raffles: public select"
  on public.raffles for select
  using (true);

-- ── TICKETS ──
-- Qualquer um pode ler tickets (para exibir disponibilidade)
create policy "tickets: public select"
  on public.tickets for select
  using (true);

-- ── TRANSACTIONS ──
-- Usuário autenticado lê apenas as próprias transações
create policy "transactions: select own"
  on public.transactions for select
  using (auth.uid() = user_id);

-- ── DRAW_SESSIONS ──
-- Qualquer um pode ler sessões de sorteio (para o live draw)
create policy "draw_sessions: public select"
  on public.draw_sessions for select
  using (true);

-- NOTA: Todas as escritas (INSERT/UPDATE/DELETE) são feitas pelo
-- service role key no servidor, que bypassa RLS automaticamente.
-- Nenhuma escrita direta pelo client é permitida.

-- =============================================================
-- 8. REVOGAR permissões diretas da anon role em tabelas sensíveis
-- =============================================================
revoke insert, update, delete on public.users from anon, authenticated;
revoke insert, update, delete on public.raffles from anon, authenticated;
revoke insert, update, delete on public.tickets from anon, authenticated;
revoke insert, update, delete on public.transactions from anon, authenticated;
revoke insert, update, delete on public.draw_sessions from anon, authenticated;

-- =============================================================
-- FIM DO MIGRATION
-- =============================================================
select 'Migration concluído com sucesso!' as resultado;
