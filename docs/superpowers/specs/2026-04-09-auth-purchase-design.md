# Design: Auth com Supabase OTP + Correção do Fluxo de Compras

**Data:** 2026-04-09  
**Status:** Aprovado

---

## 1. Auth — Supabase Auth com Email OTP

### Problema atual
- Cookie `romanov_user` armazena UUID puro sem assinatura — qualquer pessoa com acesso ao cookie impersona outro usuário
- Nenhuma verificação de posse do WhatsApp/email — qualquer um digita o número de outra pessoa
- Race conditions podem criar usuários duplicados (sem tratamento de unique constraint no app)
- WhatsApp não é normalizado (formatos diferentes = usuários diferentes)

### Solução
Substituir o sistema de cookie artesanal pelo **Supabase Auth com Email OTP**.

### Arquitetura

**Nova tabela `profiles`:**
```sql
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  whatsapp text not null,
  created_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
```

**Fluxo de login:**
1. Usuário acessa `/login` → digita nome + email + WhatsApp
2. `loginAction` chama `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })`
3. Redireciona para `/login/verify?email=...&name=...&whatsapp=...`
4. Usuário digita código 6 dígitos
5. `verifyOtpAction` chama `supabase.auth.verifyOtp({ email, token, type: 'email' })`
6. Após verificação: upsert em `profiles` com nome e WhatsApp
7. Redireciona para destino original

**`getCurrentUser()`:**
```ts
export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return profile ? { ...profile, email: user.email } : null;
}
```

**Middleware Next.js** (`middleware.ts`):
- Rotas protegidas: `/checkout/*`, `/meus-tickets`
- Redireciona para `/login` se não autenticado

**Compatibilidade com código existente:**
- `userId` passa a ser `user.id` do Supabase Auth (UUID)
- Referências à tabela `users` são substituídas por `profiles`
- `raffle-actions.ts`, `payment-actions.ts` e `checkout` usam `getCurrentUser()` — sem breaking changes na interface

---

## 2. Sistema de Compras — Correção `reserved` → `sold`

### Problema raiz
Em `payment-actions.ts`, o `billingId` é extraído como:
```js
const billingId = billingData.id || billingData.billing?.id;
```
Se a resposta da AbacatePay tiver estrutura diferente, `billingId` = `undefined`.  
A transação é salva com `external_id = 'unknown'`.  
O webhook busca por `external_id = <id_real>` → não encontra → tickets nunca viram `sold`.

### Correções

**1. `payment-actions.ts` — Extração defensiva do billingId:**
- Log completo do `response.data` antes de qualquer extração
- Tentar múltiplos caminhos: `data.id`, `data.billing?.id`, `data.billingId`
- Se nenhum funcionar → retornar erro explícito, não salvar `'unknown'`

**2. `route.ts` (webhook) — Busca por múltiplos campos:**
- Tentar busca por `external_id` primeiro
- Se não encontrar, tentar busca por `id` direto (caso o billingId seja o ID interno)
- Log detalhado de cada etapa para diagnóstico

**3. `/checkout/success` — Safety net:**
- Se `transaction.status === 'pending'` ao carregar a página, chamar endpoint interno `/api/confirm-payment?tid=...`
- Esse endpoint consulta a AbacatePay via API (`GET /billing/{id}`) para checar status
- Se pago → atualiza transação + tickets localmente sem depender do webhook
- Exibe status real: "Aguardando confirmação" vs "Pagamento Confirmado"

**4. Novo endpoint `/api/confirm-payment`:**
```
GET /api/confirm-payment?tid={transactionId}
- Busca transação pelo ID interno
- Consulta AbacatePay com external_id
- Se status = paid → executa mesma lógica do webhook
- Retorna { status: 'paid' | 'pending' }
```

---

## Componentes Frontend Modificados

- `LoginForm.tsx` → dois passos: formulário inicial + campo OTP
- `login/page.tsx` → nova página `/login/verify`
- `checkout/success/page.tsx` → mostrar status real com polling

---

## Dependências Externas

- Supabase Auth (Email OTP) — já disponível no plano gratuito
- AbacatePay `GET /billing/{id}` — consulta de status de cobrança

---

## Migrações de Banco

1. Criar tabela `profiles`
2. Migrar dados de `users` para `profiles` (se houver dados em prod)
3. Atualizar foreign keys em `tickets` e `transactions` para referenciar `profiles.id`
4. Configurar RLS em `profiles`
