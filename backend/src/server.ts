import "reflect-metadata";
import dotenv from "dotenv";
import { createApp } from "./app";
import { AppDataSource } from "./db/data-source";
import { Usuario } from "./entities/Usuario";
import { startTrialScheduler } from "./services/TrialScheduler";

dotenv.config();

const port = process.env.PORT ? Number(process.env.PORT) : 3334;

async function seedMasterUser() {
  try {
    const repo = AppDataSource.getRepository(Usuario);
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
  } catch (error) {
    console.error("Erro ao criar usuário master:", error);
  }
}

AppDataSource.initialize()
  .then(async () => {
    await AppDataSource.runMigrations();
    await seedMasterUser();

    const app = createApp();

    app.listen(port, () => {
      console.log(`SISLOTE backend rodando na porta ${port}`);
    });

    // Agendador de avisos de trial (vencendo/expirado) via Telegram
    startTrialScheduler();
  })
  .catch((error) => {
    console.error("Erro ao inicializar DataSource", error);
    process.exit(1);
  });
