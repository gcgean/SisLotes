import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { Empresa } from "../../entities/Empresa";
import { Usuario } from "../../entities/Usuario";
import { TelegramConfig } from "../../entities/TelegramConfig";
import { TelegramService } from "../../services/TelegramService";
import { requireAuth, requireMaster } from "../../middleware/auth";

export const adminRouter = Router();

// Todas as rotas exigem autenticação + ser user_master
adminRouter.use(requireAuth, requireMaster);

// ─── GET /admin/empresas ─────────────────────────────────────────────────────
// Lista todas as empresas com contagem de usuários
adminRouter.get("/empresas", async (_req, res) => {
  try {
    const empresaRepo = AppDataSource.getRepository(Empresa);
    const usuarioRepo = AppDataSource.getRepository(Usuario);

    const empresas = await empresaRepo.find({ order: { id_empresa: "ASC" } });

    // Conta usuários por empresa
    const contagemRaw = await usuarioRepo
      .createQueryBuilder("u")
      .select("u.id_empresa", "id_empresa")
      .addSelect("COUNT(u.id_usuario)", "total_usuarios")
      .groupBy("u.id_empresa")
      .getRawMany<{ id_empresa: number; total_usuarios: string }>();

    const contagemMap = new Map(contagemRaw.map((r) => [r.id_empresa, Number(r.total_usuarios)]));

    const result = empresas.map((e) => ({
      ...e,
      total_usuarios: contagemMap.get(e.id_empresa) ?? 0,
    }));

    return res.json(result);
  } catch (error) {
    console.error("Erro ao listar empresas (admin):", error);
    return res.status(500).json({ error: "Erro ao listar empresas" });
  }
});

// ─── GET /admin/empresas/:id ─────────────────────────────────────────────────
adminRouter.get("/empresas/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const empresaRepo = AppDataSource.getRepository(Empresa);
    const empresa = await empresaRepo.findOne({ where: { id_empresa: id } });
    if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });
    return res.json(empresa);
  } catch (error) {
    return res.status(500).json({ error: "Erro ao buscar empresa" });
  }
});

// ─── POST /admin/empresas ────────────────────────────────────────────────────
const empresaSchema = z.object({
  nome_fantasia: z.string().min(1),
  razao_social: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable(),
  ie: z.string().optional().nullable(),
  endereco: z.string().optional().nullable(),
  bairro: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  estado: z.string().optional().nullable(),
  cep: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  site: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
  plano: z.string().optional().nullable(),
  data_vencimento: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  hub_customer_id: z.string().max(80).optional().nullable(),
  hub_product_code: z.string().max(80).optional().nullable(),
  hub_license_status: z.string().max(40).optional().nullable(),
  hub_license_reason: z.string().max(80).optional().nullable(),
  hub_expires_at: z.string().optional().nullable(),
  hub_features: z.record(z.unknown()).optional().nullable(),
  ignorar_controle_planos: z.boolean().optional(),
});

adminRouter.post("/empresas", async (req, res) => {
  try {
    const parse = empresaSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });

    const empresaRepo = AppDataSource.getRepository(Empresa);
    const empresa = empresaRepo.create({
      ...parse.data,
      hub_expires_at: parse.data.hub_expires_at ? new Date(parse.data.hub_expires_at) : null,
      ativo: parse.data.ativo ?? true,
    });
    await empresaRepo.save(empresa);

    return res.status(201).json(empresa);
  } catch (error) {
    console.error("Erro ao criar empresa (admin):", error);
    return res.status(500).json({ error: "Erro ao criar empresa" });
  }
});

// ─── PUT /admin/empresas/:id ─────────────────────────────────────────────────
adminRouter.put("/empresas/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parse = empresaSchema.partial().safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });

    const empresaRepo = AppDataSource.getRepository(Empresa);
    const empresa = await empresaRepo.findOne({ where: { id_empresa: id } });
    if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });

    Object.assign(empresa, {
      ...parse.data,
      hub_expires_at: parse.data.hub_expires_at ? new Date(parse.data.hub_expires_at) : null,
    });
    await empresaRepo.save(empresa);

    return res.json(empresa);
  } catch (error) {
    console.error("Erro ao atualizar empresa (admin):", error);
    return res.status(500).json({ error: "Erro ao atualizar empresa" });
  }
});

