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

# Opcional: Se precisar rodar migrações automaticamente
RUN_MIGRATIONS=true
```

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
