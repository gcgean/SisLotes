import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { Empresa } from "../../entities/Empresa";
import { Usuario } from "../../entities/Usuario";
import { TelegramConfig } from "../../entities/TelegramConfig";
import { TelegramService } from "../../services/TelegramService";
import { HubBillingService } from "../../services/HubBillingService";
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
//  Dashboard — Jornada do usuário (trial → pago), uso do sistema, geografia
// ═══════════════════════════════════════════════════════════════════════════

function isTrialLicenseStatusAdmin(empresa: Empresa): boolean {
  const status = (empresa.hub_license_status || "").toLowerCase();
  const reason = (empresa.hub_license_reason || "").toLowerCase();
  return status === "trial" || status === "trialing" || reason === "trial_active";
}

function isPaidLicenseStatusAdmin(empresa: Empresa): boolean {
  const status = (empresa.hub_license_status || "").toLowerCase();
  return status === "licensed" || status === "active";
}

function diffDias(de: Date, ate: Date): number {
  return Math.floor((ate.getTime() - de.getTime()) / (24 * 3600 * 1000));
}

function resolveDaysLeft(empresa: Empresa): number | null {
  const stored = HubBillingService.getStoredDaysLeft(empresa);
  if (stored != null) return stored;
  const expiresRaw: Date | string | null =
    empresa.hub_expires_at ?? (empresa.data_vencimento ? new Date(empresa.data_vencimento) : null);
  if (!expiresRaw) return null;
  const expires = expiresRaw instanceof Date ? expiresRaw : new Date(expiresRaw);
  if (Number.isNaN(expires.getTime())) return null;
  return diffDias(new Date(), expires);
}

interface EmpresaJourney {
  id_empresa: number;
  nome_fantasia: string;
  cidade: string | null;
  estado: string | null;
  telefone: string | null;
  email: string | null;
  plano: string | null;
  ativo: boolean;
  created_at: Date;
  ultimo_acesso: Date | null;
  is_trial: boolean;
  is_paid: boolean;
  dias_restantes: number | null;
  loteamentos: number;
  lotes: number;
  vendas: number;
  pagamentos_pagos: number;
  despesas: number;
  motivos_ajuda: string[];
}

