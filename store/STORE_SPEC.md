# STORE_SPEC.md — OtakuVerso

> Especificação de produto **e backlog priorizado** da loja que o Minion Console vai
> construir sozinho (ver `minion/SPEC.md`). Este documento descreve **o que** a loja
> precisa ter, **com quais tecnologias**, e — diferente da versão anterior — traz um
> **TODO cronológico** (seção 13) na ordem em que os itens devem ser implementados.
>
> **Regra de ouro (vale para TODO item do backlog): a implementação começa sempre
> pelos testes.** Escreve-se o teste que falha, depois o código que o faz passar
> (TDD, red → green → refactor). Nenhum item é considerado pronto sem teste.
>
> O nome **OtakuVerso** é a marca padrão; trocá-lo é uma mudança de uma linha de
> config (`store/config/brand.ts`).

---

## 1. Visão

Uma loja online de produtos otaku/geek para o público brasileiro: colecionáveis,
mídia e vestuário de anime/mangá/games, com a experiência de compra no nível de um
grande e-commerce (busca central, página de produto rica, avaliações, favoritos,
carrinho, checkout, conta e um clube de assinatura premium). O cliente descobre um
produto, vê fotos e avaliações, adiciona ao carrinho, simula o pagamento e recebe a
confirmação por e-mail.

O diferencial não é reinventar o comércio eletrônico — é **espelhar as boas práticas
da Amazon** num nicho otaku, com um front-end polido (loadings, toasts, estados
vazios/de erro) e uma base testada de ponta a ponta.

## 2. Público-alvo, concorrentes e referências

- **Público:** otakus e geeks brasileiros, colecionadores, presenteadores.
- **Referência de UX de e-commerce (obrigatória):** **Amazon.com.br** — busca central
  no topo, mega-menu de categorias, "buy box" na página de produto, avaliações com
  nota e histograma, lista de desejos, histórico de pedidos, assinatura (Prime).
- **Concorrentes brasileiros do nicho para se espelhar (catálogo, categorias, tom):**
  - **Piticas** e **Chico Rei** — vestuário geek/anime (linhas de camisetas licenciadas).
  - **NerdStore** e **Comix** — e-commerce geek amplo (figures, colecionáveis, presentes).
  - **Pens and Dolls**, **Otaku Storie**, **GG Anime Store**, **Otaku Studio**,
    **Anime Hunter** — action figures e mangás (sortimento e nomenclatura de nicho).
- **O que copiar de cada um:** amplitude de catálogo e categorização do nicho (das
  lojas otaku), qualidade de página de produto e busca/checkout (da Amazon), e a
  pegada de vestuário licenciado (Piticas/Chico Rei).

## 3. Catálogo — tipos de produto

| Categoria | Exemplos | Opções/variações |
|---|---|---|
| **Action Figures & Estátuas** | Nendoroid, escala 1/7, Figuarts, POP UP PARADE | edição (padrão/limitada), escala |
| **Mangás & Light Novels** | volumes avulsos, box sets | volume, edição (normal/deluxe) |
| **Vestuário** | camisetas, moletons, cosplay casual | tamanho (PP–GG), cor |
| **Acessórios** | chaveiros, pins/bottons, colares | — |
| **Papelaria & Decoração** | pôsteres, wall scrolls, mousepads, canecas | tamanho/estampa |
| **Pelúcias** | plushies de personagens | tamanho |
| **Games & Cards** | TCG, jogos, mangá-games | — |
| **Premium/Import** | itens exclusivos e importados | — |

Regras de catálogo:
- Todo produto tem **descrição**, **ficha técnica/configurações** (variações), **preço**,
  **estoque**, **categoria**, **fotos** e **avaliações**.
- Produtos com variação (tamanho/cor/edição) têm **variantes** com preço/estoque próprios.
- 6–8 categorias fixas no MVP; catálogo semeado (seed) com ~24–40 produtos.

## 4. Modelo de domínio (entidades)

`User`, `Product`, `ProductVariant`, `Category`, `ProductImage`, `Review`,
`WishlistItem`, `Cart`, `CartItem`, `Coupon`, `Order`, `OrderItem`, `Payment` (mock),
`PremiumMembership`, `ContactMessage`, `EmailLog` (registro dos e-mails simulados).

Relacionamentos-chave: `Product 1—N Variant`, `Product 1—N Image`, `Product 1—N Review`,
`User 1—N Review/Order/WishlistItem`, `Order 1—N OrderItem`, `User 1—1 PremiumMembership`.

## 5. Regras de negócio (para validação objetiva)

