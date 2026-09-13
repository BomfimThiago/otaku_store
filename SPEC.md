# SPEC.md — Minion Console

## 1. Objetivo

Construir uma versão pessoal, em escala de hackathon, do padrão "Minions" da Stripe: um
orquestrador de agentes de codificação **não supervisionado**, que recebe uma tarefa em
linguagem natural, planeja, implementa, se auto-verifica, se auto-corrige dentro de um
teto de tentativas, e entrega um PR pronto para revisão — com o mínimo de intervenção
humana possível e o máximo de raciocínio de verificação (harness) visível.

O produto final tem duas partes:
1. **Orquestrador** (CLI + processo de fundo) — executa o blueprint de principio a fim.
2. **Dashboard** — visualiza, em tempo real, o estado do blueprint, o veredito dos
   Judges, o log de execução e o diff gerado.

## 2. Escopo do hackathon

**Dentro do escopo:**
- Blueprint completo (agendamento → isolamento → contexto → plano → implementação →
  verificação → sincronização → PR) rodando contra um repositório de exemplo pequeno.
- Isolamento via `git worktree` por run.
- Coleta de contexto em paralelo (código + fonte "interna" simulada por markdown local;
  fontes oficiais via uma API de busca real, ex. Tavily).
- Dois Judges (plano e implementação) com saída estruturada (score + checklist + crítica).
- Scheduler de locks por arquivo, com fila e bloqueio visível.
- Sincronização com `main` via rebase determinístico + 1 tentativa de resolução de
  conflito assistida por agente, sempre seguida de reverificação completa.
- Evals estáticos determinísticos (complexidade ciclomática, tamanho do diff).
- Testes end-to-end com Playwright, como nó condicional (só dispara se o plano tocar
  arquivos de frontend).
- Dashboard web mostrando o blueprint ao vivo, incluindo múltiplos runs simultâneos.

**Fora do escopo (por causa do tempo, não por não fazer sentido):**
- Integração real com Confluence/Slack (substituída por markdown local que cumpre o
  mesmo papel arquitetural).
- CI remoto de verdade — o "CI" é a própria execução local do harness.
- Autenticação/multiusuário no dashboard.
- Resolução de conflito de merge multi-arquivo complexa — o agente tenta uma vez; além
  disso, escala para humano.

## 3. Requisitos funcionais

