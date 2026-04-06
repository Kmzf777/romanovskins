# Romanov Rifas — MVP Completo: Design Spec

**Data:** 2026-04-06  
**Escopo:** Corrigir todos os bugs críticos + implementar sorteio via Loteria Federal + UX essencial  
**Stack:** Next.js 15 App Router, Supabase (PostgreSQL), AbacatePay, Vercel

---

## Contexto

O site está hospedado na Vercel com Supabase configurado. O núcleo do sistema (auth, grid de tickets, reserva atômica, pagamento PIX, webhook) já funciona. Porém existem 9 bugs críticos que impedem o MVP de funcionar corretamente em produção, e 3 features de UX essenciais que qualquer concorrente já oferece.

---

## 1. Mudanças no Schema do Banco

### 1.1 Tabela `raffles` — novos campos

```sql
-- Campos para o mecanismo de sorteio
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS drawn_at TIMESTAMPTZ;
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS winner_ticket_number INT;
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS winner_user_id UUID REFERENCES users(id);

-- Campos de metadata da skin
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS float_value TEXT;
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS wear_condition TEXT;

-- Corrigir o CHECK de status para incluir 'drawn'
ALTER TABLE raffles DROP CONSTRAINT IF EXISTS raffles_status_check;
ALTER TABLE raffles ADD CONSTRAINT raffles_status_check
  CHECK (status IN ('active', 'closed', 'drawn', 'cancelled'));
```

### 1.2 pg_cron — liberar reservas expiradas

Ativar a extensão `pg_cron` no painel do Supabase (Database → Extensions) e executar:

```sql
SELECT cron.schedule(
  'release-expired-reservations',
  '*/1 * * * *',
  $$
    UPDATE tickets
    SET status = 'available', user_id = NULL, reserved_at = NULL, expires_at = NULL
    WHERE status = 'reserved' AND expires_at < NOW();
  $$
);
```

---

## 2. Bug Fixes Críticos

### 2.1 `getRecentWinners()` — query real no banco

**Arquivo:** `src/server/raffle-actions.ts`

Substituir o `return MOCK_WINNERS` por uma query que:
- Busca rifas com `status = 'drawn'`
- Faz JOIN com `users` via `winner_user_id`
- Retorna os 5 últimos ordenados por `drawn_at DESC`
- Campos: `id`, `winner_user_name`, `raffle_title`, `raffle_image_url`, `winner_ticket_number`, `drawn_at`

### 2.2 `getPastRaffles()` — query corrigida

**Arquivo:** `src/server/raffle-actions.ts`

Trocar `.in('status', ['closed', 'cancelled'])` por `.in('status', ['closed', 'drawn'])` e incluir os campos `winner_ticket_number`, `winner_user_id`, `drawn_at` no SELECT.

### 2.3 Transaction ID no `returnUrl` do AbacatePay

**Arquivo:** `src/server/payment-actions.ts`

Problema: a transação é criada DEPOIS do billing, então o ID não está disponível no `returnUrl`.

Solução: gerar um UUID antes do POST e usá-lo como ID da transação:
1. Gerar `const transactionId = crypto.randomUUID()`
2. Montar `returnUrl: ${appUrl}/checkout/success?tid=${transactionId}`
3. Inserir a transação com `.insert({ id: transactionId, ... })`

### 2.4 Cotas Restantes — contagem real

**Arquivo:** `src/server/raffle-actions.ts` — função `getRaffles()`

Usar Supabase RPC ou subquery para contar tickets `available` por rifa e retornar `available_count` junto com os dados da rifa. O `TicketCard` passará a exibir o valor real.

### 2.5 Float / Condição da Skin — campos reais

**Arquivo:** `src/components/ui/ticket-card.tsx`

Remover hardcoded `floatValue = '0.01231234135'` e `condition = 'Field-Tested'`. Ler `raffle.float_value` e `raffle.wear_condition`. Se null, não renderizar os badges.

**Arquivo:** `src/components/admin/CreateRaffleForm.tsx`

Adicionar campos opcionais "Float" e "Condição" (select: Factory New, Minimal Wear, Field-Tested, Well-Worn, Battle-Scarred).

### 2.6 Admin Dashboard — stats reais

**Arquivo:** `src/app/adminromanovskins/page.tsx`

