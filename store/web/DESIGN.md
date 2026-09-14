# OtakuVerso — Design system (web)

## Tema

**Dark Akihabara / neo-Tokyo.** Fundo quase-preto com um leve grid neon e brilhos
de gradiente nos cantos (evocando uma vitrine de eletrônicos noturna de Akihabara),
tipografia geométrica de destaque e acentos neon para ações e estados interativos.
`html` carrega `class="dark"` e `color-scheme: dark` fixo — não há tema claro no MVP.

## Paleta de tokens (`tailwind.config.ts`)

| Token | Valor | Uso |
|---|---|---|
| `ink-950` | `#07060d` | Fundo da página (`body`) |
| `ink-900` | `#0e0c1a` | Fundo de header/superfícies elevadas |
| `ink-800` | `#17142a` | Cards, painéis |
| `ink-700` | `#242040` | Bordas, divisores |
| `fg` | `#f4f2ff` | Texto principal |
| `muted` | `#a9a3c7` | Texto secundário |
| `neon-pink` | `#ff2e88` | Acento primário (CTAs, preço, destaque de marca) |
| `neon-cyan` | `#22e4ff` | Foco de teclado, links ativos, acento secundário |
| `neon-violet` | `#9d5cff` | Acento decorativo (badges, gradientes) |
| `neon-lime` | `#b6ff3b` | Sucesso / disponibilidade em estoque |

### Contraste (AA)

- `fg` (`#f4f2ff`) sobre `ink-950` (`#07060d`) → razão de contraste ≈ 17.6:1 (AAA).
- `muted` (`#a9a3c7`) sobre `ink-950` → razão ≈ 8.1:1 (AAA para texto normal).
- `fg` sobre `ink-900`/`ink-800` → ambos acima de 14:1.
- Os tons `neon-*` são usados como acentos (bordas, ícones, glows), nunca como
  cor de texto de corpo sobre `ink-950`, para preservar contraste AA em texto.

## Foco visível

Regra global em `src/index.css`: `:focus-visible { @apply outline-none ring-2
ring-neon-cyan ring-offset-2 ring-offset-ink-950; }`. Todo elemento interativo
(links, botões, campos) herda esse anel neon-cyan ao navegar por teclado.

## Tipografia

- **Corpo:** stack `sans` (`Inter`, `Noto Sans JP`, `system-ui`) — boa cobertura
  latina e japonesa (nomes de produto/franquias).
- **Destaque/display:** stack `display` (`Space Grotesk`, `Noto Sans JP`,
  `system-ui`) para títulos e marca, com traço geométrico que remete a letreiros
  neon.

## Breakpoints (mobile-first)

Usa a escala padrão do Tailwind sem customização: o layout é construído
mobile-first (estilos base valem para telas pequenas) e progressivamente
ajustado com `sm` (≥640px), `md` (≥768px), `lg` (≥1024px) e `xl` (≥1280px) —
por exemplo, grades de catálogo que vão de 1 coluna no mobile a 4+ em `lg`.
