---
name: Central de Atualização Intelite
description: Sala de projeção escura para o cliente atualizar o app Intelite com vídeo e texto em sincronia, e painel administrativo no mesmo tema preto.
colors:
  bg: "#050507"
  surface: "#0c0d11"
  surface-2: "#12141a"
  surface-3: "#1a1d25"
  text: "#f2f4f8"
  text-2: "#c9cedb"
  muted: "#9aa1b2"
  faint: "#7f8698"
  border: "#20232c"
  border-strong: "#343947"
  border-input: "#656c80"
  brand: "#4c9bff"
  brand-hover: "#6aaeff"
  brand-contrast: "#04111f"
  brand-soft: "#0c1d38"
  brand-text: "#8ec0ff"
  ok: "#4ade80"
  ok-soft: "#0b2417"
  warn: "#fbbf24"
  warn-soft: "#2a2008"
  bad: "#ff8a80"
  bad-soft: "#2d1210"
  focus: "#9cc9ff"
typography:
  display:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, sans-serif"
    fontSize: "clamp(2.1rem, 1.1rem + 6.4vw, 4.75rem)"
    fontWeight: 650
    lineHeight: 1.04
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 1.1rem + 2.4vw, 2.75rem)"
    fontWeight: 650
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  lead:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.2
  kpi:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 650
    lineHeight: 1.1
    letterSpacing: "-0.03em"
rounded:
  sm: "10px"
  md: "14px"
  lg: "20px"
  xl: "28px"
  pill: "999px"
spacing:
  s-1: "4px"
  s-2: "8px"
  s-3: "12px"
  s-4: "16px"
  s-5: "24px"
  s-6: "32px"
  s-7: "48px"
  s-8: "72px"
components:
  button:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "10px 24px"
    height: "44px"
  button-hover:
    backgroundColor: "{colors.surface-3}"
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.brand-contrast}"
    rounded: "{rounded.md}"
    padding: "10px 24px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.brand-hover}"
  button-primary-disabled:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.muted}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    rounded: "{rounded.md}"
  button-lg:
    rounded: "{rounded.lg}"
    padding: "14px 32px"
    height: "54px"
  input:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "11px 16px"
    height: "48px"
  opt:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.md}"
    padding: "16px"
    height: "56px"
  opt-selected:
    backgroundColor: "{colors.brand-soft}"
    textColor: "{colors.text}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "16px"
  subcard:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.md}"
    padding: "16px"
  sub:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "16px"
  sub-active:
    backgroundColor: "{colors.surface-2}"
  player:
    backgroundColor: "#000000"
    rounded: "{rounded.xl}"
  chapter-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-2}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
    height: "40px"
  chapter-chip-current:
    backgroundColor: "{colors.brand-soft}"
    textColor: "{colors.brand-text}"
  verdict:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "24px"
    height: "132px"
  drop:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "32px 16px"
  recap:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  dl-direct:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.brand-contrast}"
    rounded: "{rounded.md}"
    height: "52px"
  badge:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.text-2}"
    rounded: "{rounded.pill}"
    padding: "3px 11px"
  badge-ok:
    backgroundColor: "{colors.ok-soft}"
    textColor: "{colors.ok}"
  badge-warn:
    backgroundColor: "{colors.warn-soft}"
    textColor: "{colors.warn}"
  badge-bad:
    backgroundColor: "{colors.bad-soft}"
    textColor: "{colors.bad}"
  alert-info:
    backgroundColor: "{colors.brand-soft}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  kpi:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "16px"
  admin-nav-current:
    backgroundColor: "{colors.brand-soft}"
    textColor: "{colors.brand-text}"
    rounded: "{rounded.sm}"
---

# Design System: Central de Atualização Intelite

## Overview

**Creative North Star: "A Sala de Projeção"**

Uma sala escura onde o vídeo é a luz e o passo a passo escrito corre ao lado dele. O fundo é preto quase absoluto (`bg`), as superfícies sobem em degraus de grafite frio (`surface`, `surface-2`, `surface-3`) e existe uma única luz, o azul Intelite (`brand`), reservada para ação, progresso e passo ativo. Geist é a voz única: display pesado e apertado, corpo regular. A mesma linguagem serve a página pública (cliente de pé ao lado do Mini PC, celular na mão) e o painel administrativo (equipe de suporte), com precisão e contenção em vez de ornamento.

