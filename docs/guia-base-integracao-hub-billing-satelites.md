# Guia Base de Integracao Hub Billing (Sistemas Satelites)

Este documento define o padrao de integracao para qualquer sistema satelite que use o Hub Billing para onboarding, trial, licenca e cobranca.

Objetivo: reutilizar as mesmas regras de negocio e o mesmo comportamento de UX/seguranca ja validado no SISLOTE.

## 1) Escopo e principios

- O Hub Billing e a fonte unica de verdade para acesso e licenca.
- O sistema satelite nunca decide trial, expiracao ou bloqueio por conta propria.
- Integracao financeira (pedido/checkout/cobranca) usa JWT admin server-to-server.
- Integracao de acesso/licenca usa API Key server-to-server.
- Nenhuma credencial Hub deve ser exposta no frontend.

## 2) Variaveis de ambiente obrigatorias

No backend do sistema satelite:

- `HUB_BILLING_BASE_URL` (ex: `https://seu-dominio.com/api/v1`)
- `HUB_BILLING_API_KEY`
- `HUB_BILLING_PRODUCT_ID`
- `HUB_BILLING_ADMIN_EMAIL`
- `HUB_BILLING_ADMIN_PASSWORD`
- `HUB_BILLING_WEBHOOK_SECRET`

Se houver planos mapeados por UUID no Hub:

- `HUB_BILLING_PLAN_TESTE`
- `HUB_BILLING_PLAN_BASICO`
- `HUB_BILLING_PLAN_INTERMEDIARIO`

## 3) Endpoints Hub usados na integracao

### Acesso/licenca (API Key - `X-API-Key`)

- `POST /access/resolve` (onboarding idempotente + trial + decisao de acesso)
- `GET /access/status?customerId={id}&productId={id}` (refresh periodico)
- `GET /access/entitlements/{customerId}` (opcional, perfil completo)
- `GET /access/customers/resolve?document={doc}` (opcional)
- `POST /access/customers/upsert` (opcional)

### Cobranca/assinatura (JWT admin - `Authorization: Bearer`)

- `POST /auth/login` (obter token admin)
- `POST /orders`
- `POST /orders/{orderId}/checkout`
- `PATCH /subscriptions/{subscriptionId}/change-plan`
- `POST /subscriptions/{subscriptionId}/checkout`
- `GET /payments/charges?originType=order|subscription&originId={id}`

### Webhooks

- Saida Hub -> Satelite (ex: `payment.approved`, `payment.failed`, `pix.expired`, `subscription.canceled`)
- Validar assinatura `X-Hub-Signature` via HMAC SHA-256 usando `HUB_BILLING_WEBHOOK_SECRET`

## 4) Regras de negocio padrao (obrigatorias)

## 4.1 Primeiro acesso / cadastro

1. Usuario informa dados basicos (login, email, telefone, senha, empresa, CPF/CNPJ).
2. Antes de concluir cadastro, o backend deve garantir mapeamento no Hub:
   - criar/recuperar customer idempotente por documento
   - salvar `hub_customer_id` na empresa local
3. Ao concluir cadastro/login inicial, chamar `POST /access/resolve`.
4. Se `canAccess = true`, permitir entrar no sistema.
5. Se `canAccess = false`, redirecionar para `/planos?reason={accessStatus|reason}`.

## 4.2 Login recorrente

1. Se empresa ainda nao tiver `hub_customer_id`, executar fluxo de resolve para mapear.
2. Chamar `GET /access/status` para refresh de licenca.
3. Persistir status local (`hub_license_status`, `hub_license_reason`, expiracao, features).
4. Se status negado, bloquear acesso e redirecionar para `/planos`.

## 4.3 Bloqueio por licenca

Considerar bloqueado quando status/reason estiver em:

- `blocked`
- `trial_expired`
- `customer_blocked`
- `no_license`
- `license_suspended`
- `license_expired`
- `license_revoked`
- `license_inactive`

Comportamento:

- Login deve responder `403` com motivo.
- Sessao ativa deve ser redirecionada para `/planos`.
- Telas protegidas nao devem seguir operacao se bloqueado.

## 4.4 Trial e conversao para pago

- Trial ativo deve permitir uso normal (`canAccess = true`).
- Durante trial, usuario pode pagar antecipadamente.
- Conversao trial -> pago:
  - Se ja existir assinatura ativa/trialing: `PATCH /subscriptions/{id}/change-plan` + `POST /subscriptions/{id}/checkout`
  - Se trial veio so de `resolve` (sem assinatura): `POST /orders` + `POST /orders/{orderId}/checkout`
- Apos `payment.approved`, licenca deve virar paga e ciclo completo deve ser refletido no status.

