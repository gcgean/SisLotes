import "reflect-metadata";
import dotenv from "dotenv";
import { createApp } from "./app";
import { AppDataSource } from "./db/data-source";

dotenv.config();

const port = process.env.PORT ? Number(process.env.PORT) : 3333;

AppDataSource.initialize()
  .then(async () => {
    await AppDataSource.runMigrations();

    const app = createApp();

    app.listen(port, () => {
      console.log(`SISLOTE backend rodando na porta ${port}`);
    });
  })
  .catch((error) => {
    console.error("Erro ao inicializar DataSource", error);
    process.exit(1);
  });
