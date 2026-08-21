"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const data_source_1 = require("../../db/data-source");
const Empresa_1 = require("../../entities/Empresa");
const Usuario_1 = require("../../entities/Usuario");
const TelegramConfig_1 = require("../../entities/TelegramConfig");
const TelegramService_1 = require("../../services/TelegramService");
const HubBillingService_1 = require("../../services/HubBillingService");
const auth_1 = require("../../middleware/auth");
exports.adminRouter = (0, express_1.Router)();
// Todas as rotas exigem autenticação + ser user_master
exports.adminRouter.use(auth_1.requireAuth, auth_1.requireMaster);
// ─── GET /admin/empresas ─────────────────────────────────────────────────────
// Lista todas as empresas com contagem de usuários
exports.adminRouter.get("/empresas", async (_req, res) => {
    try {
        const empresaRepo = data_source_1.AppDataSource.getRepository(Empresa_1.Empresa);
        const usuarioRepo = data_source_1.AppDataSource.getRepository(Usuario_1.Usuario);
        const empresas = await empresaRepo.find({ order: { id_empresa: "ASC" } });
        // Conta usuários por empresa
        const contagemRaw = await usuarioRepo
            .createQueryBuilder("u")
            .select("u.id_empresa", "id_empresa")
            .addSelect("COUNT(u.id_usuario)", "total_usuarios")
            .groupBy("u.id_empresa")
            .getRawMany();
        const contagemMap = new Map(contagemRaw.map((r) => [r.id_empresa, Number(r.total_usuarios)]));
        const result = empresas.map((e) => ({
            ...e,
            total_usuarios: contagemMap.get(e.id_empresa) ?? 0,
        }));
        return res.json(result);
    }
    catch (error) {
        console.error("Erro ao listar empresas (admin):", error);
        return res.status(500).json({ error: "Erro ao listar empresas" });
    }
});
// ─── GET /admin/empresas/:id ─────────────────────────────────────────────────
exports.adminRouter.get("/empresas/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);
        const empresaRepo = data_source_1.AppDataSource.getRepository(Empresa_1.Empresa);
        const empresa = await empresaRepo.findOne({ where: { id_empresa: id } });
        if (!empresa)
            return res.status(404).json({ error: "Empresa não encontrada" });
        return res.json(empresa);
    }
    catch (error) {
        return res.status(500).json({ error: "Erro ao buscar empresa" });
    }
});
// ─── POST /admin/empresas ────────────────────────────────────────────────────
const empresaSchema = zod_1.z.object({
    nome_fantasia: zod_1.z.string().min(1),
    razao_social: zod_1.z.string().optional().nullable(),
    cnpj: zod_1.z.string().optional().nullable(),
    ie: zod_1.z.string().optional().nullable(),
    endereco: zod_1.z.string().optional().nullable(),
    bairro: zod_1.z.string().optional().nullable(),
    cidade: zod_1.z.string().optional().nullable(),
    estado: zod_1.z.string().optional().nullable(),
    cep: zod_1.z.string().optional().nullable(),
    telefone: zod_1.z.string().optional().nullable(),
    email: zod_1.z.string().optional().nullable(),
    site: zod_1.z.string().optional().nullable(),
    ativo: zod_1.z.boolean().optional(),
    plano: zod_1.z.string().optional().nullable(),
    data_vencimento: zod_1.z.string().optional().nullable(),
    observacoes: zod_1.z.string().optional().nullable(),
    hub_customer_id: zod_1.z.string().max(80).optional().nullable(),
    hub_product_code: zod_1.z.string().max(80).optional().nullable(),
    hub_license_status: zod_1.z.string().max(40).optional().nullable(),
    hub_license_reason: zod_1.z.string().max(80).optional().nullable(),
    hub_expires_at: zod_1.z.string().optional().nullable(),
    hub_features: zod_1.z.record(zod_1.z.unknown()).optional().nullable(),
    ignorar_controle_planos: zod_1.z.boolean().optional(),
});
exports.adminRouter.post("/empresas", async (req, res) => {
    try {
        const parse = empresaSchema.safeParse(req.body);
        if (!parse.success)
            return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });
        const empresaRepo = data_source_1.AppDataSource.getRepository(Empresa_1.Empresa);
        const empresa = empresaRepo.create({
            ...parse.data,
            hub_expires_at: parse.data.hub_expires_at ? new Date(parse.data.hub_expires_at) : null,
            ativo: parse.data.ativo ?? true,
        });
        await empresaRepo.save(empresa);
        return res.status(201).json(empresa);
    }
    catch (error) {
        console.error("Erro ao criar empresa (admin):", error);
        return res.status(500).json({ error: "Erro ao criar empresa" });
    }
});
// ─── PUT /admin/empresas/:id ─────────────────────────────────────────────────
exports.adminRouter.put("/empresas/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);
        const parse = empresaSchema.partial().safeParse(req.body);
        if (!parse.success)
            return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });
        const empresaRepo = data_source_1.AppDataSource.getRepository(Empresa_1.Empresa);
        const empresa = await empresaRepo.findOne({ where: { id_empresa: id } });
        if (!empresa)
            return res.status(404).json({ error: "Empresa não encontrada" });
        Object.assign(empresa, {
            ...parse.data,
            hub_expires_at: parse.data.hub_expires_at ? new Date(parse.data.hub_expires_at) : null,
        });
        await empresaRepo.save(empresa);
        return res.json(empresa);
    }
    catch (error) {
        console.error("Erro ao atualizar empresa (admin):", error);
        return res.status(500).json({ error: "Erro ao atualizar empresa" });
    }
});
// ─── PATCH /admin/empresas/:id/toggle-ativo ──────────────────────────────────
exports.adminRouter.patch("/empresas/:id/toggle-ativo", async (req, res) => {
    try {
        const id = Number(req.params.id);
        const empresaRepo = data_source_1.AppDataSource.getRepository(Empresa_1.Empresa);
        const empresa = await empresaRepo.findOne({ where: { id_empresa: id } });
        if (!empresa)
            return res.status(404).json({ error: "Empresa não encontrada" });
        empresa.ativo = !empresa.ativo;
        await empresaRepo.save(empresa);
        return res.json({ id_empresa: empresa.id_empresa, ativo: empresa.ativo });
    }
    catch (error) {
        return res.status(500).json({ error: "Erro ao alterar status da empresa" });
    }
});
// ─── PATCH /admin/empresas/:id/toggle-controle-planos ────────────────────────
exports.adminRouter.patch("/empresas/:id/toggle-controle-planos", async (req, res) => {
    try {
        const id = Number(req.params.id);
        const empresaRepo = data_source_1.AppDataSource.getRepository(Empresa_1.Empresa);
        const empresa = await empresaRepo.findOne({ where: { id_empresa: id } });
        if (!empresa)
            return res.status(404).json({ error: "Empresa não encontrada" });
        empresa.ignorar_controle_planos = !empresa.ignorar_controle_planos;
        await empresaRepo.save(empresa);
        return res.json({
            id_empresa: empresa.id_empresa,
            ignorar_controle_planos: empresa.ignorar_controle_planos,
        });
    }
    catch (error) {
        return res.status(500).json({ error: "Erro ao alterar controle de planos da empresa" });
    }
});
// ─── DELETE /admin/empresas/:id ──────────────────────────────────────────────
exports.adminRouter.delete("/empresas/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);
        const empresaRepo = data_source_1.AppDataSource.getRepository(Empresa_1.Empresa);
        const empresa = await empresaRepo.findOne({ where: { id_empresa: id } });
        if (!empresa)
            return res.status(404).json({ error: "Empresa não encontrada" });
        await empresaRepo.remove(empresa);
        return res.status(204).send();
    }
    catch (error) {
        console.error("Erro ao excluir empresa (admin):", error);
        return res.status(500).json({ error: "Erro ao excluir empresa" });
    }
});
// ─── GET /admin/stats ────────────────────────────────────────────────────────
exports.adminRouter.get("/stats", async (_req, res) => {
    try {
        const empresaRepo = data_source_1.AppDataSource.getRepository(Empresa_1.Empresa);
        const usuarioRepo = data_source_1.AppDataSource.getRepository(Usuario_1.Usuario);
        const [totalEmpresas, ativas, inativas, totalUsuarios] = await Promise.all([
            empresaRepo.count(),
            empresaRepo.count({ where: { ativo: true } }),
            empresaRepo.count({ where: { ativo: false } }),
            usuarioRepo.count(),
        ]);
        return res.json({ totalEmpresas, ativas, inativas, totalUsuarios });
    }
    catch (error) {
        return res.status(500).json({ error: "Erro ao buscar estatísticas" });
    }
});
// ═══════════════════════════════════════════════════════════════════════════
//  Dashboard — Jornada do usuário (trial → pago), uso do sistema, geografia
// ═══════════════════════════════════════════════════════════════════════════
function isTrialLicenseStatusAdmin(empresa) {
    const status = (empresa.hub_license_status || "").toLowerCase();
    const reason = (empresa.hub_license_reason || "").toLowerCase();
    return status === "trial" || status === "trialing" || reason === "trial_active";
}
function isPaidLicenseStatusAdmin(empresa) {
    const status = (empresa.hub_license_status || "").toLowerCase();
    return status === "licensed" || status === "active";
}
function diffDias(de, ate) {
    return Math.floor((ate.getTime() - de.getTime()) / (24 * 3600 * 1000));
}
function resolveDaysLeft(empresa) {
    const stored = HubBillingService_1.HubBillingService.getStoredDaysLeft(empresa);
    if (stored != null)
        return stored;
    const expiresRaw = empresa.hub_expires_at ?? (empresa.data_vencimento ? new Date(empresa.data_vencimento) : null);
    if (!expiresRaw)
        return null;
    const expires = expiresRaw instanceof Date ? expiresRaw : new Date(expiresRaw);
    if (Number.isNaN(expires.getTime()))
        return null;
    return diffDias(new Date(), expires);
}
async function getEmpresasJourney() {
    const empresaRepo = data_source_1.AppDataSource.getRepository(Empresa_1.Empresa);
    const empresas = await empresaRepo.find({ order: { created_at: "DESC" } });
    const counts = (await data_source_1.AppDataSource.query(`
    SELECT
      e.id_empresa,
      COALESCE(lot.cnt, 0)::int AS loteamentos,
      COALESCE(lt.cnt, 0)::int  AS lotes,
      COALESCE(v.cnt, 0)::int   AS vendas,
      COALESCE(p.cnt, 0)::int   AS pagamentos_pagos,
      COALESCE(d.cnt, 0)::int   AS despesas
    FROM empresas e
    LEFT JOIN (SELECT id_empresa, COUNT(*) cnt FROM loteamentos GROUP BY id_empresa) lot ON lot.id_empresa = e.id_empresa
    LEFT JOIN (SELECT id_empresa, COUNT(*) cnt FROM lotes GROUP BY id_empresa) lt ON lt.id_empresa = e.id_empresa
    LEFT JOIN (SELECT id_empresa, COUNT(*) cnt FROM vendas GROUP BY id_empresa) v ON v.id_empresa = e.id_empresa
    LEFT JOIN (SELECT id_empresa, COUNT(*) cnt FROM pagamentos WHERE situacao = 'pago' GROUP BY id_empresa) p ON p.id_empresa = e.id_empresa
    LEFT JOIN (SELECT id_empresa, COUNT(*) cnt FROM despesas GROUP BY id_empresa) d ON d.id_empresa = e.id_empresa
  `));
    const countsMap = new Map(counts.map((c) => [c.id_empresa, c]));
    // Contato do usuário master de cada empresa (fallback para contato da empresa)
    const contatos = (await data_source_1.AppDataSource.query(`
    SELECT DISTINCT ON (id_empresa) id_empresa, telefone, email
    FROM usuarios
    WHERE user_master = true
    ORDER BY id_empresa, id_usuario ASC
  `));
    const contatoMap = new Map(contatos.map((c) => [c.id_empresa, c]));
    const agora = new Date();
    return empresas.map((e) => {
        const c = countsMap.get(e.id_empresa) ?? { loteamentos: 0, lotes: 0, vendas: 0, pagamentos_pagos: 0, despesas: 0 };
        const isTrial = isTrialLicenseStatusAdmin(e);
        const isPaid = isPaidLicenseStatusAdmin(e) || (!isTrial && Boolean(e.plano) && e.plano !== "TESTE");
        const diasRestantes = resolveDaysLeft(e);
        const diasCadastro = diffDias(new Date(e.created_at), agora);
        const ultimoAcesso = e.ultimo_acesso ? new Date(e.ultimo_acesso) : null;
        const diasSemAcesso = ultimoAcesso ? diffDias(ultimoAcesso, agora) : diasCadastro;
        const motivos = [];
        const semUso = c.loteamentos === 0 && c.lotes === 0 && c.vendas === 0;
        if (isTrial && diasCadastro >= 3 && semUso)
            motivos.push("sem_uso");
        if (e.ativo && diasSemAcesso >= 5)
            motivos.push("sem_acesso");
        if (isTrial && diasRestantes != null && diasRestantes <= 3 && diasRestantes >= 0 && !isPaid) {
            motivos.push("trial_vencendo");
        }
        const contato = contatoMap.get(e.id_empresa);
        return {
            id_empresa: e.id_empresa,
            nome_fantasia: e.nome_fantasia,
            cidade: e.cidade ?? null,
            estado: e.estado ?? null,
            telefone: e.telefone ?? contato?.telefone ?? null,
            email: e.email ?? contato?.email ?? null,
            plano: e.plano ?? null,
            ativo: e.ativo,
            created_at: e.created_at,
            ultimo_acesso: e.ultimo_acesso ?? null,
            is_trial: isTrial,
            is_paid: isPaid,
            dias_restantes: diasRestantes,
            loteamentos: c.loteamentos,
            lotes: c.lotes,
            vendas: c.vendas,
            pagamentos_pagos: c.pagamentos_pagos,
            despesas: c.despesas,
            motivos_ajuda: motivos,
        };
    });
}
// ─── GET /admin/dashboard/overview ────────────────────────────────────────────
exports.adminRouter.get("/dashboard/overview", async (_req, res) => {
    try {
        const empresaRepo = data_source_1.AppDataSource.getRepository(Empresa_1.Empresa);
        const usuarioRepo = data_source_1.AppDataSource.getRepository(Usuario_1.Usuario);
        const [totalEmpresas, ativas, inativas, totalUsuarios, journey, serieRows] = await Promise.all([
            empresaRepo.count(),
            empresaRepo.count({ where: { ativo: true } }),
            empresaRepo.count({ where: { ativo: false } }),
            usuarioRepo.count(),
            getEmpresasJourney(),
            data_source_1.AppDataSource.query(`
        SELECT TO_CHAR(created_at, 'YYYY-MM-DD') AS dia, COUNT(*)::int AS total
        FROM empresas
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY dia ORDER BY dia
      `),
        ]);
        const trials = journey.filter((j) => j.is_trial).length;
        const pagas = journey.filter((j) => j.is_paid).length;
        return res.json({
            totalEmpresas,
            ativas,
            inativas,
            totalUsuarios,
            trials,
            pagas,
            serieCadastros: serieRows,
        });
    }
    catch (error) {
        console.error("Erro ao buscar overview do dashboard:", error);
        return res.status(500).json({ error: "Erro ao buscar visão geral" });
    }
});
// ─── GET /admin/dashboard/empresas ───────────────────────────────────────────
exports.adminRouter.get("/dashboard/empresas", async (_req, res) => {
    try {
        const journey = await getEmpresasJourney();
        return res.json(journey);
    }
    catch (error) {
        console.error("Erro ao buscar jornada das empresas:", error);
        return res.status(500).json({ error: "Erro ao buscar uso do sistema" });
    }
});
// ─── GET /admin/dashboard/funil ──────────────────────────────────────────────
exports.adminRouter.get("/dashboard/funil", async (_req, res) => {
    try {
        const journey = await getEmpresasJourney();
        const total = journey.length;
        const comLoteamento = journey.filter((j) => j.loteamentos > 0).length;
        const comLote = journey.filter((j) => j.lotes > 0).length;
        const comVenda = journey.filter((j) => j.vendas > 0).length;
        const comPagamento = journey.filter((j) => j.pagamentos_pagos > 0).length;
        const convertidas = journey.filter((j) => j.is_paid).length;
        const precisaAjuda = journey.filter((j) => j.motivos_ajuda.length > 0);
        const trialsVencendo = journey.filter((j) => j.motivos_ajuda.includes("trial_vencendo"));
        return res.json({
            funil: {
                cadastradas: total,
                comLoteamento,
                comLote,
                comVenda,
                comPagamento,
                convertidasPago: convertidas,
            },
            precisaAjuda,
            trialsVencendo,
        });
    }
    catch (error) {
        console.error("Erro ao buscar funil:", error);
        return res.status(500).json({ error: "Erro ao buscar funil" });
    }
});
// ─── GET /admin/dashboard/geografia ──────────────────────────────────────────
exports.adminRouter.get("/dashboard/geografia", async (_req, res) => {
    try {
        const [porEstado, porCidade] = await Promise.all([
            data_source_1.AppDataSource.query(`
        SELECT COALESCE(NULLIF(estado, ''), 'Não informado') AS estado, COUNT(*)::int AS total
        FROM empresas GROUP BY estado ORDER BY total DESC
      `),
            data_source_1.AppDataSource.query(`
        SELECT COALESCE(NULLIF(cidade, ''), 'Não informado') AS cidade,
               COALESCE(NULLIF(estado, ''), '—') AS estado, COUNT(*)::int AS total
        FROM empresas GROUP BY cidade, estado ORDER BY total DESC LIMIT 20
      `),
        ]);
        return res.json({ porEstado, porCidade });
    }
    catch (error) {
        console.error("Erro ao buscar geografia:", error);
        return res.status(500).json({ error: "Erro ao buscar geografia" });
    }
});
// ─── GET /admin/dashboard/empresas/:id/timeline ──────────────────────────────
// Timeline de billing (Hub) por empresa: trial → checkout → pago.
exports.adminRouter.get("/dashboard/empresas/:id/timeline", async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id))
            return res.status(400).json({ error: "ID inválido" });
        const [eventos, cobrancas] = await Promise.all([
            data_source_1.AppDataSource.query(`SELECT id_hub_event, event_type, event_source, status, amount, created_at
         FROM hub_billing_events WHERE id_empresa = $1 ORDER BY created_at ASC`, [id]),
            data_source_1.AppDataSource.query(`SELECT id_hub_charge, origin_type, status, amount, created_at
         FROM hub_billing_charges WHERE id_empresa = $1 ORDER BY created_at ASC`, [id]),
        ]);
        return res.json({ eventos, cobrancas });
    }
    catch (error) {
        console.error("Erro ao buscar timeline da empresa:", error);
        return res.status(500).json({ error: "Erro ao buscar timeline" });
    }
});
// ═══════════════════════════════════════════════════════════════════════════
//  Notificações via Telegram (novos leads)
// ═══════════════════════════════════════════════════════════════════════════
const recipientSchema = zod_1.z.object({
    nome: zod_1.z.string().max(120).optional().default(""),
    chat_id: zod_1.z.string().min(1, "chat_id obrigatório").max(40),
});
const telegramConfigSchema = zod_1.z.object({
    ativo: zod_1.z.boolean().optional(),
    bot_token: zod_1.z.string().max(200).optional().nullable(),
    notificar_novo_lead: zod_1.z.boolean().optional(),
    notificar_pagamento: zod_1.z.boolean().optional(),
    notificar_trial: zod_1.z.boolean().optional(),
    recipients: zod_1.z.array(recipientSchema).optional(),
});
// ─── GET /admin/telegram ─────────────────────────────────────────────────────
exports.adminRouter.get("/telegram", async (_req, res) => {
    try {
        const config = await TelegramService_1.TelegramService.ensureConfig();
        return res.json({
            ativo: config.ativo,
            bot_token: config.bot_token ?? "",
            notificar_novo_lead: config.notificar_novo_lead,
            notificar_pagamento: config.notificar_pagamento,
            notificar_trial: config.notificar_trial,
            recipients: config.recipients ?? [],
        });
    }
    catch (error) {
        console.error("Erro ao buscar config Telegram:", error);
        return res.status(500).json({ error: "Erro ao buscar configuração do Telegram" });
    }
});
// ─── PUT /admin/telegram ─────────────────────────────────────────────────────
exports.adminRouter.put("/telegram", async (req, res) => {
    try {
        const parse = telegramConfigSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });
        }
        const config = await TelegramService_1.TelegramService.ensureConfig();
        const data = parse.data;
        if (data.ativo !== undefined)
            config.ativo = data.ativo;
        if (data.notificar_novo_lead !== undefined)
            config.notificar_novo_lead = data.notificar_novo_lead;
        if (data.notificar_pagamento !== undefined)
            config.notificar_pagamento = data.notificar_pagamento;
        if (data.notificar_trial !== undefined)
            config.notificar_trial = data.notificar_trial;
        if (data.bot_token !== undefined)
            config.bot_token = data.bot_token?.trim() || null;
        if (data.recipients !== undefined) {
            config.recipients = data.recipients.map((r) => ({
                nome: (r.nome || "").trim(),
                chat_id: r.chat_id.trim(),
            }));
        }
        const repo = data_source_1.AppDataSource.getRepository(TelegramConfig_1.TelegramConfig);
        await repo.save(config);
        return res.json({
            ativo: config.ativo,
            bot_token: config.bot_token ?? "",
            notificar_novo_lead: config.notificar_novo_lead,
            notificar_pagamento: config.notificar_pagamento,
            notificar_trial: config.notificar_trial,
            recipients: config.recipients ?? [],
        });
    }
    catch (error) {
        console.error("Erro ao salvar config Telegram:", error);
        return res.status(500).json({ error: "Erro ao salvar configuração do Telegram" });
    }
});
// ─── POST /admin/telegram/detectar ───────────────────────────────────────────
// Lista os chats que já enviaram mensagem ao bot (para descobrir o chat_id).
exports.adminRouter.post("/telegram/detectar", async (req, res) => {
    try {
        const token = req.body?.bot_token?.trim() || (await TelegramService_1.TelegramService.getConfig())?.bot_token || "";
        if (!token)
            return res.status(400).json({ error: "Informe o token do bot primeiro." });
        const chats = await TelegramService_1.TelegramService.detectChats(token);
        return res.json({ chats });
    }
    catch (error) {
        return res.status(400).json({ error: error instanceof Error ? error.message : "Falha ao detectar chats" });
    }
});
// ─── POST /admin/telegram/test ───────────────────────────────────────────────
exports.adminRouter.post("/telegram/test", async (_req, res) => {
    try {
        const config = await TelegramService_1.TelegramService.getConfig();
        if (!config?.bot_token)
            return res.status(400).json({ error: "Configure o token do bot antes de testar." });
        if (!config.recipients?.length)
            return res.status(400).json({ error: "Adicione pelo menos um destinatário." });
        const texto = TelegramService_1.TelegramService.buildNovoLeadMessage({
            empresa: "IMOBILIÁRIA EXEMPLO LTDA",
            responsavel: "João da Silva",
            telefone: "(88) 99999-0000",
            email: "contato@exemplo.com",
            cidade: "Fortaleza",
            estado: "CE",
            plano: "TESTE",
        });
        const resultado = await TelegramService_1.TelegramService.broadcast(`🧪 <b>Mensagem de teste</b>\n\n${texto}`);
        if (resultado.enviados === 0) {
            return res.status(400).json({ error: resultado.erros.join(" | ") || "Nenhuma mensagem enviada." });
        }
        return res.json({ success: true, ...resultado });
    }
    catch (error) {
        return res.status(500).json({ error: error instanceof Error ? error.message : "Erro ao enviar teste" });
    }
});
// ═══════════════════════════════════════════════════════════════════════════
//  Analytics da Landing Page (/lp)
// ═══════════════════════════════════════════════════════════════════════════
const lpAnalyticsSchema = zod_1.z.object({
    from: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
exports.adminRouter.get("/lp/analytics", async (req, res) => {
    const parse = lpAnalyticsSchema.safeParse(req.query);
    if (!parse.success)
        return res.status(400).json({ error: "Parâmetros inválidos" });
    // Janela padrão: últimos 30 dias
    const hoje = new Date();
    const to = parse.data.to ? new Date(parse.data.to + "T23:59:59") : new Date(hoje.getTime() + 24 * 3600 * 1000);
    const from = parse.data.from ? new Date(parse.data.from + "T00:00:00") : new Date(hoje.getTime() - 30 * 24 * 3600 * 1000);
    const params = [from.toISOString(), to.toISOString()];
    const win = "created_at >= $1 AND created_at <= $2";
    try {
        const [resumoRows, funnelRows, ctaRows, fonteRows, serieRows, recentesRows] = await Promise.all([
            data_source_1.AppDataSource.query(`SELECT
           COUNT(*) FILTER (WHERE tipo='pageview')                        AS visitas,
           COUNT(DISTINCT visitor_id) FILTER (WHERE tipo='pageview')      AS visitantes,
           COUNT(DISTINCT session_id) FILTER (WHERE tipo='pageview')      AS sessoes,
           COUNT(*) FILTER (WHERE tipo='cta')                             AS cta_clicks,
           COUNT(DISTINCT session_id) FILTER (WHERE tipo='cta')           AS sessoes_cta,
           AVG(duracao) FILTER (WHERE tipo='exit')                        AS tempo_medio,
           AVG(scroll_pct) FILTER (WHERE tipo='exit')                     AS scroll_medio
         FROM lp_evento WHERE ${win}`, params),
            data_source_1.AppDataSource.query(`SELECT secao, COUNT(DISTINCT session_id) AS sessoes
         FROM lp_evento WHERE tipo='section' AND secao IS NOT NULL AND ${win}
         GROUP BY secao`, params),
            data_source_1.AppDataSource.query(`SELECT cta, COUNT(*) AS cliques, COUNT(DISTINCT session_id) AS sessoes
         FROM lp_evento WHERE tipo='cta' AND cta IS NOT NULL AND ${win}
         GROUP BY cta ORDER BY cliques DESC`, params),
            data_source_1.AppDataSource.query(`SELECT COALESCE(NULLIF(utm_source, ''), 'Direto/Orgânico') AS fonte,
                COUNT(DISTINCT session_id) AS sessoes
         FROM lp_evento WHERE tipo='pageview' AND ${win}
         GROUP BY fonte ORDER BY sessoes DESC LIMIT 10`, params),
            data_source_1.AppDataSource.query(`SELECT TO_CHAR(created_at, 'YYYY-MM-DD') AS dia,
                COUNT(*) FILTER (WHERE tipo='pageview')              AS visitas,
                COUNT(DISTINCT session_id) FILTER (WHERE tipo='cta') AS conversoes
         FROM lp_evento WHERE ${win}
         GROUP BY dia ORDER BY dia`, params),
            data_source_1.AppDataSource.query(`SELECT visitor_id, device,
                COALESCE(NULLIF(utm_source, ''), 'Direto/Orgânico') AS fonte,
                referrer, ip, TO_CHAR(created_at, 'DD/MM/YYYY HH24:MI') AS quando
         FROM lp_evento WHERE tipo='pageview' AND ${win}
         ORDER BY created_at DESC LIMIT 25`, params),
        ]);
        const r = resumoRows[0] || {};
        const num = (v) => Number(v ?? 0);
        const funnelMap = new Map(funnelRows.map((x) => [x.secao, num(x.sessoes)]));
        return res.json({
            periodo: { from: from.toISOString(), to: to.toISOString() },
            resumo: {
                visitas: num(r.visitas),
                visitantes: num(r.visitantes),
                sessoes: num(r.sessoes),
                ctaClicks: num(r.cta_clicks),
                sessoesComCta: num(r.sessoes_cta),
                ctr: num(r.sessoes) > 0 ? num(r.sessoes_cta) / num(r.sessoes) : 0,
                tempoMedioSeg: Math.round(num(r.tempo_medio)),
                scrollMedioPct: Math.round(num(r.scroll_medio)),
            },
            funnel: Object.fromEntries(funnelMap),
            ctas: ctaRows.map((x) => ({
                cta: x.cta,
                cliques: num(x.cliques),
                sessoes: num(x.sessoes),
            })),
            fontes: fonteRows.map((x) => ({
                fonte: x.fonte,
                sessoes: num(x.sessoes),
            })),
            serie: serieRows.map((x) => ({
                dia: x.dia,
                visitas: num(x.visitas),
                conversoes: num(x.conversoes),
            })),
            recentes: recentesRows.map((x) => ({
                visitorId: x.visitor_id ?? null,
                device: x.device ?? null,
                fonte: x.fonte ?? null,
                referrer: x.referrer ?? null,
                ip: x.ip ?? null,
                quando: x.quando ?? null,
            })),
        });
    }
    catch (error) {
        console.error("Erro ao gerar analytics da LP:", error);
        return res.status(500).json({ error: "Erro ao gerar analytics" });
    }
});