| # | Requisito |
|---|---|
| RF1 | O sistema aceita uma tarefa em texto livre e a associa a um repositório-alvo. |
| RF2 | Cada run roda em um worktree isolado, criado e destruído automaticamente. |
| RF3 | A coleta de contexto (código+RAG interno e fontes oficiais) roda em paralelo via subagentes. |
| RF4 | Um plano é gerado antes de qualquer edição de código. |
| RF5 | O plano é aprovado ou reprovado por um Judge com saída estruturada (score, checklist, crítica). |
| RF6 | Plano reprovado volta para replanejamento, até 2 tentativas; na 3ª, escala para humano. |
| RF7 | A implementação é avaliada por um segundo Judge, comparando o diff contra o plano aprovado. |
| RF8 | Implementação reprovada volta para reimplementação com a crítica do Judge, até 2 tentativas. |
| RF9 | Evals estáticos determinísticos rodam sempre, sem envolver LLM. |
| RF10 | Lint e testes rodam sempre; falha aciona reimplementação, até 2 tentativas. |
| RF11 | E2E via Playwright roda apenas se o plano aprovado listar arquivos de frontend. |
| RF12 | Antes do PR, a branch é sincronizada (`rebase`) contra o `main` atual. |
| RF13 | Conflito de rebase aciona 1 tentativa de resolução via agente, seguida de reexecução completa do harness. |
| RF14 | O agendador impede que dois runs simultâneos editem o mesmo arquivo ao mesmo tempo (lock por arquivo, fila FIFO). |
| RF15 | Tarefas podem declarar dependência explícita (`depende_de: run_id`). |
| RF16 | O dashboard mostra, ao vivo: todos os runs ativos/na fila/bloqueados, o blueprint do run selecionado, o log, o veredito dos Judges e o diff. |
| RF17 | Cada nó agêntico/Judge registra qual "tier" de modelo foi usado. |
| RF18 | O sistema aceita um documento de especificação de produto (ex. `STORE_SPEC.md`) em vez de tarefas avulsas. |
| RF19 | Um agente decompõe a especificação em um backlog de itens atômicos, cada um com descrição, critério de aceite, arquivos prováveis e dependências declaradas em relação a outros itens. |
| RF20 | Um Judge de backlog aprova ou reprova a decomposição, checando cobertura total da especificação, tamanho adequado dos itens e coerência das dependências (mesmo teto de 2 tentativas antes de escalar). |
| RF21 | A partir do backlog aprovado, o sistema monta um grafo de dependências e calcula prioridade de forma determinística (nº de itens desbloqueados × peso MVP/nice-to-have) — nenhum LLM decide ordem de execução em tempo real. |
| RF22 | Um loop de despacho contínuo, determinístico, dispara todo item "pronto" (sem dependência pendente e sem lock de arquivo conflitante) respeitando um limite de paralelismo configurável, até o backlog esvaziar. |
| RF23 | PRs que passam por todo o harness (ambos os Judges + evals + testes + E2E) fazem merge automático numa branch de integração (`develop`), sem revisão humana por item. |
| RF24 | Ao esvaziar o backlog, roda uma suíte E2E da jornada completa do produto; falha aqui vira um novo item de backlog (mesmo mecanismo, sem caso especial) em vez de travar o sistema. |
| RF25 | Um Judge de produto compara o resultado final contra a especificação original antes de marcar a entrega como completa. |

## 4. Requisitos não-funcionais / restrições

- **Determinismo onde for possível.** Qualquer decisão que não precise de julgamento
  (lock de arquivo, rodar linter, decidir se dispara E2E) é código puro, nunca uma
  chamada de LLM — princípio herdado diretamente do modelo de blueprint da Stripe.
- **Teto de tentativas único e consistente**: toda correção automática (plano, implementação,
  testes, conflito de merge) respeita o mesmo limite de 2 tentativas antes de escalar
  para revisão humana. Não existe "loop infinito" em nenhum nó.
- **Intervenção humana mínima e em pontos fixos.** Só 4 gatilhos chamam um humano:
  1. Judge (plano ou implementação) reprova 2x seguidas.
  2. Harness completo falha 2x seguidas.
  3. Conflito de merge toca arquivo fora do escopo do plano aprovado.
  4. Conflito de merge persiste após a tentativa de resolução + reverificação completa.
  5. Judge de backlog reprova a decomposição 2x seguidas (spec ambígua ou mal coberta).
  6. Judge de produto reprova a entrega final 2x seguidas.
  7. Promoção de `develop` para produção — o único merge que **sempre** exige um clique humano.
- **Reprodutibilidade**: qualquer run deve poder ser reconstruído a partir do log
  registrado (task original, plano aprovado, diffs, vereditos, tempos).
- **Tiering de modelo**: nós de planejamento e julgamento usam o modelo mais forte
  disponível; nós de implementação/correção usam o modelo mais rápido/barato.

## 5. Arquitetura proposta

### 5.1 Camada de auto-coordenação (Roadmap Planner)

Fica **acima** do blueprint por tarefa (seção 5.2) e é o que permite alimentar o sistema
com uma especificação de produto inteira em vez de tarefas avulsas:

