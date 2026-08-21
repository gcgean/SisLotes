"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const dotenv_1 = __importDefault(require("dotenv"));
const app_1 = require("./app");
const data_source_1 = require("./db/data-source");
const Usuario_1 = require("./entities/Usuario");
const TrialScheduler_1 = require("./services/TrialScheduler");
const DespesaRecorrenteScheduler_1 = require("./services/DespesaRecorrenteScheduler");
dotenv_1.default.config();
const port = process.env.PORT ? Number(process.env.PORT) : 3334;
async function seedMasterUser() {
    try {
        const repo = data_source_1.AppDataSource.getRepository(Usuario_1.Usuario);
        const exists = await repo
            .createQueryBuilder("u")
            .where("LOWER(u.login) = LOWER(:login)", { login: "gcgean" })
            .getOne();
        if (!exists) {
            const master = repo.create({
                login: "gcgean",
                senha: "Command%$#@!",
                user_master: true,
                id_empresa: 1,
                clientes_cadastrar: true,
                clientes_alterar: true,
                clientes_excluir: true,
                loteamentos_cadastrar: true,
                loteamentos_alterar: true,
                loteamentos_excluir: true,
                vendas_cadastrar: true,
                vendas_alterar: true,
                vendas_excluir: true,
            });
            await repo.save(master);
            console.log("Usuário master gcgean criado com sucesso.");
        }
    }
    catch (error) {
        console.error("Erro ao criar usuário master:", error);
    }
}
data_source_1.AppDataSource.initialize()
    .then(async () => {
    await data_source_1.AppDataSource.runMigrations();
    await seedMasterUser();
    const app = (0, app_1.createApp)();
    app.listen(port, () => {
        console.log(`SISLOTE backend rodando na porta ${port}`);
    });
    // Agendador de avisos de trial (vencendo/expirado) via Telegram
    (0, TrialScheduler_1.startTrialScheduler)();
    // Agendador de contas a pagar recorrentes (gera a próxima parcela mensal automaticamente)
    (0, DespesaRecorrenteScheduler_1.startDespesaRecorrenteScheduler)();
})
    .catch((error) => {
    console.error("Erro ao inicializar DataSource", error);
    process.exit(1);
});
