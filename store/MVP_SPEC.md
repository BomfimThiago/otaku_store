# MVP_SPEC.md — OtakuVerso (MVP deployável)

> Spec **enxuta e self-contained** da loja OtakuVerso, feita para o Minion construir e
> para um avaliador **testar num clique**. É um recorte deployável da visão completa em
> `store/STORE_SPEC.md` (esta versão remove Docker/Postgres para poder subir como **um
> único serviço Node**).
>
> **Regra de ouro (todo item começa pelos testes — TDD, red → green → refactor).**
> **Marca:** OtakuVerso. **Escopo do MVP:** vitrine → página de produto → carrinho.

## 1. Objetivo e restrições

Uma loja de produtos otaku onde o cliente **navega os produtos**, **abre um produto**
(fotos, variações, preço) e **adiciona ao carrinho** (ajusta quantidade, vê o total).

- **Self-contained:** sem Docker, sem Postgres, sem Prisma. O **catálogo é um seed em
  código** e o **carrinho é em memória** (por sessão via cookie).
- **Um único deploy:** um servidor **Fastify** serve a **API JSON** e a **SPA React
  buildada** (Render/Railway/Fly, num serviço só). `npm run build` gera a SPA; `npm start`
  sobe o servidor na porta `PORT` (default 3000) servindo tudo. **`npm start` DEVE rodar em
  Node 20** — use `tsx` para executar o TypeScript (não `node --experimental-strip-types`,
  que não existe no Node 20), ou compile para JS e rode com `node`.
- **Contrato para o E2E (verificação de renderização):** a rota de produto é `/p/:slug`; a
  página de produto tem um botão cujo texto contém "carrinho" (adicionar ao carrinho); o
  carrinho vive em `/cart`. Preços aparecem como `R$`. (A jornada Playwright checa isso.)
- Monorepo já existente em `store/` (workspaces `api`, `web`, `shared`, `e2e`),
  TypeScript strict, ESM (imports com extensão `.js`).

## 2. Tecnologias (fixas)

- **Backend:** Fastify 5 + `fastify-type-provider-zod` (já existe `store/api/src/app.ts`
  com `buildApp()`, plugin de erros e rota `/health` — **estender, não recriar**),
  `@fastify/cookie`, `@fastify/static`.
- **Preço:** reutilizar `store/shared` (`calculateOrderTotals`, tipos em `types/pricing`) —
  **não reimplementar cálculo de preço**.
- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS + React Router.
- **Testes:** Vitest (unit backend e frontend). **Lint/typecheck:** `tsc` strict.

## 3. Domínio (seed, em memória)

`Product { id, slug, name, category, kind: 'figure'|'other', description, basePriceCents,
images: string[], isLimitedEdition, variants: Variant[] }` ·
`Variant { id, label, priceDeltaCents }` · `CartItem { id, productId, variantId, quantity }`.

- **~8 produtos** em 3-4 categorias (Action Figures, Mangás, Vestuário, Acessórios).
- **Imagens:** o agente usa placeholders confiáveis `https://placehold.co/600x600/1F1710/E2843F?text=<nome>`
  (sempre renderizam; imagens reais podem ser trocadas depois).
- Preço do carrinho vem do módulo `shared` (frete fixo 1990 centavos; sem cupom/premium no MVP).

## 4. Funcionalidades (o que o avaliador testa)

1. **Vitrine:** listagem de produtos com imagem, nome, categoria e preço; filtro por
   categoria e **busca** por texto (`?q=`).
2. **Página de produto:** galeria, **seleção de variação**, preço (com adicional da
   variação e +20% de edição limitada quando aplicável), botão **adicionar ao carrinho**.
3. **Carrinho:** itens com variação, **+/- quantidade**, **remover**, **total** (subtotal +
   frete), estado vazio.
4. **Feedback de UI (obrigatório):** **toasts** (adicionado ao carrinho), **skeletons** de
   loading, **estados vazios** (sem resultados / carrinho vazio) e **estado de erro** de
   rede. Responsivo e acessível (alt em imagens, foco por teclado, `aria-live` no toast).
   Tema escuro coeso "neo-Tokyo/Akihabara" (o agente escolhe as cores).

## 5. API (contrato)

- `GET /api/products?category=&q=` → lista.
- `GET /api/products/:slug` → produto, ou **404** pelo contrato de erro existente.
- `GET /api/cart` → `{ items: [...com produto+variação+lineTotalCents], totals }`
  (totais via `calculateOrderTotals`). Cart id via cookie (cria se ausente).
