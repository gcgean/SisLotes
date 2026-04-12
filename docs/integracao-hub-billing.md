# Integração Hub Billing no SISLOTE

## Variáveis de ambiente

Defina no backend:

- `HUB_BILLING_BASE_URL` (ex: `https://billing.seudominio.com/api/v1`)
- `HUB_BILLING_API_KEY` (API key para endpoints de acesso/licença)
- `HUB_BILLING_ADMIN_EMAIL` (login admin no Hub)
- `HUB_BILLING_ADMIN_PASSWORD` (senha admin no Hub)
- `HUB_BILLING_WEBHOOK_SECRET` (segredo HMAC para validar webhooks)
- `HUB_BILLING_PRODUCT_ID` (UUID do produto no Hub para o módulo/licença do SISLOTE)

## Passo a passo de produção (igual ao ambiente de testes)

Este é o fluxo oficial para garantir que produção se comporte igual ao módulo de testes.

### 1) Cadastro de nova empresa (Primeiro Acesso)

1. Usuário preenche dados de usuário + empresa + documento (CPF/CNPJ).
2. Backend cria registros locais (usuário/empresa) e normaliza o documento.
3. Backend chama `POST {HUB_BILLING_BASE_URL}/access/resolve` com `X-API-Key`:
   - `document`
   - `personType` (`PF` ou `PJ`)
   - `productId` (`HUB_BILLING_PRODUCT_ID`)
   - `name`
   - `email`
4. Backend salva na empresa local:
   - `hub_customer_id` (retornado pelo Hub)
   - `hub_license_status`
   - `hub_license_reason`
   - `hub_expires_at` / `trialEndAt` / `licenseEndAt`
   - `hub_features`
5. Se `canAccess = false`, redireciona para `/planos?reason={accessStatus|reason}`.
6. Se `canAccess = true`, conclui onboarding e entra no sistema.

### 2) Login recorrente (buscar empresa + licença)

1. No login, o backend resolve a empresa do usuário.
2. Se empresa ainda não tiver `hub_customer_id`, executa novamente o resolve idempotente.
3. Com `hub_customer_id` preenchido, chama `GET /access/status?customerId=...&productId=...`.
4. Atualiza os dados locais da licença e features.
5. Se status estiver bloqueado, retorna `403` e front redireciona para `/planos`.

### 3) Tela de planos (buscar planos ativos + plano atual)

1. Front chama `GET /api/hub-billing/planos-disponiveis`.
2. Backend consulta o Hub e retorna **somente planos ativos**.
3. Front exibe nome/preço/descrição dos planos vindos do Hub.
4. Front chama `GET /api/hub-billing/license-status` para exibir:
   - plano atual
   - status (`trial`, `licensed`, etc.)
   - expiração/dias restantes

### 4) Licença de módulo (controle em produção)

1. Toda rota protegida passa por validação da licença local sincronizada com Hub.
2. Quando necessário, backend sincroniza novamente via `GET /access/status`.
3. Motivos de bloqueio devem impedir uso dos módulos e levar para `/planos`.

## Diagnóstico: produção não comunica com o Hub (checklist rápido)

Quando teste funciona e produção não, normalmente é configuração de ambiente/rede:

1. Confirmar variáveis em `backend/.env` de produção:
   - `HUB_BILLING_BASE_URL`
   - `HUB_BILLING_API_KEY`
   - `HUB_BILLING_PRODUCT_ID`
   - `HUB_BILLING_ADMIN_EMAIL`
   - `HUB_BILLING_ADMIN_PASSWORD`
2. Garantir que `HUB_BILLING_API_KEY` e `HUB_BILLING_PRODUCT_ID` sejam do **mesmo produto** no Hub.
3. Validar saída de rede do servidor de produção para o domínio do Hub (DNS/TLS/firewall).
4. Verificar se proxy/reverse proxy não remove headers `X-API-Key` e `Authorization`.
5. Confirmar relógio do servidor (desvio grande pode invalidar JWT).
6. Ver logs do backend com status Hub (`401`, `403`, `404`, `422`, `429`, `5xx`) e `correlationId`.
7. Rodar no backend o diagnóstico:
   - `cd backend && npm run hub:diag`

## Teste mínimo de homologação em produção

1. Cadastrar empresa nova com CPF/CNPJ não usado.
2. Confirmar retorno de `hub_customer_id` salvo na empresa.
3. Confirmar plano/trial exibidos na dashboard e em `/planos`.
4. Fazer login/logout e validar consistência do mesmo status/licença.
5. Simular bloqueio no Hub e validar redirecionamento automático para `/planos`.
6. Realizar cobrança e validar atualização via webhook/sync.

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
