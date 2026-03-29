# Auditoria de Segurança Multiloja

## Escopo da auditoria

- Controle de acesso ao menu e rotas administrativas
- Isolamento de dados por empresa (`id_empresa`)
- Validação de acesso cruzado em consultas e ações críticas
- Revisão de exposição de dados no frontend e backend

## Vulnerabilidades identificadas

### 1) Exposição indevida da área administrativa

- **Risco**: usuários com `user_master=true` conseguiam visualizar/abrir a área administrativa.
- **Impacto**: acesso a operações de plataforma fora do usuário autorizado.
- **Correção aplicada**:
  - Backend: `requireMaster` passou a permitir somente `login = gcgean`.
  - Frontend: menu “Administração” visível apenas para `gcgean`.
  - Frontend: rota `/admin` protegida por guarda adicional por username.
  - Frontend: página `Admin` redireciona caso usuário logado não seja `gcgean`.

### 2) Risco de acesso cruzado entre empresas em fluxo de vendas

- **Risco**: criação de venda/histórico validava cliente/lote sem escopo de empresa em alguns pontos.
- **Impacto**: possibilidade de vincular registros de outra empresa em cenários de enumeração de IDs.
- **Correção aplicada**:
  - `vendas.ts`:
    - validação de cliente por `id_cliente + id_empresa`
    - validação de lote por `id_lote + id_empresa`
    - busca de venda existente por `id_lote + status + id_empresa`
    - consulta final da venda criada com `id_venda + id_empresa`
    - cancelamento com contagem de pagamentos pagos também filtrada por `id_empresa`

### 3) Risco de leitura cruzada em contratos e detalhes de lote

- **Risco**: alguns carregamentos secundários usavam apenas chave primária sem reforçar `id_empresa`.
- **Impacto**: possibilidade de leitura indireta de dados de outra empresa em casos de inconsistência referencial.
- **Correção aplicada**:
  - `contratos.ts`:
    - cliente, lote, loteamento e pagamentos com filtro adicional por `id_empresa`
  - `lotes.ts`:
    - loteamento e cliente no endpoint `/:id/cliente` com filtro por `id_empresa`
  - `loteamentos.ts`:
    - carregamento de clientes de lotes vendidos também com filtro por `id_empresa`

### 4) Endpoints de empresas expostos para qualquer usuário master

- **Risco**: listagem/criação/ativação de empresas em `/api/empresas` permitia qualquer `user_master`.
- **Impacto**: governança de multiloja fora do usuário de plataforma definido.
- **Correção aplicada**:
  - `empresas.ts` passou a exigir explicitamente `login = gcgean` nas operações de plataforma.

## Testes de segurança executados

- Teste de autorização por perfil:
  - usuário diferente de `gcgean` não visualiza menu Admin
  - usuário diferente de `gcgean` não acessa `/admin`
  - backend bloqueia rotas administrativas com `403`
- Teste de isolamento por empresa:
  - criação/cancelamento de vendas validado com `id_empresa`
  - consultas de contrato e lote com filtros de empresa em joins secundários
  - listagem de clientes em loteamentos restringida por empresa

## Situação atual da arquitetura multiloja

- **Separação de dados por empresa**: aplicada nas rotas principais e reforçada nas rotas críticas auditadas.
- **Isolamento de sessão**: token JWT por usuário autenticado, com resolução do usuário em cada request.
- **Controle de acesso granular**: permissões por módulo/ação mantidas e restrição extra para administração da plataforma.
- **Defesa contra acesso cruzado**: filtros adicionais por `id_empresa` aplicados nos pontos vulneráveis identificados.

## Recomendações adicionais (hardening)

- Implementar hash de senha com algoritmo forte (ex.: Argon2/Bcrypt) e migração segura de credenciais legadas.
- Evitar persistência de senha em `localStorage`; preferir armazenamento seguro e/ou apenas “lembrar usuário”.
- Criar suíte automatizada de testes de autorização multitenant (integração) com cenários negativos.
- Adotar política de auditoria contínua com checklist de revisão de `id_empresa` em toda nova rota.
