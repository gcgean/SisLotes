# Integração Hub Billing no SISLOTE

## Variáveis de ambiente

Defina no backend:

- `HUB_BILLING_BASE_URL` (ex: `https://billing.seudominio.com/api/v1`)
- `HUB_BILLING_API_KEY` (API key para endpoints de acesso/licença)
- `HUB_BILLING_ADMIN_EMAIL` (login admin no Hub)
- `HUB_BILLING_ADMIN_PASSWORD` (senha admin no Hub)
- `HUB_BILLING_WEBHOOK_SECRET` (segredo HMAC para validar webhooks)

## Mapeamento por empresa

Cada empresa no SISLOTE deve ter:

- `hub_customer_id`
- `hub_product_code`

Esses campos estão disponíveis na Área Administrativa para o usuário `gcgean`.

## Endpoints internos criados

Base: `/api/hub-billing`

- `GET /license-status`  
  Retorna status/plano/features da licença da empresa do usuário autenticado.

- `POST /sync-license`  
  Força sincronização da licença da empresa atual com o Hub Billing.

- `POST /orders`  
  Cria pedido no Hub Billing usando JWT admin (server-to-server).

- `POST /orders/:orderId/checkout`  
  Gera checkout/cobrança (PIX/cartão/boleto) para o pedido.

- `GET /charges?originType=order|subscription&originId=...`  
  Consulta cobranças no Hub Billing.

- `GET /minhas-cobrancas`  
  Lista as cobranças mapeadas localmente para a empresa logada.

- `POST /minhas-cobrancas/:id/sync`  
  Faz refresh de status da cobrança no Hub e atualiza o espelho local.

- `POST /planos/checkout`  
  Cria pedido + checkout automaticamente para contratação de plano.

- `POST /planos/alterar`  
  Executa upgrade/downgrade com regra de proration.

- `POST /planos/subscription/checkout`  
  Cria assinatura recorrente e gera checkout inicial da subscription.

- `GET /timeline`  
  Retorna linha do tempo dos eventos locais de cobrança (webhook/sync/system).

- `POST /webhook`  
  Endpoint de entrada para eventos enviados pelo Hub Billing.  
  Requer assinatura `X-Hub-Signature` válida.

## Regra de negócio de licença

- No login, o sistema sincroniza licença com Hub Billing quando houver mapeamento.
- Usuário de empresa com licença negada (`no_license`, `license_suspended`, `license_expired`, `license_revoked`, `license_inactive`, `customer_blocked`) recebe bloqueio de acesso.
- O middleware de autenticação também bloqueia requests autenticados quando a licença estiver negada.
- Usuário `gcgean` permanece com acesso à administração da plataforma para suporte operacional.

## Fluxo recomendado de cobrança

1. SISLOTE cria pedido em `/api/hub-billing/orders`.
2. SISLOTE gera checkout em `/api/hub-billing/orders/{orderId}/checkout`.
3. SISLOTE consulta status via `/api/hub-billing/charges`.
4. Hub Billing envia webhook para `/api/hub-billing/webhook`.
5. SISLOTE atualiza estado local de licença e invalida cache curto.

## Proration (upgrade/downgrade)

- O backend calcula proration pelo tempo restante do ciclo (`hub_expires_at`).
- Upgrade: cobra apenas o proporcional da diferença entre plano alvo e atual.
- Downgrade: aplica mudança sem cobrança adicional imediata (crédito informado no retorno).
- Endpoint usado: `POST /api/hub-billing/planos/alterar`.

## Feature flags de plano (módulos e recursos)

As `hub_features` controlam recursos no frontend e backend.

- `export_csv`
- `export_pdf`
- `module_planos`
- `module_relatorios`
- `module_auditoria`
- `module_vendas`
- `module_pagamentos`
- `max_users` (limite de usuários por empresa)

## Fallback seguro da matriz de features

- O sistema aplica uma matriz base por plano (`BASICO`, `PROFISSIONAL`, `ENTERPRISE`).
- As features vindas do Hub sobrescrevem a matriz base.
- Em produção, para features conhecidas sem valor definido, o fallback é bloqueio (`default deny`).
- Em desenvolvimento/homologação, mantém comportamento permissivo para facilitar testes.
