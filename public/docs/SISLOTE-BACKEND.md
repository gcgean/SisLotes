# SISLOTE – Documentação Back-End

## 1. Visão Geral

Especificação do back-end para o sistema SISLOTE, incluindo modelo de dados, API REST, autenticação, regras de negócio e infraestrutura recomendada.

---

## 2. Stack Recomendada

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Banco de Dados | PostgreSQL 15+ | Integridade relacional, JSON support |
| ORM | Prisma / TypeORM | Type-safety, migrations |
| API | NestJS ou Laravel | Framework robusto com DI |
| Auth | JWT + bcrypt | Stateless, seguro |
| Cache | Redis (opcional) | Sessions, rate limiting |
| Storage | S3 / Supabase Storage | Arquivos de retorno bancário |

**Alternativa rápida:** Lovable Cloud (Supabase) para MVP com banco, auth e storage integrados.

---

## 3. Modelo de Dados (DDL)

### 3.1 Clientes

```sql
CREATE TABLE clientes (
  id_cliente    SERIAL PRIMARY KEY,
  tipo          CHAR(1) NOT NULL CHECK (tipo IN ('f', 'j')),
  nome          VARCHAR(200) NOT NULL,
  razao_social  VARCHAR(200),
  cpf           VARCHAR(14) UNIQUE,
  cnpj          VARCHAR(18) UNIQUE,
  rg            VARCHAR(20),
  estado_civil  VARCHAR(30),
  conjuge       VARCHAR(200),
  profissao     VARCHAR(100),
  endereco      VARCHAR(300),
  bairro        VARCHAR(100),
  cidade        VARCHAR(100),
  estado        CHAR(2),
  cep           VARCHAR(9),
  complemento   VARCHAR(200),
  fone_res      VARCHAR(20),
  fone_com      VARCHAR(20),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_clientes_nome ON clientes(nome);
CREATE INDEX idx_clientes_cpf ON clientes(cpf);
CREATE INDEX idx_clientes_cnpj ON clientes(cnpj);
```

### 3.2 Loteamentos

```sql
CREATE TABLE loteamentos (
  id_loteamento SERIAL PRIMARY KEY,
  nome          VARCHAR(200) NOT NULL,
  endereco      VARCHAR(300),
  cidade        VARCHAR(100),
  estado        CHAR(2),
  tipo_pessoa   CHAR(1) CHECK (tipo_pessoa IN ('f', 'j')),
  prop_nome     VARCHAR(200),
  cnpj          VARCHAR(18),
  prop_endereco VARCHAR(300),
  prop_bairro   VARCHAR(100),
  prop_cidade   VARCHAR(100),
  prop_estado   CHAR(2),
  prop_cep      VARCHAR(9),
  prop_fone     VARCHAR(20),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);
```

### 3.3 Lotes

```sql
CREATE TABLE lotes (
  id_lote        SERIAL PRIMARY KEY,
  id_loteamento  INTEGER NOT NULL REFERENCES loteamentos(id_loteamento),
  lote           VARCHAR(20) NOT NULL,
  quadra         VARCHAR(20) NOT NULL,
  area           VARCHAR(20),
  frente         VARCHAR(20),
  fundo          VARCHAR(20),
  esquerdo       VARCHAR(20),
  direito        VARCHAR(20),
  created_at     TIMESTAMP DEFAULT NOW(),

  UNIQUE(id_loteamento, quadra, lote)
);

CREATE INDEX idx_lotes_loteamento ON lotes(id_loteamento);
```

### 3.4 Vendas

```sql
CREATE TABLE vendas (
  id_venda       SERIAL PRIMARY KEY,
  id_cliente     INTEGER NOT NULL REFERENCES clientes(id_cliente),
  id_lote        INTEGER NOT NULL REFERENCES lotes(id_lote) UNIQUE,
  data_venda     DATE NOT NULL,
  valor_entrada  DECIMAL(12,2) NOT NULL DEFAULT 0,
  parcelas       INTEGER NOT NULL CHECK (parcelas > 0),
  porcentagem    DECIMAL(5,2) NOT NULL DEFAULT 0,
  status         VARCHAR(20) NOT NULL DEFAULT 'aberta'
                 CHECK (status IN ('aberta', 'quitada', 'cancelada')),
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_vendas_cliente ON vendas(id_cliente);
CREATE INDEX idx_vendas_lote ON vendas(id_lote);
```

### 3.5 Pagamentos