```
   STORE_SPEC.md (ou spec equivalente)
              ▼
   ┌───────────────────────┐
   │  Decompor em backlog   │  AGENT (modelo forte)
   └──────────┬─────────────┘
              ▼
   ┌───────────────────────┐
   │  Judge · backlog       │  JUDGE ──► reprovado (máx 2x) ──┐
   └──────────┬─────────────┘                                │
              ▼ aprovado                                      │
   ┌───────────────────────┐                                  │
   │ Grafo + prioridade     │  DET  (topological sort +        │
   └──────────┬─────────────┘   score determinístico)          │
              ▼                                                │
   ┌───────────────────────┐                                  │
   │  Loop de despacho      │  DET  (respeita paralelismo +    │
   └──────────┬─────────────┘   lock de arquivo da seção 5.2)  │
              ▼                                                │
     [cada item pronto entra no blueprint da seção 5.2] ────────┘ (falha vira novo item)
              ▼
   ┌───────────────────────┐
   │  Merge automático       │  DET  → branch de integração (develop)
   └──────────┬─────────────┘
              ▼
     backlog vazio? ──não──► volta pro loop de despacho
              │ sim
              ▼
   ┌───────────────────────┐
   │ E2E do produto inteiro │  DET
   └──────────┬─────────────┘
              ▼
   ┌───────────────────────┐
   │  Judge · produto        │  JUDGE ──► reprovado ──► vira novo item de backlog
   └──────────┬─────────────┘
              ▼ aprovado
        pronto para promoção humana develop → main
```

### 5.2 Blueprint por item de backlog (worker)

```
                     ┌────────────────────────┐
  item do backlog ──►│ Agendar / lock arquivos │  DET
                     └───────────┬────────────┘
                                 ▼
                     ┌────────────────────────┐
                     │     Isolar ambiente     │  DET   (git worktree)
                     └───────────┬────────────┘
                                 ▼
              ┌──────────────────┴──────────────────┐
              ▼                                      ▼
   ┌─────────────────────┐               ┌─────────────────────────┐
   │ Contexto interno/RAG │  AGENT        │ Fontes oficiais (Tavily) │ AGENT   (paralelo/subagents)
   └──────────┬───────────┘               └────────────┬────────────┘
              └──────────────────┬──────────────────────┘
                                 ▼
                     ┌────────────────────────┐
                     │   Apresentar plano      │  AGENT  (modelo forte)
                     └───────────┬────────────┘
                                 ▼
                     ┌────────────────────────┐
                     │   Judge · plano         │  JUDGE  (modelo forte) ──┐
                     └───────────┬────────────┘                          │ reprovado (máx 2x)
                                 ▼ aprovado                               │
                     ┌────────────────────────┐                          │
                     │      Implementar        │◄─────────────────────────┘
                     └───────────┬────────────┘  AGENT (modelo rápido)
                                 ▼
                     ┌────────────────────────┐
                     │ Judge · implementação   │  JUDGE (modelo forte) ──┐
                     └───────────┬────────────┘                         │ reprovado (máx 2x)
                                 ▼ aprovado                              │
                     ┌────────────────────────┐                         │
                     │   Evals estáticos       │  DET                    │
                     └───────────┬────────────┘                         │
                                 ▼                                      │
                     ┌────────────────────────┐                         │
                     │   Lint + testes         │  DET ────────────────────┘ (falha)
                     └───────────┬────────────┘
                                 ▼
                     ┌────────────────────────┐
                     │  E2E (Playwright)       │  DET  (condicional: só se tocar frontend)
                     └───────────┬────────────┘
                                 ▼
                     ┌────────────────────────┐
                     │ Sincronizar com main    │  DET → AGENT se conflito → DET (reverifica tudo)
                     └───────────┬────────────┘
                                 ▼
                     ┌────────────────────────┐
                     │       Abrir PR          │  DET
                     └────────────────────────┘
```

**Componentes:**

