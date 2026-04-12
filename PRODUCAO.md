# Configurações de Produção

Para rodar o SISLOTE em ambiente de produção, siga os passos abaixo.

## 1. Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto `SisLotes/backend` com as seguintes configurações (ajuste conforme seu banco de dados):

```env
# Configurações do Banco de Dados
DB_HOST=localhost
DB_PORT=5432
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_NAME=sislote

# Configurações da API
PORT=3334
JWT_SECRET=segredo_super_seguro_para_producao_troque_isso

# Integração Hub Billing (produção)
HUB_BILLING_BASE_URL=https://seu-hub/api/v1
HUB_BILLING_API_KEY=hub_live_xxxxxxxxx
HUB_BILLING_PRODUCT_ID=uuid-do-produto-no-hub
HUB_BILLING_ADMIN_EMAIL=admin@seudominio.com
HUB_BILLING_ADMIN_PASSWORD=senha_forte
HUB_BILLING_WEBHOOK_SECRET=segredo_webhook

# Opcional: Se precisar rodar migrações automaticamente
RUN_MIGRATIONS=true
```

Importante:
1. `HUB_BILLING_API_KEY` e `HUB_BILLING_PRODUCT_ID` devem ser do mesmo produto no Hub.
2. Não reutilizar credenciais de homologação/teste em produção.

## 2. Construção (Build)

Antes de subir para produção, é **essencial** gerar os arquivos compilados tanto do frontend quanto do backend. O problema de login não barrar usuários inexistentes ocorre porque o servidor pode estar rodando uma versão antiga do código.

Na raiz do projeto (`c:\Projetos Web\SisLotes`), execute:

```bash
# Instala todas as dependências
npm install
cd backend && npm install && cd ..

# Gera o build do frontend e do backend
npm run build:all
```

Isso irá:
1.  Gerar o frontend na pasta `dist/`.
2.  Gerar o backend na pasta `backend/dist/`.

## 3. Execução

Para iniciar o servidor em modo de produção (que serve tanto a API quanto o Frontend):

```bash
npm start
```

Ou diretamente pelo backend:

```bash
cd backend
npm start
```

O sistema estará disponível em: `http://localhost:3334` (ou a porta definida no `.env`).

## Solução de Problemas

### Login aceitando qualquer senha
Se o sistema aceitar login com senha errada, significa que o servidor está rodando uma versão antiga do código `dist/`.
**Solução:** Pare o servidor, rode `npm run build:all` e inicie novamente com `npm start`.

### Frontend não carrega
Certifique-se de que a pasta `dist` existe na raiz do projeto. O backend foi configurado para servir os arquivos estáticos dessa pasta.

### Produção não comunica com o Hub Billing
Se em teste funciona e em produção não:

1. Verifique se o `.env` usado no serviço de produção contém as variáveis `HUB_BILLING_*` corretas.
2. Reinicie o serviço após alterar variáveis.
3. Rode diagnóstico:
   - `cd backend`
   - `npm run hub:diag`
4. Confira logs HTTP para identificar o código real retornado pelo Hub (`401`, `403`, `404`, `422`, `429`, `5xx`).
5. Verifique rede do servidor:
   - DNS resolve o domínio do Hub
   - HTTPS/TLS liberado
   - firewall/proxy não bloqueando saída
6. Garanta que o proxy não remova headers `X-API-Key` e `Authorization`.
7. Confirme relógio do servidor sincronizado (NTP) para evitar erro com token JWT admin.

### Checklist de validação pós-deploy (Hub)
1. Cadastrar uma nova empresa em produção.
2. Confirmar que foi criado/associado `hub_customer_id` localmente.
3. Abrir `/planos` e validar planos ativos vindos do Hub.
4. Validar status de licença na dashboard (`trial`/`licensed`, prazo correto).
5. Efetuar um pagamento de teste e confirmar atualização de cobrança/licença.