Substituir os `--` por queries reais:
- Total de rifas ativas
- Total de cotas vendidas (status = 'sold')
- Receita total (SUM de transactions com status = 'paid')
- Total de usuários cadastrados

### 2.7 Admin — Lista de Rifas com ações

**Arquivo:** `src/app/adminromanovskins/page.tsx`

Adicionar uma tabela/lista abaixo dos stats com todas as rifas, mostrando:
- Título, status, progresso (sold/total), data de criação
- Botões: "Fechar Rifa" (status → 'closed') e "Realizar Sorteio" (abre modal)

### 2.8 Metadata do Site

**Arquivo:** `src/app/layout.tsx`

```ts
export const metadata: Metadata = {
  title: 'Romanov Rifas | Skins de CS2',
  description: 'Concorra a skins raras de CS2 com pagamento via PIX. Rifas transparentes e seguras.',
  openGraph: {
    title: 'Romanov Rifas | Skins de CS2',
    description: 'Concorra a skins raras de CS2 com pagamento via PIX.',
    type: 'website',
  },
};
```

### 2.9 Notificações Toast

**Arquivo:** `src/components/raffle/RaffleDetailClient.tsx` e `CheckoutSummary.tsx`

Substituir todos os `alert(result.error)` por toasts usando `sonner` (já compatível com Shadcn). Adicionar `<Toaster />` no `layout.tsx`.

---

## 3. Mecanismo de Sorteio via Loteria Federal

### 3.1 Como funciona

A Caixa Econômica Federal expõe resultados em `https://servicebus2.caixa.gov.br/portaldeloterias/api/federal/` (endpoint público, gratuito). O sorteio usa os **2 últimos dígitos do 1º prêmio** da Loteria Federal para determinar qual número vence dentro do range de cotas da rifa.

**Algoritmo:**
```
resultado_loteria = últimos 2 dígitos do 1º prêmio (ex: 45)
numero_vencedor = ((resultado_loteria) % total_numbers) + 1
```
Se `total_numbers = 100` e o resultado for `45` → ticket `#46`.

### 3.2 Server Action `performDrawAction`

**Arquivo:** `src/server/raffle-actions.ts`

Nova server action chamada pelo admin:
1. Verificar que o admin está autenticado (cookie `admin_session`)
2. Verificar que a rifa está com status `'closed'` (todas as cotas vendidas ou prazo encerrado)
3. Buscar último resultado da Loteria Federal via fetch
4. Calcular `winner_ticket_number` com o algoritmo acima
5. Buscar o usuário dono do ticket vencedor (`SELECT user_id FROM tickets WHERE raffle_id=... AND ticket_number=... AND status='sold'`)
6. **Fallback**: Se o ticket calculado não foi vendido (status != 'sold'), buscar o ticket vendido com número mais próximo (menor diferença absoluta). Se não houver nenhum ticket vendido, retornar erro — o sorteio só pode ser realizado se ao menos 1 ticket foi vendido.
7. Atualizar `raffles`: `{ status: 'drawn', drawn_at: NOW(), winner_ticket_number, winner_user_id }`
8. Revalidar paths `/` e `/adminromanovskins`

### 3.3 UI do Sorteio no Admin

**Arquivo:** `src/app/adminromanovskins/page.tsx`

Modal de confirmação ao clicar "Realizar Sorteio":
- Aviso: "O vencedor será determinado pelo resultado da Loteria Federal mais recente"
- Botão "Confirmar Sorteio"
- Ao confirmar: chama `performDrawAction(raffleId)`
- Exibe resultado: "Número vencedor: #42 — João Silva"

---

## 4. Timer de Reserva no Checkout

### 4.1 Componente `CountdownTimer`

**Arquivo:** `src/components/checkout/CountdownTimer.tsx` (novo)

Componente client que:
- Recebe `expiresAt: string` (ISO) como prop
- Calcula o tempo restante com `setInterval` a cada segundo
- Exibe `MM:SS` em vermelho quando < 5 minutos
- Quando chegar a zero: exibe "Reserva expirada" e redireciona para `/rifa/[id]` após 3 segundos

### 4.2 Integrar no CheckoutSummary

**Arquivo:** `src/components/checkout/CheckoutSummary.tsx`

O `CheckoutPage` já busca os tickets reservados (que têm `expires_at`). Passar `tickets[0].expires_at` para o `CountdownTimer`. Exibir o timer no topo do card de resumo com destaque visual.

---

