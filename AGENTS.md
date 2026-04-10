# AGENTS.md

## Comunicação e fluxo de aprovação

- Antes de executar mudanças relevantes, descreva objetivamente **quais telas, rotas, serviços, endpoints, queries, entidades e arquivos** serão impactados.
- Para mudanças com risco funcional (ex.: vendas, pagamentos, licença, autenticação, migrações), confirme o impacto com o solicitante antes de aplicar.
- Comunicação sempre em **pt-BR**, direta e prática.

## Segurança de arquivos e ambiente

- **Nunca modificar arquivos read-only**.
- Se o arquivo estiver bloqueado/permissão negada, interromper e informar exatamente qual arquivo está bloqueado.
- Não forçar bypass de permissão.
- Nunca expor segredos em commits, logs ou documentação (JWT secret, API keys, credenciais Hub Billing).

## Integridade de configuração e texto

- Preservar encoding existente dos arquivos.
- Evitar alterações de formatação em massa sem necessidade.
- Em `.env` e documentação, mascarar dados sensíveis.

## Prioridades do projeto SISLOTE

- Estabilidade e previsibilidade acima de refatorações amplas.
- Alterações mínimas, com baixo risco e fácil rollback.
- Fluxos críticos têm prioridade:
  - autenticação e sessão;
  - regras de licença/plano/trial com Hub Billing;
  - vendas, parcelas e pagamentos;
  - auditoria e permissões por módulo.

## Continuidade arquitetural (stack atual)

- Frontend: React + TypeScript + Vite + TanStack Query + shadcn/ui.
- Backend: Node.js + Express + TypeORM + PostgreSQL.
- Manter padrões existentes do projeto (nomes, estrutura de pastas, contratos de API e comportamento de tela).
- Evitar introduzir novas arquiteturas/frameworks sem necessidade explícita.

## Regras de UI e fluxo

- Preservar UX atual, a menos que o pedido solicite mudança visual/fluxo.
- Em modais e wizards (ex.: Nova Venda), garantir:
  - abertura/fechamento consistente;
  - limpeza de estado ao fechar;
  - prevenção de loop de reabertura por query params.
- Em telas de negócio, priorizar mensagens de erro claras para o usuário.

## Regras de integração Hub Billing

- Fonte de verdade de acesso/trial/licença é o **Hub**.
- No login/onboarding: usar `POST /access/resolve`.
- Para atualização periódica: usar `GET /access/status`.
- Quando houver bloqueio/licença inválida, aplicar redirecionamento para fluxo de planos conforme regra do sistema.
- Não hardcodar dias de trial/plano quando já vêm do Hub.

## Disciplina de implementação

- Reutilizar padrões já existentes antes de criar solução nova.
- Manter regras de negócio no backend; frontend deve orquestrar e exibir.
- Toda alteração deve incluir validação mínima:
  - build frontend;
  - build backend;
  - teste funcional básico do fluxo alterado.

## Checklist antes de concluir

- Compatibilidade com fluxo atual do SISLOTE.
- Sem regressão de login/licença/permissão.
- Sem quebra em vendas/pagamentos.
- Sem vazamento de segredo.
- Mudança pequena, rastreável e reversível.