```sql
CREATE TABLE pagamentos (
  id_pagamento    SERIAL PRIMARY KEY,
  id_venda        INTEGER NOT NULL REFERENCES vendas(id_venda),
  id_conta        INTEGER REFERENCES contas(id_conta),
  id_usuario      INTEGER REFERENCES usuarios(id_usuario),
  numero_parcela  INTEGER NOT NULL,
  tipo            VARCHAR(10) NOT NULL DEFAULT 'boleto'
                  CHECK (tipo IN ('boleto', 'carne')),
  situacao        VARCHAR(10) NOT NULL DEFAULT 'aberto'
                  CHECK (situacao IN ('aberto', 'pago')),
  vencimento      DATE NOT NULL,
  valor           DECIMAL(12,2) NOT NULL,
  pago_data       DATE,
  valor_pago      DECIMAL(12,2),
  multa           DECIMAL(12,2) DEFAULT 0,
  juros           DECIMAL(12,2) DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),

  UNIQUE(id_venda, numero_parcela)
);

CREATE INDEX idx_pagamentos_venda ON pagamentos(id_venda);
CREATE INDEX idx_pagamentos_vencimento ON pagamentos(vencimento);
CREATE INDEX idx_pagamentos_situacao ON pagamentos(situacao);
```

### 3.6 Contas Bancárias

