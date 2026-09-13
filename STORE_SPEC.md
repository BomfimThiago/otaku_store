# STORE_SPEC.md — MiniVerso

> Este documento descreve **o que a loja precisa ter**. Ele não lista tarefas, não define
> ordem de execução e não diz o que fazer primeiro — isso é decidido pelo Minion Console
> a partir do conteúdo abaixo (ver `SPEC.md`, seção "Camada de auto-coordenação").

## Visão

Uma loja online de colecionáveis anime personalizados: o cliente monta um item (boneco,
caneca, chaveiro ou camiseta) escolhendo cor, pose e nome gravado, adiciona ao carrinho,
aplica cupom se tiver, faz checkout e recebe confirmação com o resumo da personalização.

## Funcionalidades obrigatórias (MVP)

| # | Funcionalidade |
|---|---|
| FR1 | Catálogo com 6-8 produtos fixos (boneco, caneca, chaveiro, camiseta), cada um com suas próprias opções de personalização. |
| FR2 | Customizador: escolher cor (paleta fixa por produto), pose (2-3 opções por boneco) e nome gravado (até 12 caracteres, alfanumérico). |
| FR3 | Preço recalcula em tempo real conforme as opções escolhidas (base + adicionais + frete). |
| FR4 | Carrinho: adicionar/remover itens; cada item mantém a personalização com que foi adicionado. |
| FR5 | Cupom de desconto aplicável no carrinho (percentual). |
| FR6 | Cadastro/login simples (nome, e-mail, senha) — sem verificação de e-mail real. |
| FR7 | Checkout exige login, mostra resumo (itens + personalização + preço final), confirma pedido (pagamento é mock — não existe gateway real). |
| FR8 | Confirmação de pedido com o resumo das personalizações (envio de e-mail é mock: precisa logar o disparo, não entregar de verdade). |

## Funcionalidades desejáveis (não bloqueiam a entrega do MVP)

| # | Funcionalidade |
|---|---|
| FR9 | Histórico de pedidos na conta do cliente. |
| FR10 | Upload de imagem de referência para personalizar o boneco. |

## Regras de negócio (para validação objetiva de correção)

- Nome gravado: 1 a 12 caracteres, alfanumérico. Obrigatório para boneco e caneca;
  opcional para chaveiro e camiseta.
- Opção "edição limitada" (somente bonecos): acrescenta **20% sobre o preço base do
  item**, calculado **antes do frete** e **depois** de outros adicionais de personalização.
- Cupom de desconto incide sobre o **subtotal** (itens já com personalização), nunca
  sobre o frete.
- Frete é um valor fixo por pedido (não por item), somado **por último**, depois do desconto.
- Nenhum item entra no carrinho sem todas as opções obrigatórias de personalização preenchidas.

## Fora de escopo (declarado)

- Pagamento real (gateway de cartão, Pix, etc.).
- Envio de e-mail real (SMTP/provedor).
- Multi-idioma e multi-moeda.
- Área administrativa de gestão de catálogo.

## Requisitos não-funcionais

- O cálculo de preço deve dar o mesmo resultado no customizador, no carrinho e no checkout.
- Toda regra de preço/validação precisa de teste automatizado cobrindo o caminho feliz e
  pelo menos um caso de borda.
- A jornada completa (catálogo → customizar → carrinho → cupom → checkout → confirmação)
  precisa de uma suíte E2E própria, além dos testes unitários de cada regra.

## Definition of Done da loja

- [ ] FR1–FR8 implementadas e passando na suíte E2E completa da jornada.
- [ ] Nenhuma regra de preço/validação diverge do que está descrito acima.
- [ ] FR9/FR10 implementadas apenas se o backlog obrigatório já estiver 100% entregue.
