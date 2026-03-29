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