A página pública é uma tarefa, não uma vitrine: pergunta, escolha, vídeo e passos lado a lado, conferência da tela, foto, avaliação. A administração reaproveita os mesmos tokens em formato denso (KPIs, funil, tabela). O tema preto é compromisso de marca pedido pelo cliente do projeto.

O contrato de direção citava o preto #060608; a build entrega `#050507`, e este documento registra a build.

**Key Characteristics:**
- Preto quase absoluto com camadas tonais de grafite frio; profundidade por degrau de superfície e linha de 1px, não por sombra.
- Uma só cor de acento (azul `brand`); verde, âmbar e vermelho existem apenas como estado, sempre com ícone e texto.
- Cantos generosos de 10 a 28px, mais pílulas (999px) para selos e capítulos.
- Brilho azul difuso só no passo ativo, no player, no botão primário em hover e na opção selecionada.
- Ícones SVG de traço 1.75, pontas arredondadas, sem emoji nem glifo Unicode.
- Alvos de toque de 44px ou mais, foco de 3px visível, movimento desligado sob `prefers-reduced-motion`.

## Colors

Paleta de uma luz só: azul elétrico sobre grafite frio do mesmo matiz da marca, com estados semânticos discretos.

### Primary
- **Azul Intelite** (`brand` #4c9bff): botão primário, passo ativo, barra de progresso, fase atual, marca do funil. Hover em `brand-hover` (#6aaeff).
- **Tinta sobre azul** (`brand-contrast` #04111f): texto e ícones sobre `brand`.
- **Azul de fundo** (`brand-soft` #0c1d38): fundo de seleção, capítulo atual, aviso informativo, item de navegação atual.
- **Azul de texto** (`brand-text` #8ec0ff): links e texto sobre `brand-soft`.
- **Brilho** (`--brand-glow` rgba(76,155,255,.22)): halo de elementos ativos; não é cor de preenchimento.

### Secondary
- **Verde conferido** (`ok` #4ade80, fundo `ok-soft` #0b2417): fase concluída, passo confirmado, selo de sucesso, painel de conclusão.
- **Âmbar de atenção** (`warn` #fbbf24, fundo `warn-soft` #2a2008): estrelas de avaliação, tela cortada, pendências.
- **Coral de erro** (`bad` #ff8a80, fundo `bad-soft` #2d1210): erro de campo, ação destrutiva, selo de problema.

### Neutral
- **Preto de projeção** (`bg` #050507): fundo de página e do `html`.
- **Grafite 1** (`surface` #0c0d11): cartões, passos, recap, drop, painel.
- **Grafite 2** (`surface-2` #12141a): campos, botão padrão, subcartão, passo ativo.
- **Grafite 3** (`surface-3` #1a1d25): hover, selos neutros, trilha do funil e do progresso.
- **Branco azulado** (`text` #f2f4f8), **`text-2`** (#c9cedb) para texto secundário, **`muted`** (#9aa1b2) para apoio, **`faint`** (#7f8698) para placeholder e números de fase.
- **Linhas:** `border` (#20232c) divisória padrão; `border-strong` (#343947) botão, player, capítulo; `border-input` (#656c80) limite de campos e opções, com pelo menos 3:1 sobre as superfícies.
- **Foco** (`focus` #9cc9ff): anel de foco.

### Named Rules
**A Regra da Uma Luz.** O azul `brand` é o único acento; aparece onde há ação, progresso ou passo ativo. Estado verde, âmbar e coral nunca decora.
**A Regra do Estado Legível.** Cor de estado sempre acompanha ícone e texto; nunca carrega o significado sozinha.

## Typography

**Display Font:** Geist (com system-ui, Segoe UI, Roboto, sans-serif)
**Body Font:** Geist (mesma família)
**Label/Mono Font:** Geist; `ui-monospace` apenas em `code`

**Character:** Uma voz única. Títulos em 650 com tracking negativo ficam densos e firmes; o corpo em 400 e 1.6 de entrelinha lê bem ao sol e de pé.

### Hierarchy
- **Display** (650, `clamp(2.1rem, 1.1rem + 6.4vw, 4.75rem)`, 1.04, -0.04em): H1 da abertura ("Quer atualizar seu app Intelite?"); palavra em destaque em `brand`.
- **Headline** (650, `clamp(1.75rem, 1.1rem + 2.4vw, 2.75rem)`, 1.08, -0.03em): título de fase (`.phase-head`); painel de conclusão usa escala menor (`clamp(1.5rem, 1rem + 2vw, 2.25rem)`).
- **Title** (650, 1.125rem a 1.5rem, 1.2): H2 e H3, título de passo, nome da solução, veredito.
- **Body** (400, 1rem, 1.6): texto corrido; linhas de apoio de fase limitadas a 60ch.
- **Lead** (400, 1.25rem, 1.45, máx. 34ch, `text-2`): frase de apoio sob o display.
- **Label** (600, 0.875rem): rótulos de campo, botões pequenos, selos, tabela; 0.75rem para tag de download e 0.8125rem para cabeçalho de tabela.
- **KPI** (650, 2.25rem, tabular): números do painel administrativo.

Escala fixa por tokens: `--fs-0` .875rem, `--fs-1` 1rem, `--fs-2` 1.125rem, `--fs-3` 1.25rem, `--fs-4` 1.5rem, `--fs-5` 1.875rem.

### Named Rules
**A Regra da Escala Fixa.** Tamanhos vêm de `--fs-0` a `--fs-5`; apenas display e título de fase são fluidos.
**A Regra dos Números Tabulares.** Contagens, tempos de capítulo, KPIs e tabelas usam `font-variant-numeric: tabular-nums`.
**A Regra do Texto Humano.** Texto digitado por pessoas (nome, empresa, e-mail) usa `.user-text` (`overflow-wrap: anywhere`) e nunca estoura a caixa.

## Layout

Página pública: `.shell` de até 1200px, padding horizontal de 16px (32px a partir de 768px). Abertura (`.hero`) em duas colunas 1.05fr/.95fr a partir de 960px, empilhada abaixo; a ilustração some no celular. O guia (`.guide-grid`) usa colunas 1.25fr/1fr a partir de 1000px com o player fixo (`sticky`, top 88px); abaixo disso o player fica fixo no alto (top 64px, altura máxima 30svh) enquanto os passos rolam, com capítulos em linha rolável. Fases em `.split` de duas colunas a partir de 1000px. Formulários e telas estreitas usam `.container` (720px) ou `.narrow`.

Administração: `.container.wide` de 1240px, KPIs em grade `auto-fill` de 200px, filtros em grade `auto-fit` de 150px, funil de três colunas (rótulo, trilha, valor). Em até 760px a tabela `.cards` vira cartões por linha, com `data-label` como rótulo, sem rolagem horizontal.

Ritmo em base 4: `--s-1` 4, `--s-2` 8, `--s-3` 12, `--s-4` 16, `--s-5` 24, `--s-6` 32, `--s-7` 48, `--s-8` 72. Pontos de quebra usados: 520, 560, 640, 760, 768, 900, 959/960, 999/1000px. Respeita `env(safe-area-inset-*)`.

### Named Rules
**A Regra do Mesmo Caminho.** Quem lê e quem assiste seguem o mesmo percurso: player e passos lado a lado, e o passo ativo permanece à vista do vídeo também no celular.

## Elevation & Depth

Camadas tonais primeiro, brilho como resposta de estado. Em repouso as superfícies são planas: cartões ficam em `surface` com borda `border` de 1px; a hierarquia vem do degrau de grafite. A luz azul difusa marca o que está ativo; sombras escuras e suaves ficam só no player e no diálogo.

### Shadow Vocabulary
- **Sombra 1** (`--shadow-1`: `0 1px 2px rgba(0,0,0,.5)`): contato mínimo.
- **Sombra 2** (`--shadow-2`: `0 18px 40px -12px rgba(0,0,0,.7), 0 2px 6px rgba(0,0,0,.4)`): diálogo e player.
- **Brilho do player** (`0 0 0 1px #000, 0 30px 80px -20px var(--brand-glow), var(--shadow-2)`): halo azul difuso sob o vídeo.
- **Passo ativo** (`0 0 0 1px var(--brand), 0 12px 40px -16px var(--brand-glow)`): `.sub.active`.
- **Opção selecionada** (`0 0 0 1px var(--brand), 0 0 0 6px var(--brand-glow)`): `.opt:has(input:checked)`.
- **Hover do primário** (`0 0 0 6px var(--brand-glow)`): halo do botão primário.
- **Fase atual** (`0 0 14px var(--brand-glow)`): barra de 4px do `.stepper`.

### Named Rules
**A Regra do Brilho Ativo.** Brilho azul só em passo ativo, fase atual, player, seleção e hover do primário. Nunca em repouso, nunca em elemento decorativo.
**A Regra da Superfície Plana.** Em repouso, profundidade é degrau de grafite mais linha de 1px; sombra não separa cartões.

## Shapes

Cantos grandes e consistentes: `--r-sm` 10px (item de navegação, miniatura), `--r-md` 14px (botões, campos, opções, subcartões, aviso, KPI), `--r-lg` 20px (cartões, passos, vereditos, recap, botão grande), `--r-xl` 28px (player, drop, painel de conclusão). Pílulas (999px) para selos, capítulos, tags e barras de progresso. Círculos para número de passo (34px), ponto de lista, play (84px) e confirmação. Linhas de 1px sólidas; tracejado de 1px (`border-input`) para áreas de soltar e estado vazio do player. Foco: contorno de 3px com 3px de distância, raio 6px por padrão.

## Components

### Buttons
- **Shape:** cantos de 14px (`--r-md`); grande (`.lg`) 20px; altura mínima 44px (36px em `.sm`, elevado a 44px em ponteiro grosso; 54px em `.lg`).
- **Primary:** fundo `brand`, texto `brand-contrast`, peso 650. Desabilitado vira `surface-3` com texto `muted` (sem transparência).
- **Padrão:** `surface-2`, borda `border-strong`, peso 600. **Danger:** transparente com texto e borda em `bad`. **Ghost:** transparente, texto `text-2`.
- **Hover (só ponteiro fino):** padrão sobe para `surface-3` e borda `border-input`; primário vai a `brand-hover` com halo de 6px. **Active:** `scale(.97)`. **Foco:** anel `focus` de 3px (branco sobre o primário). Transições de 140ms com `--ease-out`.
- **`.why`:** linha em `muted` sob o botão explicando por que está desabilitado.

### Campos e escolhas (`.opt`, `.check`)
- **Campo de texto:** `surface-2`, borda `border-input`, 14px, 48px de altura, foco com contorno `focus` e borda `brand`; erro por `aria-invalid` em `bad` com mensagem `.field-error` (ícone mais texto). Rótulo `label.field` em 600 e 0.875rem acima do campo.
- **`.opt` (escolha única):** caixa inteira clicável, input nativo transparente cobrindo tudo; 56px mínimo; selecionada fica `brand-soft` com borda `brand` e halo. **`.check`:** selecionada em `ok`/`ok-soft`. Estrelas: ícone de 34px em alvo de 52px, `warn` preenchido quando ligado.

### Cartões
- `.card` (`surface`, 20px, 16px de padding, borda `border`), `.subcard` (`surface-2`, 14px), `.kpi` (`surface`, 14px; rótulo acima, número 2.25rem).

### Passo a passo (`.sub`, `.subs`)
- Cartão de 20px com número circular de 34px (`surface-3`). Ativo: borda `brand`, fundo `surface-2`, halo, número em `brand`. Cada passo acompanha um capítulo do vídeo; clicar leva o vídeo ao capítulo. Linhas internas em `ol.lines` com ponto de 6px; `ol.steps` com contador de 28px.

### Player (`.player`, `.chapters`)
- Moldura de 28px, 16:9, fundo preto, borda `border-strong`, brilho azul difuso. Pôster com botão play circular branco de 84px (hover `scale(1.06)`). Legendas `::cue` em 600 sobre preto 78%. Estado vazio tracejado. Capítulos como pílulas de 40px, atual em `brand-soft`/`brand`, tempo em tabular `faint`; no celular rolam em linha.

### Fases (`.stepper`)
- Quatro colunas, cada fase com barra de 4px no topo: pendente `border-strong`, concluída `ok`, atual `brand` com brilho; número `faint`/`ok`/`brand-text`. Fase bloqueada usa `aria-disabled` e cursor `not-allowed`. Cor da barra anima em 220ms.

### Vereditos (`.verdict`)
- Dois cartões grandes (20px, 132px mínimo, 24px de padding) para "tela correta" e "tela com problema": ícone de 28px, título 1.125rem, descrição `muted`. Bom: borda `ok`; problema: ícone `warn`. Hover borda `brand`, active `scale(.985)`.

### Foto (`.drop`, `.shots`)
- Área de soltar tracejada de 28px, ícone `brand` de 36px; miniaturas 4:3 de 14px em grade `auto-fill` de 150px.

### Resumo e conclusão (`.recap`, `.done-panel`)
- `.recap`: lista em cartão de 20px com divisórias de 1px e selos à direita. `.done-panel`: 28px, fundo `ok-soft`, borda `ok` a 40%, marca circular de 56px.

### Download (`.dl`)
- Lista de links com divisória de 1px e 52px de altura; o link direto vira botão `brand` de 14px com tag em `brand-contrast`. Tags em pílula `surface-3`. Hover desloca o padding horizontal.

### Selos e avisos (`.badge`, `.alert`)
- Selo em pílula com ícone de 14px: neutro, `ok`, `warn`, `bad`, `info`. Aviso de 14px com ícone de 18px, fundo suave e borda mista de 35 a 40% da cor de estado; `role` `alert`, `status` ou `note`.

### Navegação
- Barra superior pública (`.topbar`): sticky, 64px mínimo, fundo `bg` a 94% com borda inferior, logo de 30px, sem menu. Navegação admin (`.admin-nav`): `surface`, links de 40px e 10px de raio, atual em `brand-soft`/`brand-text`, logo de 28px. Link de pular conteúdo (`.skip-link`) branco sobre preto.

### Admin: funil, tabela
- Funil: trilha de 12px `viz-track` com preenchimento `viz-1` (#4c9bff, matiz única). Tabela: cabeçalho `muted` 0.8125rem, linhas com divisória, números tabulares; em celular vira cartões.

### Movimento
- `--ease-out` `cubic-bezier(.23, 1, .32, 1)`; `--t-fast` 140ms (hover, foco), `--t-med` 220ms (passo ativo, progresso, fase). Entrada de fase `phase-in` 360ms (10px de subida); abertura `.rise` 640ms com atraso de 90ms por item; ilustração flutua 7s. Esqueleto (shimmer 1.4s) e spinner (.7s). Tudo isso só em `prefers-reduced-motion: no-preference`.

## Do's and Don'ts

### Do:
- **Do** usar `brand` (#4c9bff) apenas para ação, progresso e passo ativo; verde, âmbar e coral só como estado.
- **Do** referenciar sempre tokens (`var(--surface-2)`, `var(--r-md)`, `var(--s-4)`), nunca valores soltos.
- **Do** manter alvos de toque de 44px ou mais, anel de foco de 3px (`focus`) e limite de campo em `border-input` (3:1 mínimo).
- **Do** acompanhar toda cor de estado com ícone e texto (`Alert`, `.badge`, `.field-error`).
- **Do** usar o conjunto único de ícones SVG de `ui.tsx` (traço 1.75, `currentColor`).
- **Do** envolver animações em `prefers-reduced-motion: no-preference` e manter hover só em `(hover: hover) and (pointer: fine)`.
- **Do** manter o passo ativo à vista do vídeo, também no celular (player fixo no alto).
- **Do** aplicar `.user-text` em texto digitado por pessoas e `tabular-nums` em números.

### Don't:
- **Don't** introduzir um segundo acento nem usar azul como decoração em repouso.
- **Don't** usar emoji nem glifos Unicode como ícone.
- **Don't** usar o brilho azul em elementos em repouso; ele indica estado ativo.
- **Don't** separar cartões por sombra pesada; profundidade é degrau de grafite mais linha de 1px.
- **Don't** transformar a página em acordeão de etapas travadas nem em pilha de cartões iguais.
- **Don't** depender só de cor para estado, nem usar texto abaixo de 4.5:1 sobre as superfícies.
- **Don't** usar vermelho ou verde para decorar; são resposta a erro ou conferência.
