# SISLOTE — Sistema de Controle de Loteamentos

Sistema de gestão imobiliária para controle de loteamentos, lotes, clientes, vendas e pagamentos de parcelas.

## Tecnologias

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend:** Node.js + Express + TypeORM + PostgreSQL
- **PWA:** vite-plugin-pwa (instalável em dispositivos móveis)
- **Autenticação:** JWT com renovação automática de token

## Como executar

### Pré-requisitos
- Node.js 18+
- PostgreSQL

### Instalação

```sh
# 1. Instalar dependências do frontend
npm install

# 2. Instalar dependências do backend
cd backend && npm install

# 3. Configurar variáveis de ambiente do backend
# Crie backend/.env com:
# DATABASE_URL=postgres://usuario:senha@localhost:5432/sislote
# JWT_SECRET=sua-chave-secreta

# 4. Iniciar frontend (porta 4175)
npm run dev

# 5. Iniciar backend (porta 3334)
cd backend && npm run dev
```

## Funcionalidades

- Gestão de **Loteamentos** e **Lotes**
- Cadastro de **Clientes**
- Registro de **Vendas** com geração automática de parcelas
- **Pagamentos** com baixa manual, cálculo de multa/juros e emissão de recibo
- **Relatórios**: entradas, atraso, endereços, contas, juros
- **Contrato** e **Minuta** editáveis para impressão
- **Auditoria** de ações do sistema
- Suporte a **PWA** (instalável no celular)
- **Tema claro/escuro** por preferência do usuário

## Diretrizes para IA/Automação (Codex)

Este repositório possui um arquivo de diretrizes em [AGENTS.md](C:\Projetos Web\SisLotes\AGENTS.md) com regras de trabalho para alterações no projeto.

Resumo do que ele define:

- comunicação em pt-BR e descrição prévia de impacto em mudanças sensíveis;
- foco em estabilidade, mudanças mínimas e rollback simples;
- proteção de segredos e respeito a arquivos read-only;
- manutenção dos padrões atuais (React/Node/TypeORM) e continuidade dos fluxos;
- atenção especial para regras de licença/plano/trial com Hub Billing;
- validação mínima (build frontend/backend + teste funcional do fluxo alterado).

Se você for integrar novos agentes/skills, mantenha este arquivo como fonte principal de comportamento global do projeto.