// ─── PATCH /admin/empresas/:id/toggle-ativo ──────────────────────────────────
adminRouter.patch("/empresas/:id/toggle-ativo", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const empresaRepo = AppDataSource.getRepository(Empresa);
    const empresa = await empresaRepo.findOne({ where: { id_empresa: id } });
    if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });

    empresa.ativo = !empresa.ativo;
    await empresaRepo.save(empresa);

    return res.json({ id_empresa: empresa.id_empresa, ativo: empresa.ativo });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao alterar status da empresa" });
  }
});

// ─── PATCH /admin/empresas/:id/toggle-controle-planos ────────────────────────
adminRouter.patch("/empresas/:id/toggle-controle-planos", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const empresaRepo = AppDataSource.getRepository(Empresa);
    const empresa = await empresaRepo.findOne({ where: { id_empresa: id } });
    if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });

    empresa.ignorar_controle_planos = !empresa.ignorar_controle_planos;
    await empresaRepo.save(empresa);

    return res.json({
      id_empresa: empresa.id_empresa,
      ignorar_controle_planos: empresa.ignorar_controle_planos,
    });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao alterar controle de planos da empresa" });
  }
});

// ─── DELETE /admin/empresas/:id ──────────────────────────────────────────────
adminRouter.delete("/empresas/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const empresaRepo = AppDataSource.getRepository(Empresa);
    const empresa = await empresaRepo.findOne({ where: { id_empresa: id } });
    if (!empresa) return res.status(404).json({ error: "Empresa não encontrada" });

    await empresaRepo.remove(empresa);
    return res.status(204).send();
  } catch (error) {
    console.error("Erro ao excluir empresa (admin):", error);
    return res.status(500).json({ error: "Erro ao excluir empresa" });
  }
});

// ─── GET /admin/stats ────────────────────────────────────────────────────────
adminRouter.get("/stats", async (_req, res) => {
  try {
    const empresaRepo = AppDataSource.getRepository(Empresa);
    const usuarioRepo = AppDataSource.getRepository(Usuario);

    const [totalEmpresas, ativas, inativas, totalUsuarios] = await Promise.all([
      empresaRepo.count(),
      empresaRepo.count({ where: { ativo: true } }),
      empresaRepo.count({ where: { ativo: false } }),
      usuarioRepo.count(),
    ]);

    return res.json({ totalEmpresas, ativas, inativas, totalUsuarios });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao buscar estatísticas" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  Notificações via Telegram (novos leads)
// ═══════════════════════════════════════════════════════════════════════════

const recipientSchema = z.object({
  nome: z.string().max(120).optional().default(""),
  chat_id: z.string().min(1, "chat_id obrigatório").max(40),
});

const telegramConfigSchema = z.object({
  ativo: z.boolean().optional(),
  bot_token: z.string().max(200).optional().nullable(),
  notificar_novo_lead: z.boolean().optional(),
  notificar_pagamento: z.boolean().optional(),
  notificar_trial: z.boolean().optional(),
  recipients: z.array(recipientSchema).optional(),
});

// ─── GET /admin/telegram ─────────────────────────────────────────────────────
adminRouter.get("/telegram", async (_req, res) => {
  try {
    const config = await TelegramService.ensureConfig();
    return res.json({
      ativo: config.ativo,
      bot_token: config.bot_token ?? "",
      notificar_novo_lead: config.notificar_novo_lead,
      notificar_pagamento: config.notificar_pagamento,
      notificar_trial: config.notificar_trial,
      recipients: config.recipients ?? [],
    });
  } catch (error) {
    console.error("Erro ao buscar config Telegram:", error);
    return res.status(500).json({ error: "Erro ao buscar configuração do Telegram" });
  }
});

// ─── PUT /admin/telegram ─────────────────────────────────────────────────────
adminRouter.put("/telegram", async (req, res) => {
  try {
    const parse = telegramConfigSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: "Dados inválidos", issues: parse.error.issues });
    }

    const config = await TelegramService.ensureConfig();
    const data = parse.data;

    if (data.ativo !== undefined) config.ativo = data.ativo;
    if (data.notificar_novo_lead !== undefined) config.notificar_novo_lead = data.notificar_novo_lead;
    if (data.notificar_pagamento !== undefined) config.notificar_pagamento = data.notificar_pagamento;
    if (data.notificar_trial !== undefined) config.notificar_trial = data.notificar_trial;
    if (data.bot_token !== undefined) config.bot_token = data.bot_token?.trim() || null;
    if (data.recipients !== undefined) {
      config.recipients = data.recipients.map((r) => ({
        nome: (r.nome || "").trim(),
        chat_id: r.chat_id.trim(),
      }));
    }

    const repo = AppDataSource.getRepository(TelegramConfig);
    await repo.save(config);

    return res.json({
      ativo: config.ativo,
      bot_token: config.bot_token ?? "",
      notificar_novo_lead: config.notificar_novo_lead,
      notificar_pagamento: config.notificar_pagamento,
      notificar_trial: config.notificar_trial,
      recipients: config.recipients ?? [],
    });
  } catch (error) {
    console.error("Erro ao salvar config Telegram:", error);
    return res.status(500).json({ error: "Erro ao salvar configuração do Telegram" });
  }
});

