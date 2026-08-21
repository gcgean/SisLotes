"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orcamentosRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const data_source_1 = require("../../db/data-source");
const auth_1 = require("../../middleware/auth");
const AuditoriaService_1 = require("../../services/AuditoriaService");
const plano_contas_1 = require("../../utils/plano-contas");
exports.orcamentosRouter = (0, express_1.Router)();
exports.orcamentosRouter.use(auth_1.requireAuth, (0, auth_1.requireFeature)("module_despesas"));
const schema = zod_1.z.object({ id_loteamento: zod_1.z.number().int().positive(), id_conta_contabil: zod_1.z.number().int().positive(), mes: zod_1.z.string().regex(/^\d{4}-\d{2}$/), valor: zod_1.z.number().min(0) });
const query = zod_1.z.object({ ano: zod_1.z.string().regex(/^\d{4}$/) });
async function validar(e, d) { const [l] = await data_source_1.AppDataSource.query(`SELECT 1 FROM loteamentos WHERE id_loteamento=$1 AND id_empresa=$2`, [d.id_loteamento, e]); if (!l)
    return "Loteamento inválido"; if (!await (0, plano_contas_1.contaContabilAceitaLancamento)(d.id_conta_contabil, e))
    return "Conta contábil inválida ou sintética"; return null; }
exports.orcamentosRouter.get("/", async (req, res) => { const p = query.safeParse(req.query); if (!p.success)
    return res.status(400).json({ error: "Ano inválido" }); const rows = await data_source_1.AppDataSource.query(`SELECT o.*,l.nome AS loteamento,pc.codigo,pc.nome AS conta,pc.tipo FROM orcamentos_loteamento o JOIN loteamentos l ON l.id_loteamento=o.id_loteamento JOIN plano_de_contas pc ON pc.id_conta_contabil=o.id_conta_contabil WHERE o.id_empresa=$1 AND o.mes>=$2::date AND o.mes<($2::date+INTERVAL '1 year') ORDER BY o.mes,l.nome,pc.codigo`, [req.user.id_empresa, `${p.data.ano}-01-01`]); return res.json(rows.map(r => ({ ...r, valor: Number(r.valor), mes: String(r.mes).slice(0, 7) }))); });
exports.orcamentosRouter.put("/", async (req, res) => { const p = schema.safeParse(req.body); if (!p.success)
    return res.status(400).json({ error: "Dados inválidos", issues: p.error.issues }); const e = req.user.id_empresa, erro = await validar(e, p.data); if (erro)
    return res.status(400).json({ error: erro }); const mes = `${p.data.mes}-01`; const [a] = await data_source_1.AppDataSource.query(`SELECT * FROM orcamentos_loteamento WHERE id_empresa=$1 AND id_loteamento=$2 AND id_conta_contabil=$3 AND mes=$4`, [e, p.data.id_loteamento, p.data.id_conta_contabil, mes]); const [s] = await data_source_1.AppDataSource.query(`INSERT INTO orcamentos_loteamento(id_empresa,id_loteamento,id_conta_contabil,mes,valor,id_usuario)VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id_empresa,id_loteamento,id_conta_contabil,mes) DO UPDATE SET valor=EXCLUDED.valor,id_usuario=EXCLUDED.id_usuario,updated_at=now() RETURNING *`, [e, p.data.id_loteamento, p.data.id_conta_contabil, mes, p.data.valor, req.user.id_usuario]); await AuditoriaService_1.AuditoriaService.registrar(req, "orcamentos_loteamento", a ? "UPDATE" : "CREATE", s.id_orcamento, a, s, "Orçamento mensal salvo"); return res.json(s); });
exports.orcamentosRouter.delete("/:id", async (req, res) => { const [a] = await data_source_1.AppDataSource.query(`DELETE FROM orcamentos_loteamento WHERE id_orcamento=$1 AND id_empresa=$2 RETURNING *`, [Number(req.params.id), req.user.id_empresa]); if (!a)
    return res.status(404).json({ error: "Orçamento não encontrado" }); await AuditoriaService_1.AuditoriaService.registrar(req, "orcamentos_loteamento", "DELETE", a.id_orcamento, a, undefined, "Orçamento excluído"); return res.status(204).send(); });
