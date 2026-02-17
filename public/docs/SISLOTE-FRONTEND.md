# SISLOTE – Documentação Front-End

## 1. Visão Geral

Sistema web de gestão de loteamentos imobiliários construído com React, TypeScript, Tailwind CSS e shadcn/ui.

---

## 2. Stack Tecnológica

| Tecnologia | Versão | Finalidade |
|---|---|---|
| React | 18.x | Framework UI |
| TypeScript | 5.x | Tipagem estática |
| Vite | 5.x | Build tool / Dev server |
| Tailwind CSS | 4.x | Estilização utilitária |
| shadcn/ui | latest | Componentes base |
| React Router DOM | 6.x | Roteamento SPA |
| TanStack React Query | 5.x | Gerenciamento de estado servidor |
| React Hook Form | 7.x | Formulários |
| Zod | 3.x | Validação de schemas |
| Recharts | 2.x | Gráficos |
| Lucide React | 0.46x | Ícones |
| date-fns | 3.x | Manipulação de datas |

---

## 3. Estrutura de Pastas

```
src/
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx        # Layout principal com sidebar
│   │   └── AppSidebar.tsx       # Sidebar de navegação
│   ├── ui/                      # Componentes shadcn/ui
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── table.tsx
│   │   ├── tabs.tsx
│   │   ├── badge.tsx
│   │   ├── switch.tsx
│   │   ├── sidebar.tsx
│   │   └── ...
│   ├── NavLink.tsx              # Link de navegação ativo
│   └── PlaceholderPage.tsx      # Página placeholder
├── hooks/
│   ├── use-mobile.tsx           # Detecção mobile
│   └── use-toast.ts             # Sistema de notificações
├── lib/
│   └── utils.ts                 # Utilitários (cn, formatters)
├── pages/
│   ├── Dashboard.tsx            # Painel principal com KPIs
│   ├── Clientes.tsx             # CRUD de clientes
│   ├── Loteamentos.tsx          # Gestão de loteamentos
│   ├── Lotes.tsx                # Gestão de lotes
│   ├── Vendas.tsx               # Registro de vendas
│   ├── Pagamentos.tsx           # Controle financeiro
│   ├── Relatorios.tsx           # Relatórios gerenciais
│   ├── Configuracoes.tsx        # Contas bancárias e permissões
│   └── NotFound.tsx             # Página 404
├── App.tsx                      # Rotas e providers
├── main.tsx                     # Entry point
└── index.css                    # Design tokens e estilos globais
```

---

## 4. Rotas

| Rota | Componente | Descrição |
|---|---|---|
| `/` | `Dashboard` | Painel com KPIs e resumos |
| `/clientes` | `Clientes` | Listagem e gestão de clientes |
| `/loteamentos` | `Loteamentos` | Cards de loteamentos |
| `/lotes` | `Lotes` | Lotes por loteamento |
| `/vendas` | `Vendas` | Registro e acompanhamento |
| `/pagamentos` | `Pagamentos` | Baixa manual e financeiro |
| `/relatorios` | `Relatorios` | Relatórios gerenciais |
| `/configuracoes` | `Configuracoes` | Contas e permissões |
| `*` | `NotFound` | Página não encontrada |

---

## 5. Design System

### 5.1 Tema (Dark Mode)

Todas as cores são definidas como variáveis HSL em `index.css`:

```css
:root {
  --background: 222 47% 11%;
  --foreground: 210 40% 98%;
  --primary: 160 60% 45%;
  --primary-foreground: 210 40% 98%;
  --secondary: 217 33% 17%;
  --muted: 217 33% 17%;
  --accent: 217 33% 17%;
  --destructive: 0 63% 31%;
  --card: 222 47% 13%;
  --border: 217 33% 20%;
}
```

### 5.2 Componentes Utilitários

| Classe | Uso |
|---|---|
| `glass-card` | Cards com fundo translúcido e borda |
| `animate-fade-in` | Animação de entrada suave |
| `font-mono` | Dados numéricos (CPF, contas) |

### 5.3 Regras de Estilização

- **Nunca** usar cores diretamente (`text-white`, `bg-black`)
- **Sempre** usar tokens semânticos (`text-foreground`, `bg-card`)
- Espaçamentos consistentes: `space-y-6` para seções, `gap-4` para grids
- Tabelas: `px-5 py-3` para células

---

## 6. Módulos Detalhados

### 6.1 Dashboard

**Arquivo:** `src/pages/Dashboard.tsx`

