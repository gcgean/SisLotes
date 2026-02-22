import "reflect-metadata";
import { DataSource } from "typeorm";
import { Cliente } from "../entities/Cliente";
import { Loteamento } from "../entities/Loteamento";
import { Lote } from "../entities/Lote";
import { Conta } from "../entities/Conta";
import { Usuario } from "../entities/Usuario";
import { Venda } from "../entities/Venda";
import { Pagamento } from "../entities/Pagamento";
import { Log } from "../entities/Log";
import { CreateClientes1700000000000 } from "../migrations/1700000000000-CreateClientes";
import { CreateCoreTables1700000000001 } from "../migrations/1700000000001-CreateCoreTables";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5433),
  username: process.env.DB_USER || "sislote",
  password: process.env.DB_PASSWORD || "sislote",
  database: process.env.DB_NAME || "sislote",
  entities: [Cliente, Loteamento, Lote, Conta, Usuario, Venda, Pagamento, Log],
  migrations: [CreateClientes1700000000000, CreateCoreTables1700000000001],
  synchronize: false,
  logging: false,
});