## 4.5 Aviso de vencimento (UX recomendado)

- A partir de `days_left <= 5` e `>= 0`, destacar aviso de urgencia.
- Perguntar se usuario deseja pagar agora.
- Se confirmar, redirecionar para `/planos?payCurrent=1`.
- Em `/planos`, focar e destacar o botao de pagamento do plano atual.

## 5) Contrato de dados local minimo

## 5.1 Empresa

- `hub_customer_id`
- `hub_product_code` (ou product id mapeado)
- `hub_license_status`
- `hub_license_reason`
- `hub_expires_at`
- `hub_features` (json)
- `hub_last_sync`
- `hub_cache_until`

## 5.2 Cobrancas locais (espelho)

- `origin_type` (`order` ou `subscription`)
- `origin_id`
- `order_id` / `subscription_id`
- `charge_id`
- `status`
- `amount`
- `payload` (json bruto de order/checkout/sync/webhook)

## 5.3 Eventos locais (timeline/auditoria)

- `event_type`
- `event_source` (`system` | `sync` | `webhook`)
- `charge_id`
- `status`
- `amount`
- `payload`
- `webhook_event_id` (para idempotencia)

## 6) Regras tecnicas importantes

## 6.1 Parse robusto de `/payments/charges`

O Hub pode responder:

- array na raiz
- ou objeto com `data`/`items`

A integracao deve:

- aceitar os 3 formatos
- localizar charge por `chargeId`, `id`, `externalChargeId`, `external_charge_id`
- inferir status:
  - usar `status` se existir
  - senao `paidAt` => `paid`
  - senao `canceledAt` => `canceled`

## 6.2 Normalizacao de valor (centavos vs reais)

- Alguns retornos usam centavos (ex: `100` = `R$ 1,00`).
- Sempre normalizar valor usando fallback do plano/valor conhecido para evitar gravar `100.00` quando o correto e `1.00`.

## 6.3 Cache e polling

- Status de licenca:
  - permitido: cache curto (ex: 60s)
  - negado: cache menor (ex: 10s)
- Cobrancas pendentes:
  - polling automatico (ex: 5-12s) chamando sync
  - ao fechar modal de pagamento, disparar sync imediato

## 6.4 Webhook + idempotencia

- Validar assinatura HMAC.
- Ignorar evento duplicado por `webhook_event_id`.
- Atualizar status local da charge e timeline.
- Em `payment.approved`, invalidar cache e sincronizar licenca da empresa.

## 7) Fluxo padrao de pagamento na tela de planos

1. Usuario clica em `Pagamento`.
2. Backend cria order/subscription checkout.
3. Front abre modal com:
   - `checkoutUrl` (quando existir)
   - `pixCode`
   - `pixQrCode` (base64)
4. Usuario paga.
5. Sistema atualiza automaticamente por:
   - webhook, e/ou
   - sync de charge via polling/botao
6. Ao confirmar pago, atualizar licenca e plano exibidos.

## 8) Tratamento de erro padrao

Mapear respostas Hub:

- `401` API key/token invalido
- `403` sem permissao admin
- `404` recurso nao encontrado
- `422` validacao/payload invalido
- `429` rate limit
- `500` erro interno Hub

Boas praticas:

- exibir mensagem amigavel para usuario
- logar detalhes tecnicos (incluindo `correlationId` e `path` do Hub)
- aplicar retentativa controlada para erros transientes (`429/5xx`)

## 9) Checklist de homologacao (go-live)

1. Variaveis de ambiente configuradas por ambiente (dev/hml/prod).
2. `POST /access/resolve` funcionando no login/onboarding.
3. Bloqueio por licenca negada retornando `403`.
4. Tela de planos redireciona corretamente em bloqueio.
5. Fluxo de pagamento gera checkout e exibe PIX (codigo + QR).
6. Webhook validando assinatura e processando idempotencia.
7. `payment.approved` atualiza charge e licenca automaticamente.
8. Conversao de trial para plano pago funcionando.
9. Aviso de vencimento <=5 dias habilitado.
10. Logs com rastreabilidade (`correlationId`) ativos.

## 10) Padrao de implementacao recomendado (resumo)

- Backend centraliza toda comunicacao com Hub.
- Frontend apenas consome API interna do satelite.
- Resolver onboarding e mapeamento de customer no primeiro acesso.
- Sincronizar licenca no login e periodicamente.
- Sincronizar cobranca automaticamente e por acao manual.
- Manter UX orientada a conversao: aviso de vencimento e atalho para pagamento.

---

Se outro sistema satelite seguir este guia, ele tera o mesmo comportamento funcional validado no SISLOTE para trial, bloqueio, cobranca e renovacao.