- **Preço final** = (preço base da variante + adicionais) → aplica **cupom** sobre o
  **subtotal** (itens já com variação, nunca sobre o frete) → soma **frete** por
  **último** (valor fixo por pedido). O cálculo é **idêntico** em vitrine, carrinho e
  checkout (mesma função pura compartilhada).
- **Edição limitada** (somente figures): +20% sobre o preço base da variante, aplicado
  **antes do frete** e **depois** de outros adicionais.
- **Premium (OtakuVerso Prime):** frete grátis, 5% de desconto adicional no subtotal e
  acesso antecipado a lançamentos. O desconto premium incide **antes** do cupom? Não —
  ordem canônica: adicionais → cupom → **desconto premium** sobre o resultado → frete
  (grátis se premium). Documentar num único módulo de pricing testado.
- **Estoque:** não permite comprar acima do estoque da variante; carrinho valida no add
  e no checkout.
- **Avaliação (review):** nota 1–5 + texto; só **usuário logado**; um review por produto
  por usuário; a nota média e o histograma do produto derivam dos reviews.
- **Checkout** exige login; pagamento é **mock** (sem gateway real); confirmação e
  e-mail de envio são **mock** (registrados em `EmailLog` e visíveis no MailHog).
- **Nenhum item entra no carrinho** sem todas as opções obrigatórias de variação escolhidas.

## 6. O que o usuário pode fazer (funcionalidades)

1. **Buscar** produtos (busca central estilo Amazon) e **filtrar** (categoria, preço,
   disponibilidade, nota) e **ordenar**.
2. Ver **página de produto** rica: galeria de fotos, variações, descrição, ficha,
   avaliações (nota média + histograma + lista), produtos relacionados.
3. **Favoritar** (wishlist) e gerenciar a lista.
4. **Adicionar ao carrinho**, ajustar quantidades, aplicar **cupom**.
5. **Cadastrar/login** (e-mail + senha; sem verificação real de e-mail).
6. **Checkout** com resumo (itens + variação + preço final), **pagamento simulado** e
   **confirmação**; recebe **e-mail de envio** (mock).
7. Ver **histórico de pedidos** na conta e gerenciar **perfil/endereço**.
8. **Escrever avaliações** (logado) e ver as próprias.
9. **Enviar mensagem de contato** (formulário "Fale conosco" com motivo).
10. **Assinar o Premium** (OtakuVerso Prime) e usufruir dos benefícios.

## 7. Páginas e navegação

- **Home:** hero/banner de lançamento, carrossel de destaques, categorias em destaque,
  mais vendidos, lançamentos, faixa "Prime", avaliações em destaque, newsletter.
- **Header (fixo):** logo, **busca central**, menu de conta (login/conta/pedidos/
  favoritos), carrinho, atalho Premium. **Mega-menu** de categorias.
- **Resultados de busca/categoria:** grid de produtos + filtros laterais + ordenação +
  paginação, com **skeletons** no carregamento e **estado vazio**.
- **Produto:** galeria, variações, buy box (preço, quantidade, add ao carrinho,
  favoritar), abas descrição/ficha, avaliações, relacionados.
- **Carrinho:** itens com variação, quantidades, cupom, resumo de preço.
- **Checkout:** login-gated, resumo, endereço, pagamento mock, confirmação.
- **Conta:** pedidos, favoritos, perfil, status Premium.
- **Premium:** landing com benefícios + adesão + área do membro.
- **Contato:** formulário "Fale conosco".
- **Footer:** institucional, ajuda, políticas, contato, redes.

## 8. Design & UX (escolhido pelo agente)

O **agente escolhe o design** — não fixamos cores/tipografia aqui. Ele deve definir um
tema coeso e adequado à marca otaku (o agente decide a direção visual; uma pegada
"Akihabara/neo-Tokyo" é sugestão, não regra) e registrá-lo no design system.

**Obrigatório (boas práticas de front-end), em todas as telas relevantes:**
- **Loadings**: skeletons/spinners em toda busca/carregamento assíncrono.
- **Toasts** para ações (adicionado ao carrinho, favoritado, erro de estoque, etc.).
- **Notification messages / feedback**: sucesso, erro, aviso, com acessibilidade
  (`aria-live`).
- **Empty states** (carrinho vazio, sem resultados, sem pedidos) e **error states**
  (falha de rede, 404) com ação de recuperação.
- **Validação de formulário** clara (inline), **otimistic UI** onde fizer sentido.
- **Responsivo** (mobile-first) e **acessível** (navegação por teclado, contraste, alt em
  imagens, foco visível).