## 5. Barra de Progresso de Cotas

### 5.1 No Card da Listagem (TicketCard)

**Arquivo:** `src/components/ui/ticket-card.tsx`

Substituir o `remaining = Math.floor(raffle.total_numbers * 0.4)` por `raffle.available_count` (vindo da query corrigida em 2.4). Adicionar:
- Barra de progresso visual: `sold_count / total_numbers * 100%`
- Texto: "X de Y cotas vendidas"
- Cor: verde → amarelo → vermelho conforme % vendido

### 5.2 Na Página de Detalhe (RaffleDetailClient)

**Arquivo:** `src/components/raffle/RaffleDetailClient.tsx`

Calcular `sold = tickets.filter(t => t.status !== 'available').length` (já disponível no array) e exibir a barra de progresso acima do grid de tickets.

---

## 6. Página "Meus Tickets"

### 6.1 Rota

**Arquivo:** `src/app/meus-tickets/page.tsx` (novo)

Server Component que:
- Verifica autenticação (cookie `romanov_user`); se ausente → redirect `/login`
- Busca todas as transações do usuário com status `'paid'`
- Faz JOIN com `raffles` para obter título e imagem
- Agrupa por rifa

### 6.2 UI

Lista de cards por rifa, mostrando:
- Imagem e título da rifa
- Status da rifa (Ativa / Encerrada / **Você ganhou! 🎉** se `winner_user_id = userId`)
- Números comprados como badges amarelos
- Data da compra

### 6.3 Link no Header

**Arquivo:** `src/components/HeaderContent.tsx`

Adicionar link "Meus Tickets" no menu quando o usuário está logado.

---

## Arquitetura de Dados — Fluxo Completo Atualizado

```
[Criar Rifa] → Admin Form → createRaffleAction() → INSERT raffles + tickets em lote
[Comprar]    → TicketGrid → reserveTicketsAction() → UPDATE tickets (atomic) → checkout/[id]
[Pagar]      → CheckoutSummary + Timer → createCheckoutAction() → AbacatePay → redirect PIX
[Confirmar]  → Webhook AbacatePay → UPDATE tickets='sold' + UPDATE transactions='paid'
[Fechar]     → Admin → updateRaffleStatus() → status='closed'
[Sortear]    → Admin Modal → performDrawAction() → Loteria Federal API → UPDATE raffles
[Expirar]    → pg_cron (1min) → UPDATE tickets='available' WHERE expires_at < NOW()
```

---

## Arquivos a Criar/Modificar

| Arquivo | Operação |
|---|---|
| `src/server/raffle-actions.ts` | Modificar: getRecentWinners, getPastRaffles, getRaffles, + nova performDrawAction |
| `src/server/payment-actions.ts` | Modificar: fix transactionId no returnUrl |
| `src/app/layout.tsx` | Modificar: metadata + Toaster |
| `src/app/adminromanovskins/page.tsx` | Modificar: stats reais + lista de rifas + modal sorteio |
| `src/components/admin/CreateRaffleForm.tsx` | Modificar: campos float_value e wear_condition |
| `src/components/ui/ticket-card.tsx` | Modificar: dados reais (available_count, float, condition) + progress bar |
| `src/components/raffle/RaffleDetailClient.tsx` | Modificar: progress bar + toasts |
| `src/components/checkout/CheckoutSummary.tsx` | Modificar: integrar CountdownTimer + toasts |
| `src/components/HeaderContent.tsx` | Modificar: link "Meus Tickets" |
| `src/components/checkout/CountdownTimer.tsx` | Criar: componente de countdown |
| `src/app/meus-tickets/page.tsx` | Criar: página meus tickets |
| `src/types/index.ts` | Modificar: atualizar interfaces Raffle e Ticket |
| Supabase SQL | Executar: migrations de schema + pg_cron |

---

## Critérios de Conclusão

- [ ] Nenhum dado mock retornado quando DB está configurado
- [ ] Timer visível no checkout; expiração redireciona automaticamente
- [ ] Admin consegue criar, fechar e sortear rifas
- [ ] Comprovante exibe dados reais da transação
- [ ] Página "Meus Tickets" mostra histórico real do usuário
- [ ] "Cotas Restantes" reflete o banco em tempo real
- [ ] pg_cron liberando reservas a cada 1 minuto
- [ ] OG tags corretas ao compartilhar no WhatsApp