async function getEmpresasJourney(): Promise<EmpresaJourney[]> {
  const empresaRepo = AppDataSource.getRepository(Empresa);
  const empresas = await empresaRepo.find({ order: { created_at: "DESC" } });

  const counts = (await AppDataSource.query(`
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
  `)) as Array<{ id_empresa: number; loteamentos: number; lotes: number; vendas: number; pagamentos_pagos: number; despesas: number }>;
  const countsMap = new Map(counts.map((c) => [c.id_empresa, c]));

  // Contato do usuário master de cada empresa (fallback para contato da empresa)
  const contatos = (await AppDataSource.query(`
    SELECT DISTINCT ON (id_empresa) id_empresa, telefone, email
    FROM usuarios
    WHERE user_master = true
    ORDER BY id_empresa, id_usuario ASC
  `)) as Array<{ id_empresa: number; telefone: string | null; email: string | null }>;
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

    const motivos: string[] = [];
    const semUso = c.loteamentos === 0 && c.lotes === 0 && c.vendas === 0;
    if (isTrial && diasCadastro >= 3 && semUso) motivos.push("sem_uso");
    if (e.ativo && diasSemAcesso >= 5) motivos.push("sem_acesso");
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
adminRouter.get("/dashboard/overview", async (_req, res) => {
  try {
    const empresaRepo = AppDataSource.getRepository(Empresa);
    const usuarioRepo = AppDataSource.getRepository(Usuario);

    const [totalEmpresas, ativas, inativas, totalUsuarios, journey, serieRows] = await Promise.all([
      empresaRepo.count(),
      empresaRepo.count({ where: { ativo: true } }),
      empresaRepo.count({ where: { ativo: false } }),
      usuarioRepo.count(),
      getEmpresasJourney(),
      AppDataSource.query(`
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
  } catch (error) {
    console.error("Erro ao buscar overview do dashboard:", error);
    return res.status(500).json({ error: "Erro ao buscar visão geral" });
  }
});

// ─── GET /admin/dashboard/empresas ───────────────────────────────────────────
adminRouter.get("/dashboard/empresas", async (_req, res) => {
  try {
    const journey = await getEmpresasJourney();
    return res.json(journey);
  } catch (error) {
    console.error("Erro ao buscar jornada das empresas:", error);
    return res.status(500).json({ error: "Erro ao buscar uso do sistema" });
  }
});

// ─── GET /admin/dashboard/funil ──────────────────────────────────────────────
adminRouter.get("/dashboard/funil", async (_req, res) => {
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
  } catch (error) {
    console.error("Erro ao buscar funil:", error);
    return res.status(500).json({ error: "Erro ao buscar funil" });
  }
});

// ─── GET /admin/dashboard/geografia ──────────────────────────────────────────
adminRouter.get("/dashboard/geografia", async (_req, res) => {
  try {
    const [porEstado, porCidade] = await Promise.all([
      AppDataSource.query(`
        SELECT COALESCE(NULLIF(estado, ''), 'Não informado') AS estado, COUNT(*)::int AS total
        FROM empresas GROUP BY estado ORDER BY total DESC
      `),
      AppDataSource.query(`
        SELECT COALESCE(NULLIF(cidade, ''), 'Não informado') AS cidade,
               COALESCE(NULLIF(estado, ''), '—') AS estado, COUNT(*)::int AS total
        FROM empresas GROUP BY cidade, estado ORDER BY total DESC LIMIT 20
      `),
    ]);
    return res.json({ porEstado, porCidade });
  } catch (error) {
    console.error("Erro ao buscar geografia:", error);
    return res.status(500).json({ error: "Erro ao buscar geografia" });
  }
});

// ─── GET /admin/dashboard/acessos ────────────────────────────────────────────
// De onde e com qual dispositivo cada usuário está acessando o sistema.
adminRouter.get("/dashboard/acessos", async (req, res) => {
  try {
    const limite = Math.min(Number(req.query.limite) || 100, 500);
    const acessos = await AppDataSource.query(
      `SELECT h.id, h.data_hora, h.ip_address, h.dispositivo, h.navegador, h.sistema_operacional,
              u.login, e.nome_fantasia AS empresa
       FROM usuario_login_historico h
       JOIN usuarios u ON u.id_usuario = h.id_usuario
       JOIN empresas e ON e.id_empresa = h.id_empresa
       ORDER BY h.data_hora DESC
       LIMIT $1`,
      [limite],
    );
    return res.json(acessos);
  } catch (error) {
    console.error("Erro ao buscar histórico de acessos:", error);
    return res.status(500).json({ error: "Erro ao buscar histórico de acessos" });
  }
});

// ─── GET /admin/dashboard/empresas/:id/timeline ──────────────────────────────
// Timeline de billing (Hub) por empresa: trial → checkout → pago.
adminRouter.get("/dashboard/empresas/:id/timeline", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "ID inválido" });

    const [eventos, cobrancas] = await Promise.all([
      AppDataSource.query(
        `SELECT id_hub_event, event_type, event_source, status, amount, created_at
         FROM hub_billing_events WHERE id_empresa = $1 ORDER BY created_at ASC`,
        [id]
      ),
      AppDataSource.query(
        `SELECT id_hub_charge, origin_type, status, amount, created_at
         FROM hub_billing_charges WHERE id_empresa = $1 ORDER BY created_at ASC`,
        [id]
      ),
    ]);
    return res.json({ eventos, cobrancas });
  } catch (error) {
    console.error("Erro ao buscar timeline da empresa:", error);
    return res.status(500).json({ error: "Erro ao buscar timeline" });
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