## 9. Fotos de produto (encontradas pelo agente)

- As imagens dos produtos são **buscadas pelo agente** no momento do seed (via web
  search/Tavily e lookup de imagens), armazenando **URLs** por produto/variante.
- **Cuidado de licenciamento:** priorizar imagens de imprensa/oficiais ou claramente
  livres; quando não houver, usar **placeholders** (`placehold.co`/similar) rotulados.
  O objetivo é uma vitrine realista para demonstração, não uso comercial.
- Cada produto tem 1 imagem principal + 2–4 secundárias quando disponível.

## 10. Stack tecnológica (aplicação real)

Monorepo dentro deste repositório, na pasta `store/`:

```
store/
  api/         Backend  — Node + TypeScript + Fastify + Prisma
  web/         Frontend — React + TypeScript + Vite + Tailwind
  shared/      Tipos e o módulo de pricing (puro, compartilhado FE/BE)
  e2e/         Testes Playwright da jornada completa
  docker-compose.yml   Postgres + MailHog
  minion.config.json não — fica na raiz do repo (ver minion/SPEC.md §9.4)
```

- **Backend:** Fastify + TypeScript, **Prisma ORM**, **PostgreSQL** (via Docker),
  validação com **Zod**, auth **JWT + bcrypt**.
- **Frontend:** React + Vite + TypeScript, **Tailwind CSS** (design system),
  **TanStack Query** (data fetching + estados de loading/erro), **React Router**,
  **react-hook-form + Zod** (formulários), sistema de **toast**.
- **Banco/persistência via Docker:** `docker-compose` sobe **Postgres** e **MailHog**
  (captura os e-mails mock para inspeção). App também pode rodar containerizada.
- **Pagamento:** serviço **mock** (sem gateway real), com estados aprovado/recusado.
- **E-mail:** `nodemailer` apontando para o **MailHog**; todo envio também grava em
  `EmailLog` (para asserção em teste).
- **Testes:** **Vitest** (unitário/integração FE e BE), **Playwright** (E2E).
- **Lint/format:** **ESLint + Prettier**, **TypeScript strict**.
- **Scripts padronizados** (consumidos pelo harness do Minion via `minion.config.json`):
  `lint`, `test` (unit+integração), `test:e2e`, `db:up`, `db:migrate`, `db:seed`.

## 11. Estratégia de testes (TDD obrigatório)

- **Todo item começa pelos testes** (red → green → refactor). Ordem dentro do item:
  1. escrever teste unitário/integração que falha,
  2. implementar o mínimo para passar,
  3. refatorar com os testes verdes.
- **Unitário — backend:** regras de negócio (pricing, estoque, cupom, premium), handlers,
  validação Zod.
- **Unitário — frontend:** componentes (estados de loading/erro/vazio), hooks, o módulo
  de pricing compartilhado.
- **Integração — backend:** endpoints contra o Postgres de teste (Docker).
- **E2E — Playwright:** a jornada completa (home → busca → produto → favoritar → carrinho
  → cupom → checkout → confirmação → e-mail no MailHog) + fluxos de login e review.
- **Cobertura mínima** nas regras de negócio: caminho feliz **e** ao menos um caso de
  borda por regra.
- O **preço deve dar o mesmo resultado** em vitrine, carrinho e checkout (teste que
  cruza os três).

## 12. Definition of Done (global)

- [ ] `store/` sobe com `docker-compose up` (Postgres + MailHog) e `db:migrate && db:seed`.
- [ ] `lint`, `test` e `test:e2e` passam limpos.
- [ ] FR essenciais (seção 6, itens 1–10) implementadas e cobertas por testes.
- [ ] Nenhuma regra de preço/validação diverge da seção 5.
- [ ] Front-end com loadings, toasts, notifications e estados vazio/erro em todas as telas.
- [ ] Imagens de produto presentes (encontradas pelo agente) e design coeso aplicado.
- [ ] Jornada completa passa na suíte E2E; e-mail de confirmação aparece no MailHog.
- [ ] Premium funcional (benefícios aplicados no pricing) — se o MVP já estiver 100%.

---

## 13. Backlog priorizado — o TODO cronológico

> Ordem = prioridade de execução, seguindo um padrão de desenvolvimento (fundação →
> domínio/dados → API testada → front-end → features → premium → qualidade/E2E).
> **Cada item começa pelos testes** (seção 11). `peso`: `mvp` (bloqueia entrega) ou
> `nice` (só depois do MVP 100%). `dep`: ids dos itens de que depende.

### Épico 0 — Fundação & tooling

