"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cobrancasRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const data_source_1 = require("../../db/data-source");
const auth_1 = require("../../middleware/auth");
const AuditoriaService_1 = require("../../services/AuditoriaService");
exports.cobrancasRouter = (0, express_1.Router)();
exports.cobrancasRouter.use(auth_1.requireAuth, (0, auth_1.requireFeature)("module_despesas"));
const schema = zod_1.z.object({ tipo: zod_1.z.enum(["boleto", "pix"]), descricao: zod_1.z.string().trim().min(1).max(300), valor: zod_1.z.number().positive(), vencimento: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/), id_pagamento: zod_1.z.number().int().positive().nullish(), id_conta: zod_1.z.number().int().positive().nullish() });
async function validarVinculos(idEmpresa, d) { if (d.id_conta) {
    const [c] = await data_source_1.AppDataSource.query(`SELECT 1 FROM contas WHERE id_conta=$1 AND id_empresa=$2`, [d.id_conta, idEmpresa]);
    if (!c)
        return "Conta bancária inválida";
} if (d.id_pagamento) {
    const [p] = await data_source_1.AppDataSource.query(`SELECT 1 FROM pagamentos WHERE id_pagamento=$1 AND id_empresa=$2`, [d.id_pagamento, idEmpresa]);
    if (!p)
        return "Parcela de recebimento inválida";
} return null; }
exports.cobrancasRouter.get("/", async (req, res) => res.json(await data_source_1.AppDataSource.query(`SELECT c.*,co.apelido AS conta_apelido FROM cobrancas_bancarias c LEFT JOIN contas co ON co.id_conta=c.id_conta WHERE c.id_empresa=$1 ORDER BY c.vencimento DESC,c.id_cobranca DESC`, [req.user.id_empresa])));
exports.cobrancasRouter.post("/", async (req, res) => { const p = schema.safeParse(req.body); if (!p.success)
    return res.status(400).json({ error: "Dados inválidos", issues: p.error.issues }); const e = req.user.id_empresa; const erro = await validarVinculos(e, p.data); if (erro)
    return res.status(400).json({ error: erro }); const [s] = await data_source_1.AppDataSource.query(`INSERT INTO cobrancas_bancarias(id_empresa,id_pagamento,id_conta,tipo,descricao,valor,vencimento,id_usuario)VALUES($1,$2,$3,$4,$5,$6,$7,$8)RETURNING *`, [e, p.data.id_pagamento ?? null, p.data.id_conta ?? null, p.data.tipo, p.data.descricao, p.data.valor, p.data.vencimento, req.user.id_usuario]); await AuditoriaService_1.AuditoriaService.registrar(req, "cobrancas_bancarias", "CREATE", s.id_cobranca, undefined, s, "Rascunho de cobrança criado"); return res.status(201).json(s); });
exports.cobrancasRouter.put("/:id", async (req, res) => { const p = schema.safeParse(req.body); if (!p.success)
    return res.status(400).json({ error: "Dados inválidos" }); const e = req.user.id_empresa; const [a] = await data_source_1.AppDataSource.query(`SELECT * FROM cobrancas_bancarias WHERE id_cobranca=$1 AND id_empresa=$2`, [Number(req.params.id), e]); if (!a)
    return res.status(404).json({ error: "Cobrança não encontrada" }); if (a.status !== "rascunho")
    return res.status(409).json({ error: "Somente rascunhos podem ser editados" }); const erro = await validarVinculos(e, p.data); if (erro)
    return res.status(400).json({ error: erro }); const [s] = await data_source_1.AppDataSource.query(`UPDATE cobrancas_bancarias SET tipo=$1,descricao=$2,valor=$3,vencimento=$4,id_pagamento=$5,id_conta=$6,updated_at=now() WHERE id_cobranca=$7 AND id_empresa=$8 RETURNING *`, [p.data.tipo, p.data.descricao, p.data.valor, p.data.vencimento, p.data.id_pagamento ?? null, p.data.id_conta ?? null, a.id_cobranca, e]); await AuditoriaService_1.AuditoriaService.registrar(req, "cobrancas_bancarias", "UPDATE", s.id_cobranca, a, s, "Rascunho de cobrança editado"); return res.json(s); });
exports.cobrancasRouter.delete("/:id", async (req, res) => { const [a] = await data_source_1.AppDataSource.query(`UPDATE cobrancas_bancarias SET status='cancelada',updated_at=now() WHERE id_cobranca=$1 AND id_empresa=$2 AND status='rascunho' RETURNING *`, [Number(req.params.id), req.user.id_empresa]); if (!a)
    return res.status(404).json({ error: "Rascunho não encontrado" }); await AuditoriaService_1.AuditoriaService.registrar(req, "cobrancas_bancarias", "UPDATE", a.id_cobranca, { status: "rascunho" }, { status: "cancelada" }, "Rascunho de cobrança cancelado"); return res.status(204).send(); });