// ─── POST /admin/telegram/detectar ───────────────────────────────────────────
// Lista os chats que já enviaram mensagem ao bot (para descobrir o chat_id).
adminRouter.post("/telegram/detectar", async (req, res) => {
  try {
    const token = (req.body?.bot_token as string | undefined)?.trim() || (await TelegramService.getConfig())?.bot_token || "";
    if (!token) return res.status(400).json({ error: "Informe o token do bot primeiro." });
    const chats = await TelegramService.detectChats(token);
    return res.json({ chats });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Falha ao detectar chats" });
  }
});

// ─── POST /admin/telegram/test ───────────────────────────────────────────────
adminRouter.post("/telegram/test", async (_req, res) => {
  try {
    const config = await TelegramService.getConfig();
    if (!config?.bot_token) return res.status(400).json({ error: "Configure o token do bot antes de testar." });
    if (!config.recipients?.length) return res.status(400).json({ error: "Adicione pelo menos um destinatário." });

    const texto = TelegramService.buildNovoLeadMessage({
      empresa: "IMOBILIÁRIA EXEMPLO LTDA",
      responsavel: "João da Silva",
      telefone: "(88) 99999-0000",
      email: "contato@exemplo.com",
      cidade: "Fortaleza",
      estado: "CE",
      plano: "TESTE",
    });
    const resultado = await TelegramService.broadcast(`🧪 <b>Mensagem de teste</b>\n\n${texto}`);

    if (resultado.enviados === 0) {
      return res.status(400).json({ error: resultado.erros.join(" | ") || "Nenhuma mensagem enviada." });
    }
    return res.json({ success: true, ...resultado });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Erro ao enviar teste" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  Analytics da Landing Page (/lp)
// ═══════════════════════════════════════════════════════════════════════════

const lpAnalyticsSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

adminRouter.get("/lp/analytics", async (req, res) => {
  const parse = lpAnalyticsSchema.safeParse(req.query);
  if (!parse.success) return res.status(400).json({ error: "Parâmetros inválidos" });

  // Janela padrão: últimos 30 dias
  const hoje = new Date();
  const to = parse.data.to ? new Date(parse.data.to + "T23:59:59") : new Date(hoje.getTime() + 24 * 3600 * 1000);
  const from = parse.data.from ? new Date(parse.data.from + "T00:00:00") : new Date(hoje.getTime() - 30 * 24 * 3600 * 1000);
  const params = [from.toISOString(), to.toISOString()];
  const win = "created_at >= $1 AND created_at <= $2";

  try {
    const [resumoRows, funnelRows, ctaRows, fonteRows, serieRows, recentesRows] = await Promise.all([
      AppDataSource.query(
        `SELECT
           COUNT(*) FILTER (WHERE tipo='pageview')                        AS visitas,
           COUNT(DISTINCT visitor_id) FILTER (WHERE tipo='pageview')      AS visitantes,
           COUNT(DISTINCT session_id) FILTER (WHERE tipo='pageview')      AS sessoes,
           COUNT(*) FILTER (WHERE tipo='cta')                             AS cta_clicks,
           COUNT(DISTINCT session_id) FILTER (WHERE tipo='cta')           AS sessoes_cta,
           AVG(duracao) FILTER (WHERE tipo='exit')                        AS tempo_medio,
           AVG(scroll_pct) FILTER (WHERE tipo='exit')                     AS scroll_medio
         FROM lp_evento WHERE ${win}`,
        params
      ),
      AppDataSource.query(
        `SELECT secao, COUNT(DISTINCT session_id) AS sessoes
         FROM lp_evento WHERE tipo='section' AND secao IS NOT NULL AND ${win}
         GROUP BY secao`,
        params
      ),
      AppDataSource.query(
        `SELECT cta, COUNT(*) AS cliques, COUNT(DISTINCT session_id) AS sessoes
         FROM lp_evento WHERE tipo='cta' AND cta IS NOT NULL AND ${win}
         GROUP BY cta ORDER BY cliques DESC`,
        params
      ),
      AppDataSource.query(
        `SELECT COALESCE(NULLIF(utm_source, ''), 'Direto/Orgânico') AS fonte,
                COUNT(DISTINCT session_id) AS sessoes
         FROM lp_evento WHERE tipo='pageview' AND ${win}
         GROUP BY fonte ORDER BY sessoes DESC LIMIT 10`,
        params
      ),
      AppDataSource.query(
        `SELECT TO_CHAR(created_at, 'YYYY-MM-DD') AS dia,
                COUNT(*) FILTER (WHERE tipo='pageview')              AS visitas,
                COUNT(DISTINCT session_id) FILTER (WHERE tipo='cta') AS conversoes
         FROM lp_evento WHERE ${win}
         GROUP BY dia ORDER BY dia`,
        params
      ),
      AppDataSource.query(
        `SELECT visitor_id, device,
                COALESCE(NULLIF(utm_source, ''), 'Direto/Orgânico') AS fonte,
                referrer, ip, TO_CHAR(created_at, 'DD/MM/YYYY HH24:MI') AS quando
         FROM lp_evento WHERE tipo='pageview' AND ${win}
         ORDER BY created_at DESC LIMIT 25`,
        params
      ),
    ]);

    const r = resumoRows[0] || {};
    const num = (v: unknown) => Number(v ?? 0);
    const funnelMap = new Map<string, number>(
      (funnelRows as { secao: string; sessoes: string }[]).map((x) => [x.secao, num(x.sessoes)])
    );

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
      ctas: (ctaRows as { cta: string; cliques: string; sessoes: string }[]).map((x) => ({
        cta: x.cta,
        cliques: num(x.cliques),
        sessoes: num(x.sessoes),
      })),
      fontes: (fonteRows as { fonte: string; sessoes: string }[]).map((x) => ({
        fonte: x.fonte,
        sessoes: num(x.sessoes),
      })),
      serie: (serieRows as { dia: string; visitas: string; conversoes: string }[]).map((x) => ({
        dia: x.dia,
        visitas: num(x.visitas),
        conversoes: num(x.conversoes),
      })),
      recentes: (recentesRows as Record<string, unknown>[]).map((x) => ({
        visitorId: (x.visitor_id as string) ?? null,
        device: (x.device as string) ?? null,
        fonte: (x.fonte as string) ?? null,
        referrer: (x.referrer as string) ?? null,
        ip: (x.ip as string) ?? null,
        quando: (x.quando as string) ?? null,
      })),
    });
  } catch (error) {
    console.error("Erro ao gerar analytics da LP:", error);
    return res.status(500).json({ error: "Erro ao gerar analytics" });
  }
});
