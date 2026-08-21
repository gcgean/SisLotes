"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reguaCobrancaRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const data_source_1 = require("../../db/data-source");
const auth_1 = require("../../middleware/auth");
const AuditoriaService_1 = require("../../services/AuditoriaService");
exports.reguaCobrancaRouter = (0, express_1.Router)();
exports.reguaCobrancaRouter.use(auth_1.requireAuth, (0, auth_1.requireFeature)("module_pagamentos"));
const schema = zod_1.z.object({ nome: zod_1.z.string().trim().min(1).max(100), dias_relativos: zod_1.z.number().int().min(-365).max(365), canal: zod_1.z.enum(["email", "whatsapp"]), assunto: zod_1.z.string().trim().max(150).nullish(), mensagem: zod_1.z.string().trim().min(1).max(3000), ativo: zod_1.z.boolean().optional().default(false) });
exports.reguaCobrancaRouter.get("/", async (req, res) => res.json(await data_source_1.AppDataSource.query(`SELECT * FROM cobranca_regras WHERE id_empresa=$1 ORDER BY dias_relativos,id_regra`, [req.user.id_empresa])));
exports.reguaCobrancaRouter.post("/", async (req, res) => { const p = schema.safeParse(req.body); if (!p.success)
    return res.status(400).json({ error: "Dados inválidos", issues: p.error.issues }); const [s] = await data_source_1.AppDataSource.query(`INSERT INTO cobranca_regras(id_empresa,nome,dias_relativos,canal,assunto,mensagem,ativo,id_usuario)VALUES($1,$2,$3,$4,$5,$6,$7,$8)RETURNING *`, [req.user.id_empresa, p.data.nome, p.data.dias_relativos, p.data.canal, p.data.assunto || null, p.data.mensagem, p.data.ativo, req.user.id_usuario]); await AuditoriaService_1.AuditoriaService.registrar(req, "cobranca_regras", "CREATE", s.id_regra, undefined, s, "Regra de cobrança criada"); return res.status(201).json(s); });
exports.reguaCobrancaRouter.patch("/:id/status", async (req, res) => { const p = zod_1.z.object({ ativo: zod_1.z.boolean() }).safeParse(req.body); if (!p.success)
    return res.status(400).json({ error: "Status inválido" }); const [a] = await data_source_1.AppDataSource.query(`SELECT * FROM cobranca_regras WHERE id_regra=$1 AND id_empresa=$2`, [Number(req.params.id), req.user.id_empresa]); if (!a)
    return res.status(404).json({ error: "Regra não encontrada" }); const [s] = await data_source_1.AppDataSource.query(`UPDATE cobranca_regras SET ativo=$1,updated_at=now() WHERE id_regra=$2 AND id_empresa=$3 RETURNING *`, [p.data.ativo, a.id_regra, a.id_empresa]); await AuditoriaService_1.AuditoriaService.registrar(req, "cobranca_regras", "UPDATE", s.id_regra, a, s, p.data.ativo ? "Regra ativada" : "Regra desativada"); return res.json(s); });
exports.reguaCobrancaRouter.get("/:id/preview", async (req, res) => { const [r] = await data_source_1.AppDataSource.query(`SELECT * FROM cobranca_regras WHERE id_regra=$1 AND id_empresa=$2`, [Number(req.params.id), req.user.id_empresa]); if (!r)
    return res.status(404).json({ error: "Regra não encontrada" }); const [c] = await data_source_1.AppDataSource.query(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE CASE WHEN $3='email' THEN NULLIF(TRIM(c.email),'') ELSE COALESCE(NULLIF(TRIM(c.fone_res),''),NULLIF(TRIM(c.fone_com),'')) END IS NOT NULL)::int AS com_contato,COALESCE(SUM(p.valor),0)::numeric AS valor FROM pagamentos p JOIN vendas v ON v.id_venda=p.id_venda JOIN clientes c ON c.id_cliente=v.id_cliente WHERE p.id_empresa=$1 AND p.situacao='aberto' AND v.status<>'cancelada' AND p.vencimento+($2::integer)=CURRENT_DATE`, [req.user.id_empresa, r.dias_relativos, r.canal]); return res.json({ regra: r, total: Number(c.total), comContato: Number(c.com_contato), semContato: Number(c.total) - Number(c.com_contato), valor: Number(c.valor), envioHabilitado: false }); });