- **FND-1 · Scaffold do monorepo `store/`** — workspaces `api`/`web`/`shared`/`e2e`,
  `tsconfig` strict, `package.json` com scripts padronizados. `dep: —` · `mvp`
  *Aceite:* `npm run typecheck` e `npm test` rodam (mesmo sem testes ainda);
  estrutura de pastas conforme §10.
- **FND-2 · Lint & format** — ESLint + Prettier + regras TS strict, script `lint`.
  `dep: FND-1` · `mvp` *Aceite:* `npm run lint` passa num arquivo de exemplo.
- **FND-3 · Docker de infra** — `docker-compose.yml` com Postgres + MailHog; scripts
  `db:up`/`db:down`. `dep: FND-1` · `mvp` *Aceite:* `docker-compose up` sobe ambos;
  healthcheck de conexão testado.
- **FND-4 · Prisma + migração inicial vazia** — Prisma conectado ao Postgres, script
  `db:migrate`. `dep: FND-3` · `mvp` *Aceite:* migração roda; teste de conexão verde.
- **FND-5 · Harness base do backend** — Fastify app + rota `GET /health` (TDD como
  exemplo do padrão) + Vitest configurado. `dep: FND-1` · `mvp` *Aceite:* teste de
  `/health` escrito **primeiro**, depois a rota; verde.
- **FND-6 · `minion.config.json` na raiz** — declara `commands.lint/test/e2e`,
  `frontendGlobs` (`store/web/**`), evals e paralelismo. `dep: FND-1,FND-2` · `mvp`
  *Aceite:* Minion lê a config e roda os comandos reais da store.

### Épico 1 — Domínio & dados

- **DOM-1 · Módulo de pricing compartilhado (`shared`)** — função pura de cálculo
  (adicionais → cupom → premium → frete; edição limitada) com testes de caminho feliz
  e bordas. `dep: FND-1` · `mvp` *Aceite:* testes cobrindo cada regra da §5.
- **DOM-2 · Schema Prisma completo** — todas as entidades da §4 + migração. `dep: FND-4`
  · `mvp` *Aceite:* migração aplica; testes de constraints principais.
- **DOM-3 · Seed do catálogo + imagens (agente busca fotos)** — script de seed com
  6–8 categorias e ~24–40 produtos; **o agente busca as URLs de imagem** (§9).
  `dep: DOM-2` · `mvp` *Aceite:* `db:seed` popula; cada produto tem ≥1 imagem; teste
  conta itens/categorias.

### Épico 2 — Backend API (TDD, cada endpoint teste-primeiro)

- **API-1 · Catálogo: listar/filtrar/ordenar/paginar** `GET /products`. `dep: DOM-2,DOM-3`
  · `mvp`
- **API-2 · Busca de produtos** `GET /products/search?q=` (nome/descrição/categoria).
  `dep: API-1` · `mvp`
- **API-3 · Detalhe do produto** `GET /products/:id` (com variantes, imagens, nota média,
  histograma). `dep: DOM-2` · `mvp`
- **API-4 · Auth** `POST /auth/register`, `POST /auth/login`, `GET /auth/me` (JWT+bcrypt,
  validação Zod). `dep: DOM-2` · `mvp`
- **API-5 · Reviews** `GET/POST /products/:id/reviews` (só logado; 1 por usuário/produto).
  `dep: API-3,API-4` · `mvp`
- **API-6 · Wishlist/favoritos** `GET/POST/DELETE /wishlist`. `dep: API-4` · `mvp`
- **API-7 · Carrinho** `GET/POST/PATCH/DELETE /cart` (valida estoque e variação
  obrigatória; usa DOM-1). `dep: API-3,API-4,DOM-1` · `mvp`
- **API-8 · Cupom** aplicar no carrinho (`POST /cart/coupon`), incide no subtotal.
  `dep: API-7` · `mvp`
- **API-9 · Checkout + pagamento mock + pedido** `POST /checkout` (login-gated, cria
  `Order`, `Payment` mock aprovado/recusado). `dep: API-7,API-8` · `mvp`
- **API-10 · E-mail de confirmação/envio (mock → MailHog + EmailLog)** disparado no
  checkout. `dep: API-9,FND-3` · `mvp` *Aceite:* teste verifica `EmailLog` e (integração)
  o e-mail no MailHog.
- **API-11 · Histórico de pedidos** `GET /orders`. `dep: API-9` · `mvp`
- **API-12 · Contato "Fale conosco"** `POST /contact` (grava `ContactMessage`, e-mail mock).
  `dep: FND-5` · `mvp`
