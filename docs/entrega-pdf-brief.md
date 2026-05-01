# Brief — Gerar PDF do documento de entrega com identidade visual do app

> Use este texto como **prompt** para a IA que vai gerar o PDF. Anexe junto
> os dois arquivos: `docs/entrega.md` (conteúdo) e `public/logo_scottybons.png` (logo).

---

## Prompt para a IA geradora

Quero que você gere um **PDF profissional em formato A4** a partir do
arquivo `entrega.md` em anexo. O PDF é um documento de **entrega de
projeto** para um cliente corporativo (rede Padoque / Scotty Bons),
então precisa ter aparência limpa, moderna e editorial — não panfleto.

### Abordagem recomendada

Gere **HTML + CSS com regras `@page` / Paged Media** e converta para PDF
(Puppeteer, WeasyPrint, Prince ou equivalente). Essa abordagem respeita
melhor a tipografia e permite capa, sumário e cabeçalho/rodapé.

### Identidade visual (obrigatória)

Use exatamente as mesmas cores e tipografia do app original:

**Paleta (HSL → hex aproximado):**

| Token | HSL | Hex | Uso |
|-------|-----|-----|-----|
| Primary (laranja Scotty) | `hsl(32, 95%, 58%)` | `#F69C3D` | Títulos de seção, destaque, links, barra lateral da capa |
| Primary light | `hsl(32, 100%, 95%)` | `#FFF1E1` | Fundos sutis de callout / cards |
| Foreground | `hsl(0, 0%, 3.9%)` | `#0A0A0A` | Texto principal |
| Muted foreground | `hsl(0, 0%, 45%)` | `#737373` | Texto secundário, legendas, rodapé |
| Background | `hsl(0, 0%, 97%)` | `#F7F7F7` | Fundo geral (páginas internas: branco puro `#FFFFFF` funciona melhor para impressão) |
| Border | `hsl(0, 0%, 91%)` | `#E8E8E8` | Bordas de tabela, separadores |
| Success | `hsl(106, 100%, 33%)` | `#099500` | Checks da lista de entregáveis |
| Warning | `hsl(38, 92%, 50%)` | `#F59E0B` | Callouts de atenção |
| Destructive | `hsl(0, 72%, 51%)` | `#DC2626` | Apenas se precisar marcar alerta crítico |

**Tipografia:**
- Fonte principal: **Geist** (Google Fonts). Fallback: Inter → system-ui → sans-serif.
- Hierarquia:
  - H1 (capa): 48px, weight 700, letter-spacing -0.02em
  - H1 (seção): 32px, weight 700, cor primary
  - H2: 22px, weight 600
  - H3: 17px, weight 600
  - Corpo: 11px, line-height 1.6
  - Tabelas: 10px
  - Legenda/rodapé: 9px

**Estilo geral (copiar o visual do app, que é shadcn/ui):**
- Cantos arredondados **12px** em cards, tabelas e callouts (`--radius: 0.75rem`)
- Bordas finas (1px) em cinza claro, nunca pretas
- **Nada de sombras dramáticas** — no máximo `0 1px 2px rgba(0,0,0,0.04)`
- Espaçamento generoso (respiração editorial, não denso)

### Estrutura do PDF

1. **Capa (página 1 inteira):**
   - Logo `logo_scottybons.png` no topo (altura ~80px)
   - Barra vertical fina cor primary à esquerda (ocupa a altura da página)
   - Título **"Scotty-Ops"** em H1 gigante
   - Subtítulo **"Apresentação de Entrega"** em H2 cor muted-foreground
   - Bem embaixo da página: *"Delivered on April 17, 2026"* e *"Official handover document for the Padoque store network"*

2. **Página 2 — Sumário automático** com números de página. Título "Table of Contents" na cor primary.

3. **Páginas seguintes — conteúdo do `entrega.md`** renderizado com:
   - Cada seção numerada (1, 2, 3…) começa em **página nova** (`page-break-before: always` no H1 de seção).
   - Título de seção numerado como badge circular laranja + texto (ex.: `[ 3 ]  System modules`).
   - Blockquotes viram **callout box**: fundo `#FFF1E1` (primary-light), borda esquerda 3px cor primary, padding 16px 20px, cantos arredondados.
   - Tabelas: cabeçalho com fundo `#F7F7F7` e texto em peso 600; linhas alternadas opcionais em `#FAFAFA`; bordas apenas horizontais (sem grade completa); padding confortável (10px 14px).
   - Listas: bullets cor primary; checkboxes `[x]` renderizados com ícone ✓ em verde (`#099500`).
   - Código inline e blocos: fundo `#F4F4F4`, fonte mono, 10px, borda arredondada.
   - Links: cor primary, sem sublinhado, weight 500.

4. **Cabeçalho de página (a partir da página 3):** à esquerda "Scotty-Ops · Handover", à direita o nome da seção corrente. Fonte 9px cor muted, linha separadora fina embaixo.

5. **Rodapé de página:** à esquerda "Padoque — Confidential document", à direita `page X of Y`. Fonte 9px cor muted.

### Regras de quebra e formatação

- H1/H2 **não podem** ficar órfãos no fim da página (`page-break-after: avoid`).
- Tabelas pequenas não devem ser cortadas entre páginas.
- Evitar viúvas/órfãs no corpo de texto (mínimo 2 linhas).
- Margens de página: topo 22mm, base 20mm, laterais 20mm.
- Tabelas com muitas colunas podem ficar em 10px e usar `table-layout: fixed`.

### Saída esperada

Um **único arquivo PDF**, formato A4, entre 15 e 25 páginas, com capa,
sumário e as 11 seções do `entrega.md` renderizadas com o visual acima.
Nome do arquivo: `scotty-ops-entrega.pdf`.

---

### Observações

- O conteúdo do `entrega.md` **não deve ser alterado** — apenas estilizado.
  Se identificar algum erro de digitação evidente, apontar em comentário
  separado, não alterar silenciosamente.
- Tanto a interface do app quanto **este documento são em inglês** — manter assim.
- Se o gerador não aceitar a fonte Geist, usar **Inter** como fallback (muito próximo).
- Se não conseguir usar Paged Media / `@page`, aceitar como alternativa
  uma saída **Markdown estilizado + Pandoc com template LaTeX**, desde
  que as cores e hierarquia sejam respeitadas.
