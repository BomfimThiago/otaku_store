# OtakuVerso — Design system (web)

## Tema

**Light, clean marketplace.** Fundo branco/quase-branco, cards com borda sutil e
sombra suave, tipografia geométrica de destaque e acentos coloridos (rosa,
teal, violeta) reservados para ações e estados interativos. `html` não carrega
mais `class="dark"` e `color-scheme: light` é fixo no `:root`.

## Paleta de tokens (`tailwind.config.ts`)

| Token | Valor | Uso |
|---|---|---|
| `ink-950` | `#f6f6f9` | Fundo da página (`body`) |
| `ink-900` | `#ffffff` | Fundo de header/cards/superfícies elevadas |
| `ink-800` | `#eeeef3` | Inputs, hover, skeletons, footer |
| `ink-700` | `#e3e3ec` | Bordas, divisores |
| `ink-600` | `#b9b6c8` | Estrelas vazias, divisores mais fortes |
| `fg` | `#17151f` | Texto principal |
| `muted` | `#6b6580` | Texto secundário |
| `neon-pink` | `#d6246e` | Acento primário (CTAs, preço, destaque de marca) |
| `neon-cyan` | `#0e7490` (teal escuro) | Foco de teclado, links ativos, acento secundário |
| `neon-violet` | `#7c3aed` | Acento decorativo (badges, gradientes) |
| `neon-lime` | `#2f7d32` | Sucesso / disponibilidade em estoque |

### Contraste (AA)

- `fg` (`#17151f`) sobre `ink-950` (`#f6f6f9`) → razão de contraste ≈ 16.7:1 (AAA).
- `muted` (`#6b6580`) sobre branco → razão ≈ 5.5:1; sobre `ink-950` → ≈ 5.1:1 (AA para texto normal).
- `neon-cyan` (`#0e7490`) sobre branco → razão ≈ 5.4:1 (AA).
- Texto branco sobre `neon-pink` (`#d6246e`) → razão ≈ 4.8:1 (AA).
- Os tons `neon-*` são usados como acentos (bordas, ícones, botões), com texto
  branco sobre fundos coloridos escolhido para manter contraste AA.

## Foco visível

Regra global em `src/index.css`: `:focus-visible { @apply outline-none ring-2
ring-neon-cyan ring-offset-2 ring-offset-white; }`. Todo elemento interativo
(links, botões, campos) herda esse anel teal ao navegar por teclado.

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