```sql
CREATE TABLE contas (
  id_conta   SERIAL PRIMARY KEY,
  apelido    VARCHAR(100) NOT NULL,
  titular    VARCHAR(200) NOT NULL,
  agencia    VARCHAR(20) NOT NULL,
  conta      VARCHAR(20) NOT NULL,
  convenio   VARCHAR(30),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3.7 Usuários

```sql
CREATE TABLE usuarios (
  id_usuario           SERIAL PRIMARY KEY,
  login                VARCHAR(50) NOT NULL UNIQUE,
  senha                VARCHAR(255) NOT NULL, -- bcrypt hash
  user_master          BOOLEAN DEFAULT FALSE,
  clientes_cadastrar   BOOLEAN DEFAULT FALSE,
  clientes_alterar     BOOLEAN DEFAULT FALSE,
  clientes_excluir     BOOLEAN DEFAULT FALSE,
  loteamentos_cadastrar BOOLEAN DEFAULT FALSE,
  loteamentos_alterar  BOOLEAN DEFAULT FALSE,
  loteamentos_excluir  BOOLEAN DEFAULT FALSE,
  vendas_cadastrar     BOOLEAN DEFAULT FALSE,
  vendas_alterar       BOOLEAN DEFAULT FALSE,
  vendas_excluir       BOOLEAN DEFAULT FALSE,
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP DEFAULT NOW()
);
```

### 3.8 Logs de Auditoria

```sql
CREATE TABLE logs (
  id_log      SERIAL PRIMARY KEY,
  id_usuario  INTEGER NOT NULL REFERENCES usuarios(id_usuario),
  id_cliente  INTEGER REFERENCES clientes(id_cliente),
  id_lote     INTEGER REFERENCES lotes(id_lote),
  servico     VARCHAR(100),
  url         VARCHAR(500),
  log         TEXT,
  query       TEXT,
  data_hora   TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_logs_usuario ON logs(id_usuario);
CREATE INDEX idx_logs_data ON logs(data_hora);
```

---

## 4. Diagrama ER

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  loteamentos │────<│    lotes     │────<│   vendas     │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                     ┌──────────────┐            │
                     │   clientes   │────────────┘
                     └──────────────┘            │
                                                 │
                     ┌──────────────┐     ┌──────┴───────┐
                     │    contas    │────<│  pagamentos  │
                     └──────────────┘     └──────┬───────┘
                                                 │
                     ┌──────────────┐            │
                     │   usuarios   │────────────┘
                     └──────────────┘
                           │
                     ┌─────┴────────┐
                     │     logs     │
                     └──────────────┘
```

---

## 5. API REST

### 5.1 Autenticação

| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/api/auth/login` | Login (retorna JWT) |
| POST | `/api/auth/logout` | Invalida sessão |
| GET | `/api/auth/me` | Dados do usuário logado |

**Request Login:**
```json
{ "login": "admin", "senha": "123456" }
```

**Response Login:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "usuario": {
    "id_usuario": 1,
    "login": "admin",
    "user_master": true
  }
}
```

### 5.2 Clientes

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/clientes` | Listar (com paginação e filtros) |
| GET | `/api/clientes/:id` | Detalhe |
| POST | `/api/clientes` | Criar |
| PUT | `/api/clientes/:id` | Atualizar |
| DELETE | `/api/clientes/:id` | Excluir |

**Query params (GET lista):**
```
?page=1&limit=20&search=joao&tipo=f
```

**Response (lista):**
```json
{
  "data": [...],
  "total": 150,
  "page": 1,
  "limit": 20,
  "totalPages": 8
}
```

### 5.3 Loteamentos

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/loteamentos` | Listar |
| GET | `/api/loteamentos/:id` | Detalhe (com contagem lotes) |
| POST | `/api/loteamentos` | Criar |
| PUT | `/api/loteamentos/:id` | Atualizar |
| DELETE | `/api/loteamentos/:id` | Excluir |

### 5.4 Lotes

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/loteamentos/:id/lotes` | Lotes de um loteamento |
| GET | `/api/lotes/:id` | Detalhe |
| POST | `/api/lotes` | Criar |
| PUT | `/api/lotes/:id` | Atualizar |
| DELETE | `/api/lotes/:id` | Excluir |
| GET | `/api/lotes/:id/status` | Status (disponível/vendido) |

### 5.5 Vendas

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/vendas` | Listar |
| GET | `/api/vendas/:id` | Detalhe com parcelas |
| POST | `/api/vendas` | Criar (gera parcelas) |
| PUT | `/api/vendas/:id` | Atualizar |
| DELETE | `/api/vendas/:id` | Cancelar |

**Request Criar Venda:**
```json
{
  "id_cliente": 1,
  "id_lote": 5,
  "data_venda": "2025-01-15",
  "valor_entrada": 15000.00,
  "parcelas": 36,
  "porcentagem": 1.5
}
```

**Lógica de geração de parcelas:**
```
valor_lote = calculado ou informado
saldo = valor_lote - valor_entrada
valor_parcela = saldo / num_parcelas
Para i = 1 até num_parcelas:
  vencimento = data_venda + (i * 30 dias)
  criar pagamento(numero_parcela=i, valor=valor_parcela, vencimento)
```

### 5.6 Pagamentos

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/pagamentos` | Listar (filtros por status/venda) |
| GET | `/api/pagamentos/:id` | Detalhe |
| POST | `/api/pagamentos/:id/baixa` | Baixa manual |
| POST | `/api/pagamentos/retorno` | Upload retorno bancário |
| GET | `/api/pagamentos/atrasados` | Títulos em atraso |

**Request Baixa Manual:**
```json
{
  "pago_data": "2025-02-10",
  "valor_pago": 1250.00,
  "id_conta": 1
}
```

**Lógica de Baixa:**
```
dias_atraso = MAX(0, pago_data - vencimento)
multa = 0
juros = 0

SE dias_atraso > 0:
  multa = valor * 0.02
  juros = valor * 0.002 * dias_atraso

valor_total = valor + multa + juros

UPDATE pagamento SET
  situacao = 'pago',
  pago_data = pago_data,
  valor_pago = valor_pago,
  multa = multa,
  juros = juros,
  id_conta = id_conta,
  id_usuario = usuario_logado
```

### 5.7 Contas Bancárias

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/contas` | Listar |
| POST | `/api/contas` | Criar |
| PUT | `/api/contas/:id` | Atualizar |
| DELETE | `/api/contas/:id` | Excluir |

### 5.8 Usuários

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/usuarios` | Listar |
| POST | `/api/usuarios` | Criar |
| PUT | `/api/usuarios/:id` | Atualizar permissões |
| DELETE | `/api/usuarios/:id` | Excluir |

### 5.9 Relatórios

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/relatorios/entradas` | Entradas por loteamento/ano |
| GET | `/api/relatorios/atrasados` | Títulos em atraso |
| GET | `/api/relatorios/total-conta` | Total por conta bancária |
| GET | `/api/relatorios/juros` | Juros recebidos |
| GET | `/api/relatorios/clientes-conta` | Clientes por conta |
| GET | `/api/relatorios/enderecos` | Endereços para carnê |

---

## 6. Regras de Negócio

### 6.1 Cálculo de Juros e Multa

```
SE dias_atraso > 0:
  multa = valor_original * 0.02          (2% fixo)
  juros = valor_original * 0.002 * dias  (0,20% ao dia, juros simples)
  valor_final = valor_original + multa + juros
SENÃO:
  valor_final = valor_original
```

### 6.2 Status da Venda

```
aberta    → Possui parcelas em aberto
quitada   → Todas parcelas pagas
cancelada → Venda cancelada manualmente
```

**Trigger:** Ao pagar última parcela, atualizar `vendas.status = 'quitada'`.

### 6.3 Status do Lote

```
disponível → Não possui venda ativa vinculada
vendido    → Possui venda com status 'aberta' ou 'quitada'
```

### 6.4 Permissões

```
SE usuario.user_master = true:
  acesso total a todos os módulos

SENÃO:
  validar flags específicas:
  - clientes_cadastrar, clientes_alterar, clientes_excluir
  - loteamentos_cadastrar, loteamentos_alterar, loteamentos_excluir
  - vendas_cadastrar, vendas_alterar, vendas_excluir
```

### 6.5 Validações Gerais

- Datas **nunca** podem ser `0000-00-00` ou `NULL` (quando obrigatórias)
- Valores monetários: **DECIMAL(12,2)**, nunca FLOAT
- CPF/CNPJ: validar formato e unicidade
- Login: único, mínimo 3 caracteres
- Senha: mínimo 6 caracteres, armazenar como bcrypt hash

---

## 7. Auditoria (Logs)

Toda operação de escrita deve gerar log:

```json
{
  "id_usuario": 1,
  "servico": "clientes",
  "url": "/api/clientes",
  "log": "CREATE",
  "query": "INSERT INTO clientes ...",
  "data_hora": "2025-02-10T14:30:00Z"
}
```

**Operações logadas:**
- INSERT, UPDATE, DELETE em todas as tabelas
- Login/Logout
- Baixa de pagamento
- Upload de retorno bancário

---

## 8. Autenticação e Segurança

### 8.1 JWT

```
Header: Authorization: Bearer <token>
Expiração: 8 horas
Refresh: não implementado (relogin)
Payload: { id_usuario, login, user_master, iat, exp }
```

### 8.2 Middleware de Permissão

```ts
// Exemplo NestJS
@UseGuards(AuthGuard, PermissionGuard)
@Permissions('clientes_cadastrar')
@Post('/clientes')
create(@Body() dto: CreateClienteDto) { ... }
```

### 8.3 Senhas

- Hash: bcrypt com salt rounds = 12
- Nunca armazenar em texto plano
- Nunca retornar hash na API

---

## 9. Paginação Padrão

Todas as rotas de listagem suportam:

| Param | Tipo | Default | Descrição |
|---|---|---|---|
| `page` | number | 1 | Página atual |
| `limit` | number | 20 | Itens por página |
| `search` | string | "" | Busca textual |
| `sort` | string | "id" | Campo de ordenação |
| `order` | string | "desc" | Direção (asc/desc) |

**Response padrão:**
```json
{
  "data": [...],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

---

## 10. Códigos de Erro

| Código | Significado |
|---|---|
| 200 | Sucesso |
| 201 | Criado com sucesso |
| 400 | Dados inválidos |
| 401 | Não autenticado |
| 403 | Sem permissão |
| 404 | Recurso não encontrado |
| 409 | Conflito (ex: CPF duplicado) |
| 422 | Erro de validação |
| 500 | Erro interno |

**Response de erro:**
```json
{
  "error": true,
  "code": "VALIDATION_ERROR",
  "message": "CPF já cadastrado",
  "details": [
    { "field": "cpf", "message": "Valor duplicado" }
  ]
}
```

---

## 11. Variáveis de Ambiente

```env
# Banco de Dados
DATABASE_URL=postgresql://user:pass@localhost:5432/sislote

# JWT
JWT_SECRET=sua-chave-secreta-aqui
JWT_EXPIRES_IN=8h

# App
PORT=3000
NODE_ENV=production

# Storage (opcional)
S3_BUCKET=sislote-files
S3_REGION=us-east-1
```

---

## 12. Migrations Recomendadas

Ordem de execução:

1. `001_create_usuarios.sql`
2. `002_create_contas.sql`
3. `003_create_clientes.sql`
4. `004_create_loteamentos.sql`
5. `005_create_lotes.sql`
6. `006_create_vendas.sql`
7. `007_create_pagamentos.sql`
8. `008_create_logs.sql`
9. `009_seed_admin_user.sql`

**Seed admin:**
```sql
INSERT INTO usuarios (login, senha, user_master)
VALUES ('admin', '$2b$12$...hash...', true);
```

---

## 13. Deploy

### Opção 1: Lovable Cloud
- Banco, auth e storage integrados
- Zero configuração
- Ideal para MVP e produção inicial

### Opção 2: VPS / Cloud
- PostgreSQL gerenciado (RDS, Supabase, Neon)
- API em container Docker
- Nginx como reverse proxy
- SSL via Let's Encrypt
- CI/CD via GitHub Actions