| Componente | Responsabilidade |
|---|---|
| `orchestrator` | Executa a state machine do blueprint; decide qual nó roda a seguir. |
| `scheduler` | Mantém a tabela de locks por arquivo e a fila de runs bloqueados. |
| `worktree_manager` | Cria/destrói worktrees isolados por run. |
| `context_gatherer` | Dispara os 2 subagentes de contexto em paralelo e consolida o resultado. |
| `plan_judge` / `impl_judge` | Chamadas de LLM com saída estruturada (schema fixo: score, checklist, crítica). |
| `harness_runner` | Roda lint, testes, evals estáticos e Playwright; interpreta os resultados de forma determinística. |
| `sync_manager` | Faz o rebase, detecta conflito, aciona o agente de resolução, reexecuta o harness. |
| `dashboard` | Front-end que lê o estado do orquestrador (polling ou SSE) e renderiza o blueprint ao vivo. |
| `roadmap_planner` | Decompõe a especificação em backlog, monta o grafo de dependências e calcula prioridade. |
| `dispatch_loop` | Processo contínuo que despacha itens "prontos" do backlog respeitando paralelismo e locks. |
| `product_judge` | Avalia a entrega final contra a especificação original; falhas viram novos itens de backlog. |

## 6. Decisões técnicas principais

- **Judge ≠ Agente.** Um Judge nunca edita código — só avalia e devolve uma crítica
  estruturada. Isso separa "quem decide o que fazer" de "quem confere se foi bem feito",
  e permite trocar o modelo de cada papel independentemente.
- **O plano aprovado é reaproveitado 3 vezes**: (1) o Judge de implementação usa como
  gabarito; (2) o agendador usa a lista de arquivos do plano como chave de lock; (3) o
  nó de E2E usa a mesma lista para decidir, deterministicamente, se dispara Playwright.
  Uma única fonte de verdade evita 3 heurísticas divergentes.
- **Teto de 2 tentativas em todo loop**, não só no CI — mesma lógica em plano, implementação,
  testes e resolução de conflito. Consistência de política é mais fácil de explicar e de
  confiar do que um limite diferente por etapa.
- **Conflito de merge nunca é resolvido "às cegas".** O agente pode tentar, mas a aceitação
  depende de rodar a suíte de harness inteira de novo — nunca confiamos na resolução por si só.
- **Tiering de modelo é uma decisão de custo/qualidade explícita**: decisões de alto impacto
  (planejar, julgar) usam o modelo mais forte disponível; decisões mecânicas (implementar
  a partir de um plano já aprovado) usam o modelo mais rápido. Isso é logado e exposto no
  dashboard, não é um detalhe escondido.

## 7. Definition of Done

- [ ] O sistema recebe apenas `STORE_SPEC.md` — nenhuma tarefa é criada manualmente por humano.
- [ ] O backlog decomposto cobre 100% das funcionalidades obrigatórias da especificação (verificável pelo Judge de backlog).
- [ ] Pelo menos 2 itens do backlog rodam em paralelo genuinamente (sem dependência nem lock entre eles).
- [ ] Pelo menos 1 colisão de arquivo entre itens é resolvida pelo scheduler (um espera o outro).
- [ ] Pelo menos 1 item é reordenado ou bloqueado corretamente por dependência declarada (não por lock incidental).
- [ ] Merge automático até `develop` acontece sem clique humano; só a promoção final `develop → main` é manual.
- [ ] Uma tarefa de exemplo roda do início ao fim sem nenhuma instrução humana no meio.
- [ ] Existe pelo menos 1 log real de um loop de recuperação completo (Judge reprova →
      agente corrige → Judge aprova, ou testes falham → agente corrige → testes passam).
- [ ] O scheduler bloqueia de fato duas tarefas que colidem no mesmo arquivo (demonstrável).
- [ ] O nó de sincronização executa um rebase real contra um `main` que avançou durante o run.
- [ ] Playwright roda (ou é pulado deterministicamente) conforme o conteúdo do plano.
- [ ] O dashboard reflete o estado real do orquestrador, não dados mockados, para pelo
      menos um run de ponta a ponta gravado no vídeo de demonstração.
- [ ] Todos os 4 gatilhos de escalonamento para humano estão implementados e são
      acionáveis (não apenas documentados).