- **API-13 · Premium (Prime)** `POST /premium/subscribe`, `GET /premium/status`; benefícios
  entram no DOM-1. `dep: API-4,DOM-1` · `nice`

### Épico 3 — Frontend: fundação

- **WEB-1 · App Vite + Router + TanStack Query + camada de API** (client tipado).
  `dep: FND-1` · `mvp`
- **WEB-2 · Design system (agente escolhe o tema)** — tokens (cores/tipografia),
  componentes base (Button, Input, Card, Badge, Rating), tema coeso (§8). `dep: WEB-1`
  · `mvp` *Aceite:* testes de componente; tema documentado em `store/config/brand.ts`.
- **WEB-3 · Sistema de Toast + Notifications** (com `aria-live`). `dep: WEB-2` · `mvp`
- **WEB-4 · Estados de Loading (skeletons) / Empty / Error** reutilizáveis. `dep: WEB-2`
  · `mvp`
- **WEB-5 · Layout: Header + busca central + mega-menu + Footer** responsivos. `dep: WEB-2`
  · `mvp`
- **WEB-6 · Auth no front (contexto, login/registro, rotas protegidas)** consumindo API-4.
  `dep: WEB-1,API-4` · `mvp`

### Épico 4 — Frontend: páginas & features

- **WEB-7 · Home** (hero, carrosséis, destaques, faixa Prime). `dep: WEB-5,API-1` · `mvp`
- **WEB-8 · Resultados de busca/categoria** (grid + filtros + ordenação + paginação +
  skeleton + empty). `dep: WEB-5,API-1,API-2` · `mvp`
- **WEB-9 · Página de produto** (galeria, variações, buy box, abas, relacionados).
  `dep: WEB-5,API-3` · `mvp`
- **WEB-10 · Reviews na página de produto** (nota média, histograma, lista, form logado).
  `dep: WEB-9,API-5,WEB-6` · `mvp`
- **WEB-11 · Favoritar (botão + página de wishlist)** com toast e optimistic UI.
  `dep: WEB-9,API-6,WEB-3` · `mvp`
- **WEB-12 · Carrinho** (itens, quantidades, cupom, resumo via DOM-1). `dep: WEB-9,API-7,API-8`
  · `mvp`
- **WEB-13 · Checkout + confirmação** (login-gated, resumo, endereço, pagamento mock,
  tela de confirmação). `dep: WEB-12,API-9,WEB-6` · `mvp`
- **WEB-14 · Conta** (pedidos, favoritos, perfil). `dep: WEB-6,API-11,API-6` · `mvp`
- **WEB-15 · Contato "Fale conosco"** (form validado + toast). `dep: WEB-5,API-12,WEB-3`
  · `mvp`
- **WEB-16 · Premium (landing + adesão + área do membro)** com benefícios refletidos no
  pricing/checkout. `dep: WEB-13,API-13` · `nice`

### Épico 5 — Qualidade, jornada & polimento

- **QA-1 · E2E da jornada completa (Playwright)** — home → busca → produto → favoritar →
  carrinho → cupom → checkout → confirmação → e-mail no MailHog. `dep: WEB-13,API-10`
  · `mvp`
- **QA-2 · E2E de login + review** — registrar/logar, avaliar produto, ver review.
  `dep: WEB-10` · `mvp`
- **QA-3 · Acessibilidade & responsivo** — passes de teclado/contraste/alt e breakpoints.
  `dep: WEB-7..WEB-15` · `mvp`
- **QA-4 · Cobertura & lint final** — thresholds nas regras de negócio; `lint` zero
  warnings. `dep: (todos os anteriores)` · `mvp`
- **QA-5 · E2E do Premium** — assinar, ver frete grátis/desconto no checkout. `dep: WEB-16`
  · `nice`

### Nice-to-have (só com MVP 100%)

- **NICE-1 · Área premium com conteúdo exclusivo / acesso antecipado a lançamentos.**
- **NICE-2 · Upload de imagem de referência para personalização.**
- **NICE-3 · Recomendações "frequentemente comprados juntos" (estilo Amazon).**
- **NICE-4 · Newsletter funcional (mock) + cupom de boas-vindas.**

---

**Como o Minion consome este documento:** o `roadmap-planner` decompõe as seções 3–12
em itens atômicos, usa a seção 13 como **guia de prioridade e dependências**, o
`backlog-judge` confere cobertura, e o loop de despacho executa respeitando `dep` e os
locks de arquivo — cada item entregue via blueprint da §5.2 do `minion/SPEC.md`, sempre
começando pelos testes.