- **KPIs:** 4 cards (Receita, Vendas, Inadimplência, Lotes Disponíveis)
- **Tabelas:** Vendas recentes e títulos em atraso
- **Dados:** Mock data (substituir por API)

### 6.2 Clientes

**Arquivo:** `src/pages/Clientes.tsx`

| Funcionalidade | Status |
|---|---|
| Listagem com tabela | ✅ |
| Busca por nome | ✅ |
| Filtro PF/PJ | ✅ |
| Cadastro (modal) | 🔲 Pendente |
| Edição | 🔲 Pendente |
| Exclusão com confirmação | 🔲 Pendente |
| Campos dinâmicos PF/PJ | 🔲 Pendente |

**Tipos:**
```ts
interface Cliente {
  id_cliente: number;
  tipo: 'f' | 'j';
  nome: string;
  razao_social?: string;
  cpf?: string;
  cnpj?: string;
  rg?: string;
  estado_civil?: string;
  conjuge?: string;
  profissao?: string;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  complemento?: string;
  fone_res?: string;
  fone_com?: string;
}
```

### 6.3 Loteamentos

**Arquivo:** `src/pages/Loteamentos.tsx`

- Exibição em **cards** com barra de progresso de vendas
- Dados do proprietário
- Contagem de lotes vendidos/disponíveis

### 6.4 Lotes

**Arquivo:** `src/pages/Lotes.tsx`

- Listagem em tabela com filtro por loteamento
- Status: `disponível` | `vendido`
- Dados: quadra, lote, área, medidas

### 6.5 Vendas

**Arquivo:** `src/pages/Vendas.tsx`

- Listagem com dados do cliente, lote, parcelas
- Status: `aberta` | `quitada` | `cancelada`
- Badges coloridos por status

### 6.6 Pagamentos

**Arquivo:** `src/pages/Pagamentos.tsx`

- **KPIs:** Valor aberto, atrasado, pago
- **Tabela:** Parcelas com vencimento, status, ações
- **Baixa Manual:** Dialog com:
  - Data do pagamento
  - Valor pago (com cálculo automático de juros/multa)
  - Conta bancária destino
- **Cálculo de Juros:**
  ```ts
  multa = valor * 0.02           // 2% fixo
  juros = valor * 0.002 * dias   // 0,20% ao dia
  total = valor + multa + juros
  ```

### 6.7 Relatórios

**Arquivo:** `src/pages/Relatorios.tsx`

| Relatório | Descrição |
|---|---|
| Entradas por loteamento | Agrupado por ano |
| Endereços para carnê | Dados de endereço dos clientes |
| Títulos em atraso | Parcelas vencidas |
| Total por conta | Agrupado por conta bancária |
| Juros recebidos | Multas e juros cobrados |
| Clientes por conta | Vinculação cliente-conta |

### 6.8 Configurações

**Arquivo:** `src/pages/Configuracoes.tsx`

**Aba Contas Bancárias:**
- Tabela com apelido, titular, agência, conta, convênio
- Ações: editar, excluir

**Aba Usuários & Permissões:**
- Cards por usuário com avatar
- Badge "Master" para administradores
- Grid de permissões por módulo (clientes, loteamentos, vendas)
- Flags: cadastrar, alterar, excluir

---

## 7. Componentes Reutilizáveis (A Implementar)

| Componente | Descrição |
|---|---|
| `DataTable` | Tabela genérica com sort/filter/pagination |
| `CurrencyInput` | Input monetário formatado (R$) |
| `ConfirmDialog` | Diálogo de confirmação para exclusões |
| `PermissionWrapper` | HOC que valida permissões do usuário |
| `FormPF` | Formulário de Pessoa Física |
| `FormPJ` | Formulário de Pessoa Jurídica |
| `StatusBadge` | Badge com cores por status |

---

## 8. Estado e Gerenciamento

### 8.1 Estado Local
- `useState` para filtros, modais, formulários
- Dados mock em arrays constantes por página

### 8.2 Estado Servidor (Futuro)
- TanStack React Query para cache e sincronização
- Mutations para operações CRUD
- Invalidação automática de queries

### 8.3 Formulários (Futuro)
- React Hook Form + Zod para validação
- Schemas Zod espelhando modelo de dados

---

## 9. Convenções de Código

- Componentes: PascalCase (`AppLayout.tsx`)
- Hooks: camelCase com prefixo `use` (`use-mobile.tsx`)
- Páginas: PascalCase singular (`Clientes.tsx`)
- Imports: alias `@/` para `src/`
- CSS: Tailwind classes, sem CSS modules
- Idioma: Interface em pt-BR, código em inglês/português misto
