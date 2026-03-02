import { Router } from "express";
import { authRouter } from "./modules/auth";
import { clientesRouter } from "./modules/clientes";
import { loteamentosRouter } from "./modules/loteamentos";
import { lotesRouter } from "./modules/lotes";
import { vendasRouter } from "./modules/vendas";
import { pagamentosRouter } from "./modules/pagamentos";
import { contasRouter } from "./modules/contas";
import { usuariosRouter } from "./modules/usuarios";
import { logsRouter } from "./modules/logs";
import { empresasRouter } from "./modules/empresas";
import { relatoriosRouter } from "./modules/relatorios";

export const router = Router();

router.use("/auth", authRouter);
router.use("/clientes", clientesRouter);
router.use("/loteamentos", loteamentosRouter);
router.use("/lotes", lotesRouter);
router.use("/vendas", vendasRouter);
router.use("/pagamentos", pagamentosRouter);
router.use("/contas", contasRouter);
router.use("/usuarios", usuariosRouter);
router.use("/logs", logsRouter);
router.use("/empresas", empresasRouter);
router.use("/relatorios", relatoriosRouter);
