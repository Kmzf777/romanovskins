# Romanov Rifas — Full Site Redesign Spec
**Date:** 2026-04-06  
**Status:** Approved  
**Approach:** "Romanov Reigns" — Dark premium + gamer vibrante, amarelo como acento

---

## 1. Visão Geral

Redesign completo do site Romanov Rifas do zero. A identidade central é o **agente Romanov como mascote**, criando uma marca única no mercado de rifas de CS2. O estilo combina **dark premium** (atmosfera de luxo underworld) com **energia gamer vibrante** — tudo em amarelo (#F5C518) em vez dos azuis/roxos dos concorrentes.

**Stack existente mantida:** Next.js 14 (App Router), TypeScript, Tailwind CSS v4, Supabase, AbacatePay (PIX), Space Grotesk + Geist Mono.

---

## 2. Sistema Visual

### 2.1 Paleta de Cores

```css
/* Fundos */
--bg-deep:        #0A0A0B;   /* fundo global — mais escuro que o atual */
--bg-surface:     #111114;   /* cards, modais */
--bg-elevated:    #1A1A1F;   /* hover states, inputs, dropdowns */

/* Amarelo — identidade da marca */
--yellow-primary: #F5C518;   /* CTA, bordas ativas, destaques */
--yellow-bright:  #FFD700;   /* glow effects, rim light */
--yellow-dark:    #C49A00;   /* sombras douradas, bordas sutis */

/* Funcionais */
--red-urgency:    #E63946;   /* cotas acabando, urgência */
--green-success:  #2DC653;   /* confirmações, "trocável" */

/* Tipografia */
--text-primary:   #F0EAD6;   /* branco levemente quente */
--text-secondary: #7A7A8A;
--text-muted:     #4A4A5A;

/* Bordas */
--border-subtle:  #2A2A32;
--border-active:  #F5C518;
```

### 2.2 Tipografia

| Papel | Fonte | Uso |
|-------|-------|-----|
| Display/Hero | Bebas Neue | Títulos grandes, uppercase, impacto |
| Body/UI | Space Grotesk | Todo texto de interface (mantém atual) |
| Dados/Números | Geist Mono | Float values, preços, contadores, cotas |

**Hierarquia de tamanhos:**
- Hero display: 72–96px (Bebas Neue)
- H1 seção: 48px (Bebas Neue)
- H2 card destaque: 28px (Space Grotesk 700)
- Body: 16px (Space Grotesk 400)
- Label/meta: 12px uppercase tracking-wider (Space Grotesk 500)

### 2.3 Background Global

- Arte de CS2 (cena de combate ou mapa icônico) com `opacity: 0.08`
- Gradiente radial escuro centralizado por cima: `radial-gradient(ellipse at center, transparent 0%, #0A0A0B 70%)`
- Resultado: atmosfera imersiva sem competir com o conteúdo
- Sem animações no background — movement apenas em elementos de UI

### 2.4 Efeitos e Tokens de Estilo

```
Glow amarelo padrão:   box-shadow: 0 0 20px rgba(245,197,24,0.3)
Glow amarelo intenso:  box-shadow: 0 0 40px rgba(245,197,24,0.6)
Borda card destaque:   1px solid #F5C518 + glow padrão
Borda card padrão:     1px solid #2A2A32 → hover: 1px solid #F5C518 + glow sutil
Border radius padrão:  8px
Border radius card:    12px
Transição padrão:      all 0.25s ease
```

---

## 3. Layout Global e Navegação

### 3.1 Header

```
Desktop:
[Logo ícone + "ROMANOV RIFAS"]  [Rifas] [Como Funciona] [Ganhadores]  [Meus Tickets]  [ENTRAR ▶]

Mobile:
[Logo centralizado]  [≡ hamburger direita]
```

**Especificações:**
- Altura: 72px
- Fundo: `#0A0A0B` + `border-bottom: 1px solid #2A2A32`
- Sticky no scroll com `backdrop-blur(12px)` e `bg-opacity: 0.9`
- CTA "ENTRAR": botão `bg-yellow-primary text-black font-bold px-6 py-2 rounded-lg`
- Nav links: Space Grotesk 500, cor `#7A7A8A` → hover `#F0EAD6`, sem underline
- Logo: ícone Romanov + texto "ROMANOV RIFAS" em Bebas Neue 22px amarelo

### 3.2 Estrutura da Home Page

```
1. HERO BANNER          ~85vh, full-width
2. RIFAS EM DESTAQUE    seção com 1–2 cards especiais
3. TODAS AS RIFAS       grid 2 colunas, cards padrão
4. COMO FUNCIONA        3 passos side-by-side
5. GANHADORES RECENTES  scroll horizontal de cards
6. FOOTER               stats + selos + links
```

### 3.3 Sitemap Completo

```
/                    → Home
/rifa/[id]           → Detalhe da rifa
/checkout/[id]       → Checkout (com countdown)
/checkout/success    → Sucesso
/meus-tickets        → Histórico do usuário
/login               → Login
/como-funciona       → Página "Como Funciona" (nova)
/ganhadores          → Hall of Fame (nova)
/adminromanovskins   → Admin dashboard (sem redesign)
```

---

## 4. Hero Banner

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  [background: arte CS2 escurecida + glow amarelo radial]         │
│                                                                  │
│  ┌────────────────────────┐      ┌─────────────────────────┐    │
│  │ [tag] NOVA RIFA ATIVA  │      │                         │    │
│  │                        │      │   [ROMANOV AGENT ART]   │    │
│  │ CONCORRA A             │      │   posicionado à direita │    │
│  │ SKINS RARAS            │      │   60% da altura         │    │
│  │ DE CS2.                │      │   glow amarelo atrás    │    │
│  │ [sublinhado em RARAS]  │      │                         │    │
│  │                        │      └─────────────────────────┘    │
│  │ Sorteio pela Loteria   │                                      │
│  │ Federal. Pague via PIX.│                                      │
│  │                        │                                      │
│  │ [VER RIFAS ▶] [Como?]  │                                      │
│  │                        │                                      │
│  │ 🏆 127 Ganhadores      │                                      │
│  │ 🎯 R$480k em skins     │                                      │
│  └────────────────────────┘                                      │
│                          [chevron scroll ↓]                      │
└──────────────────────────────────────────────────────────────────┘
```

**Especificações:**
- Altura: `min-h-[85vh]`
- Título: Bebas Neue 80px (desktop), 48px (mobile), cor `#F0EAD6`
- "RARAS": sublinhado com `border-bottom: 3px solid #F5C518`
- CTA primário: `bg-yellow-primary text-black font-black uppercase tracking-widest px-8 py-4 text-lg`
- CTA ghost: `border border-white/30 text-white px-6 py-4 hover:border-white`
- Stats inline: Geist Mono 14px, separados por `•`, cor `#7A7A8A`
- Tag "NOVA RIFA ATIVA": `bg-yellow-primary/20 border border-yellow-primary text-yellow-primary text-xs uppercase tracking-wider px-3 py-1 rounded-full`
- Imagem Romanov: posição `right-0 bottom-0`, `object-position: bottom`, `height: 95%`, sem background próprio, funde com o cenário

---

## 5. Cards de Rifa

### 5.1 Card Destaque

Usado para rifas marcadas como `featured = true` (campo novo no banco). Máximo 2 simultâneos.

```
┌────────────────────────────────────────────────────────────────┐
│  [DESTAQUE ★]                                    [FT | 0.032]  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │          IMAGEM DA SKIN — altura 280px                   │  │
│  │          glow amarelo radial atrás da skin               │  │
│  │          gradiente de baixo para cima na imagem          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  Karambit                               ~~R$ 25.000~~          │
│  Doppler Fase 2 • Factory New           R$ 18.444  -26%        │
│                                                                │
│  [████████████████████░░░░░]  87% vendido  •  234/270 cotas   │
│                                                                │
│  Cota por apenas                                               │
│  R$ 25,00                                                      │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              PARTICIPAR AGORA  →                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│  [borda do card: animação de glow pulsante em amarelo]         │
└────────────────────────────────────────────────────────────────┘
```

**Especificações:**
- Fundo: `#111114`
- Borda: `1px solid #F5C518` + `box-shadow: 0 0 30px rgba(245,197,24,0.25)`
- Animação de borda: keyframe `pulse-border` — glow oscila entre 0.2 e 0.5 opacity, 2s infinite
- Badge "DESTAQUE ★": `bg-yellow-primary text-black text-xs font-black uppercase px-3 py-1`
- Nome da skin: Bebas Neue 32px
- Subtítulo (doppler/fase): Space Grotesk 14px `text-secondary`
- Preço atual: Geist Mono 28px `text-yellow-primary font-bold`
- Preço riscado: Geist Mono 16px `line-through text-muted`
- Badge desconto: `bg-red-urgency text-white text-sm font-bold px-2 py-0.5 rounded`
- Barra de progresso: altura 8px, fundo `#2A2A32`, fill com gradiente `#F5C518 → #FFD700`
- CTA: `bg-yellow-primary text-black font-black uppercase tracking-widest h-14 text-lg w-full`
- Hover do card: `scale(1.01)` + intensifica glow para `0 0 50px rgba(245,197,24,0.4)`

### 5.2 Card Padrão

Grid de 2 colunas (desktop), 1 coluna (mobile).

```
┌────────────────────────┐
│ [imagem skin 200px]    │
│ [wear badge topo dir.] │
│ [float badge topo esq] │
│                        │
│ Nome da Skin           │
│ Subtítulo              │
│                        │
│ R$ 5.822  -22%         │
│ [barra progresso]      │
│ 67% • 180/270 cotas    │
│                        │
│ [PARTICIPAR →]         │
└────────────────────────┘
```

**Especificações:**
- Fundo: `#111114`, borda `#2A2A32`, border-radius 12px
- Hover: borda `#F5C518` + glow sutil `0 0 15px rgba(245,197,24,0.2)`
- Imagem: `aspect-square object-cover` com gradiente overlay no bottom
- CTA: `bg-yellow-primary/10 border border-yellow-primary text-yellow-primary hover:bg-yellow-primary hover:text-black` — começa mais sutil, hover sólido
- Preço: Geist Mono, amarelo
- Badge wear: `bg-black/70 text-yellow-primary text-xs uppercase tracking-wider px-2 py-0.5`

---

## 6. Seção "Como Funciona"

Fundo levemente diferente (`#0D0D10`) para criar separação visual.

```
┌────────────────────────────────────────────────────────────────┐
│                   COMO FUNCIONA                                │
│              Em 3 passos simples                               │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   [ícone]    │  │   [ícone]    │  │   [ícone]    │         │
│  │      01      │  │      02      │  │      03      │         │
│  │   ESCOLHA    │  │    PAGUE     │  │    TORÇA     │         │
│  │              │  │              │  │              │         │
│  │ Selecione a  │  │ PIX instant. │  │ Sorteio ao   │         │
│  │ skin. Compre │  │ Confirmação  │  │ vivo pela    │         │
│  │ 1 ou mais    │  │ em segundos. │  │ Loteria Fed. │         │
│  │ cotas.       │  │              │  │ Transparente │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────────────────────────────────────────────────────────────┘
```

**Especificações:**
- Número do passo: Bebas Neue 80px, `text-yellow-primary/20` (grande e decorativo)
- Título do passo: Space Grotesk 700 18px uppercase
- Ícone: Lucide icon em círculo `bg-yellow-primary/10 border border-yellow-primary/30`, 48px
- Conectores entre blocos: linha tracejada horizontal `border-dashed border-yellow-primary/30` (desktop only)

---

## 7. Seção Ganhadores Recentes (Home)

Scroll horizontal com 6–8 cards visíveis (com scroll suave).

```
┌───────────────────────────────────────────────────────────────┐
│  ÚLTIMOS GANHADORES                           [Ver todos →]   │
│                                                               │
│  ←  [card] [card] [card] [card] [card] [card]  →             │
└───────────────────────────────────────────────────────────────┘
```

**Card de ganhador:**
```
┌──────────────────┐
│  [skin image]    │
│  🏆              │
│  Karambit Dopp.  │
│  Factory New     │
│  R$ 18.444       │
│  João S*** · 3d  │
└──────────────────┘
```

- Nome mascarado: apenas primeiro nome + inicial do sobrenome
- Ícone troféu em amarelo
- Fundo `#111114`, border-radius 12px, sem borda (diferencia do card de rifa)

---

## 8. Página "Como Funciona" (/como-funciona)

Versão expandida da seção da home, com:
- Hero pequeno: "COMO FUNCIONA" em Bebas Neue grande + subtítulo
- Os 3 passos ampliados com mais detalhes
- Seção de perguntas frequentes (accordion)
- Seção de transparência: "Por que Loteria Federal?" com explicação
- CTA final: "Pronto para participar?" → botão para home

---

## 9. Página Ganhadores (/ganhadores)

- Header da página: "HALL OF FAME" em Bebas Neue 64px
- Filtros: Todos | Este mês | Facas | Rifles | Luvas
- Grid de cards de ganhadores (3 colunas desktop, 1 mobile)
- Card expandido vs. home: inclui número da Loteria Federal do sorteio
- Paginação no fundo

---

## 10. Página Rifa Detalhe (/rifa/[id])

```
┌──────────────────────────────────────────────────────────────┐
│  [breadcrumb: Home / Rifas / Karambit Doppler]               │
│                                                              │
│  ┌─────────────────────┐  ┌────────────────────────────┐    │
│  │  [imagem grande     │  │  Karambit Doppler          │    │
│  │   da skin com glow] │  │  Fase 2 · Factory New      │    │
│  │                     │  │  Float: 0.032              │    │
│  │  [badges: FT, wear] │  │                            │    │
│  │                     │  │  [barra progresso]         │    │
│  └─────────────────────┘  │  234/270 cotas vendidas    │    │
│                           │                            │    │
│                           │  Preço por cota: R$ 25,00  │    │
│                           │  [- 1 +]  Subtotal: R$25   │    │
│                           │                            │    │
│                           │  [COMPRAR COTAS →]         │    │
│                           └────────────────────────────┘    │
│                                                              │
│  [GRADE DE COTAS NUMERADAS]                                  │
│  Verde = disponível · Amarelo = reservada · Cinza = vendida  │
└──────────────────────────────────────────────────────────────┘
```

---

## 11. Checkout (/checkout/[id])

- Mantém countdown timer existente (redesenhado visualmente)
- Countdown: fonte Geist Mono grande, cor `#F5C518`, fundo `#111114`, borda vermelha ao aproximar do fim
- Resumo do pedido em card lateral (desktop) ou acima (mobile)
- Input de quantidade com +/- buttons grandes
- Botão PIX: amarelo sólido, ícone PIX, grande

---

## 12. Meus Tickets (/meus-tickets)

- Timeline vertical de compras
- Card de ticket vencedor: borda dourada + badge "VENCEDOR 🏆" + efeito confetti via CSS
- Card de ticket ativo: borda amarela sutil
- Card de ticket expirado/perdido: desaturado, opacidade reduzida

---

## 13. Footer

```
┌────────────────────────────────────────────────────────────────┐
│  [LOGO]  ROMANOV RIFAS           Rifas  Como Funciona          │
│  Concorra a skins raras de CS2.  Ganhadores  Meus Tickets      │
│                                  Entrar                        │
│  ──────────────────────────────────────────────────────────    │
│  🏆 127 Ganhadores  ·  🎯 R$480k em skins  ·  🎰 340 Rifas    │
│  ──────────────────────────────────────────────────────────    │
│  [✓ Sorteio pela Loteria Federal]                              │
│  [✓ Pagamento seguro via PIX]                                  │
│  [✓ Entrega de skin garantida]                                 │
│  ──────────────────────────────────────────────────────────    │
│  © 2025 Romanov Rifas  [Instagram]  [WhatsApp]                 │
└────────────────────────────────────────────────────────────────┘
```

**Especificações:**
- Fundo: `#0A0A0B` com `border-top: 1px solid #2A2A32`
- Stats: Geist Mono, `text-yellow-primary`
- Selos: ícone checkmark em `text-green-success`, texto `text-secondary`, fundo `bg-green-success/10 border border-green-success/20 rounded px-4 py-2`

---

## 14. Novos Campos no Banco de Dados

| Tabela | Campo novo | Tipo | Descrição |
|--------|-----------|------|-----------|
| raffles | `featured` | boolean | Marca rifa como destaque |
| raffles | `original_price` | decimal | Preço de mercado para mostrar desconto |

---

## 15. Prompt de Imagem — Hero Art (Nano Banana2)

```json
{
  "prompt": {
    "subject": "The Romanov CS2 agent skin character — a stern, elite Russian operative in a dark tactical suit with gold military insignia, standing in a powerful three-quarter pose facing slightly left, arms at sides with slight tension, exuding authority and wealth",
    "style": "ultra-realistic game promotional art, cinematic render, hyper-detailed 3D character illustration, AAA game quality",
    "lighting": {
      "primary": "strong golden-yellow rim light from behind-left, creating a dramatic halo/glow effect around the character silhouette",
      "secondary": "subtle cool blue fill light from the right to add depth",
      "atmosphere": "volumetric light rays in golden-yellow piercing through dust particles behind the character"
    },
    "background": {
      "scene": "darkened CS2 combat environment, blurred Dust2 or Mirage map architecture in deep background, barely visible through thick atmospheric haze",
      "depth": "extreme depth of field, background completely blurred (bokeh), character is sharp and dominant",
      "overlay": "deep dark vignette around edges, background fades to near-black #0A0A0B at corners",
      "particles": "floating golden dust particles and embers in the air"
    },
    "color_palette": {
      "dominant": "#0A0A0B near-black deep background",
      "accent": "#F5C518 golden yellow for glow effects and light",
      "highlight": "#FFD700 bright gold rim light on character",
      "midtones": "dark charcoal and gunmetal grays on character suit",
      "atmosphere": "very subtle deep blue-gray in background fog"
    },
    "composition": {
      "character_position": "right side of frame, occupying roughly 55-60% of image height, positioned from bottom-center to right",
      "negative_space": "large open dark space on the left side for text overlay",
      "framing": "wide cinematic 16:9 aspect ratio, full body visible from boots to top of head with slight room above",
      "perspective": "slight low-angle (worm's eye) to make character look imposing and powerful"
    },
    "character_details": {
      "face": "serious, stoic expression, strong jawline, slight 5-o-clock shadow, piercing eyes",
      "suit": "black tactical suit with gold/brass military medals and patches, subtle texture of expensive fabric",
      "posture": "confident military stance, weight on back foot, slight forward lean",
      "glow_effect": "intense golden aura emanating from behind character, as if standing in front of a golden light source"
    },
    "mood": "premium luxury underground casino meets elite military operative — dangerous, wealthy, exclusive",
    "quality_tags": "8k resolution, photorealistic, cinematic color grading, professional game marketing art, hero artwork, dramatic lighting, award-winning digital art",
    "negative_prompt": "cartoon, anime, flat design, bright background, low quality, blurry character, watermark, text, logo, overexposed, neon colors other than gold/yellow"
  },
  "technical": {
    "aspect_ratio": "16:9",
    "resolution": "1920x1080 minimum",
    "format": "PNG with transparency on character if possible",
    "style_reference": "CS2 official agent promotional art, Valorant agent splash art quality"
  }
}
```

---

## 16. Instrução para Subagentes

> **OBRIGATÓRIO:** Todo subagente que implementar qualquer componente, página ou elemento de frontend **deve invocar a skill `frontend-design:frontend-design` antes de escrever qualquer código de UI.** Isso garante qualidade de design production-grade e evita estética genérica de IA.

---

## 17. Ordem de Implementação Sugerida

1. **Sistema visual** — globals.css, tokens de cor, fontes (Bebas Neue)
2. **Layout raiz** — RootLayout + Header redesenhado
3. **Hero Banner** — componente HeroBanner com arte Romanov
4. **Card Destaque** — novo componente FeaturedRaffleCard
5. **Card Padrão** — redesign do TicketCard existente
6. **Home page** — monta as seções na ordem definida
7. **Como Funciona** — seção + página
8. **Ganhadores** — seção home + página /ganhadores
9. **Rifa Detalhe** — redesign do RaffleDetailClient
10. **Checkout** — redesign visual do checkout + countdown
11. **Meus Tickets** — timeline redesenhada
12. **Footer** — componente Footer com stats e selos
13. **Migration Supabase** — campos `featured` e `original_price`