- `POST /api/cart` `{productId, variantId, quantity}` · `PATCH /api/cart/:itemId {quantity}`
  · `DELETE /api/cart/:itemId`.
- A rota curinga serve a SPA (`index.html`) para GETs que não começam com `/api`.

## 6. Definition of Done (MVP)

- [ ] `cd store && npm install && npm run build && npm start` sobe a loja em `:3000`.
- [ ] `GET /api/products` retorna 8 produtos; `GET /api/products/:slug` funciona (404 no ausente).
- [ ] Fluxo carrinho (POST → GET → PATCH → DELETE) funciona com total correto (via `shared`).
- [ ] A SPA renderiza: vitrine → produto → adicionar ao carrinho → carrinho.
- [ ] Loadings, toasts, estados vazio/erro presentes.
- [ ] `npm run typecheck` e `npm test` passam.

## 7. Backlog priorizado (TDD-first, atômico)

> Ordem = prioridade. `dep` = ids que precisam vir antes. Cada item **começa pelos testes**.

**Backend**
- **seed-catalog** — `store/api/src/data/catalog.ts` com 8 produtos (imagens placehold.co,
  variações, edição limitada). `dep: —` *Aceite:* teste conta 8 produtos e valida campos.
- **cart-store** — `store/api/src/data/cart.ts` em memória (get/add/updateQty/remove).
  `dep: —` *Aceite:* testes das operações.
- **api-products** — `GET /api/products` (filtro `category`/`q`) + `GET /api/products/:slug`
  (404). `dep: seed-catalog` *Aceite:* testes de lista, filtro e 404.
- **api-cart** — rotas do carrinho com cookie; totais via `shared`. `dep: cart-store,seed-catalog`
  *Aceite:* testes POST→GET com total correto, PATCH, DELETE.
- **serve-spa** — registrar `@fastify/cookie` + `@fastify/static` servindo `store/web/dist`
  com fallback SPA; mantém `/health` e o contrato 404 de `/api`. `dep: api-products,api-cart`
  *Aceite:* teste de fallback (GET `/` serve HTML; `/api/x` inexistente → 404 JSON).

**Frontend**
- **web-app** — Vite+React+TS+Tailwind: `vite.config.ts` (proxy `/api`→3000, outDir `dist`),
  `index.html`, Tailwind, `main.tsx`, `App.tsx` (rotas `/`, `/p/:slug`, `/cart`), cliente de
  API tipado (`credentials:'include'`). `dep: —` *Aceite:* `npm run build -w @store/web` gera `dist`.
- **web-cart-context** — contexto de carrinho (fetch `/api/cart`, add/update/remove, contagem)
  + sistema de **toast** (`aria-live`). `dep: web-app` *Aceite:* teste de componente do contexto/toast.
- **web-states** — componentes reutilizáveis de **skeleton**, **empty** e **error**.
  `dep: web-app` *Aceite:* teste de render dos três estados.
- **web-home** — vitrine: `ProductCard`, grid, chips de categoria, busca; usa skeleton/empty.
  `dep: web-app,web-states,api-products` *Aceite:* teste de render da lista (mock).
- **web-product** — página de produto: galeria, seletor de variação, preço, add-to-cart (toast).
  `dep: web-app,web-cart-context,api-products` *Aceite:* teste de seleção de variação + preço.
- **web-cartpage** — carrinho: itens, +/- quantidade, remover, totais, estado vazio.
  `dep: web-app,web-cart-context,api-cart` *Aceite:* teste de render + interação.
- **web-header** — `Header` (logo OtakuVerso, nav, badge de contagem do carrinho). `dep: web-app,web-cart-context`
  *Aceite:* teste do badge refletindo a contagem.

**Integração/deploy**
- **build-serve** — scripts raiz `build` (web) e `start` (api servindo `dist`) e um `dev`
  (api + vite). `dep: serve-spa,web-home,web-product,web-cartpage,web-header` *Aceite:*
  `npm run build && npm start` sobe a loja; smoke em `/api/products` e `/`.

## Fora de escopo do MVP (na visão completa `STORE_SPEC.md`)

Login/reviews, checkout/pagamento mock, e-mail, premium, favoritos, banco Postgres — ficam
para depois do MVP validado.
