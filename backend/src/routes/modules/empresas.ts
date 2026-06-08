import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { Empresa } from "../../entities/Empresa";
import { AuthRequest, requireAuth } from "../../middleware/auth";

export const empresasRouter = Router();

function isPlatformAdmin(user?: AuthRequest["user"]) {
  return user?.login?.toLowerCase() === "gcgean";
}

const empresaBodySchema = z.object({
  nome_fantasia: z.string().min(1).max(200),
  razao_social: z.string().max(200).optional(),
  cnpj: z.string().max(18).optional(),
  ie: z.string().max(20).optional(),
  endereco: z.string().max(300).optional(),
  bairro: z.string().max(100).optional(),
  cidade: z.string().max(100).optional(),
  estado: z.string().max(2).optional(),
  cep: z.string().max(9).optional(),
  telefone: z.string().max(20).optional(),
  email: z.string().max(200).optional(),
  site: z.string().max(200).optional(),
  salario_minimo: z.number().nonnegative().optional().nullable(),
  multa_percentual: z.number().min(0).max(100).optional(),
  juros_percentual_dia: z.number().min(0).max(100).optional(),
  carencia_dias: z.number().int().min(0).optional(),
  logo: z.string().optional().nullable(),
  modelo_contrato: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
  hub_customer_id: z.string().max(80).optional().nullable(),
  hub_product_code: z.string().max(80).optional().nullable(),
  hub_license_status: z.string().max(40).optional().nullable(),
  hub_license_reason: z.string().max(80).optional().nullable(),
  hub_expires_at: z.string().optional().nullable(),
  hub_features: z.record(z.unknown()).optional().nullable(),
  ignorar_controle_planos: z.boolean().optional(),
});

// ─── Listar todas (master only) ───────────────────────────────────────────────
empresasRouter.get("/", requireAuth, async (req: AuthRequest, res) => {
  const currentUser = req.user;

  if (!isPlatformAdmin(currentUser)) {
    return res.status(403).json({ error: "Apenas usuário master pode listar empresas" });
  }

  const repo = AppDataSource.getRepository(Empresa);
  const empresas = await repo.find({ order: { nome_fantasia: "ASC" } });

  return res.json(empresas);
});

// ─── Obter minha empresa (qualquer usuário autenticado) ───────────────────────
empresasRouter.get("/minha", requireAuth, async (req: AuthRequest, res) => {
  const currentUser = req.user;
  if (!currentUser?.id_empresa) {
    return res.status(404).json({ error: "Empresa não associada ao usuário" });
  }

  const repo = AppDataSource.getRepository(Empresa);
  const empresa = await repo.findOne({ where: { id_empresa: currentUser.id_empresa } });

  if (!empresa) {
    return res.status(404).json({ error: "Empresa não encontrada" });
  }

  return res.json(empresa);
});

// ─── Atualizar minha empresa ───────────────────────────────────────────────────
empresasRouter.put("/minha", requireAuth, async (req: AuthRequest, res) => {
  const currentUser = req.user;
  if (!currentUser?.id_empresa) {
    return res.status(404).json({ error: "Empresa não associada ao usuário" });
  }

  const parseResult = empresaBodySchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const repo = AppDataSource.getRepository(Empresa);
  const empresa = await repo.findOne({ where: { id_empresa: currentUser.id_empresa } });

  if (!empresa) {
    return res.status(404).json({ error: "Empresa não encontrada" });
  }

  const {
    logo,
    modelo_contrato,
    salario_minimo,
    multa_percentual,
    juros_percentual_dia,
    carencia_dias,
    hub_customer_id: _hub_customer_id,
    hub_product_code: _hub_product_code,
    hub_license_status: _hub_license_status,
    hub_license_reason: _hub_license_reason,
    hub_expires_at: _hub_expires_at,
    hub_features: _hub_features,
    ...rest
  } = parseResult.data;

  Object.assign(empresa, rest);

  // Logo: aceita null para remover, undefined para não alterar
  if (logo !== undefined) {
    empresa.logo = logo ?? null;
  }

  // modelo_contrato: aceita null para limpar, undefined para não alterar
  if (modelo_contrato !== undefined) {
    empresa.modelo_contrato = modelo_contrato ?? null;
  }

  // salario_minimo: converte number para string (decimal no banco)
  if (salario_minimo !== undefined) {
    empresa.salario_minimo = salario_minimo != null ? String(salario_minimo) : null;
  }

  // Encargos
  if (multa_percentual !== undefined) empresa.multa_percentual = String(multa_percentual);
  if (juros_percentual_dia !== undefined) empresa.juros_percentual_dia = String(juros_percentual_dia);
  if (carencia_dias !== undefined) empresa.carencia_dias = carencia_dias;

  const saved = await repo.save(empresa);
  return res.json(saved);
});

// ─── Criar empresa (master only) ─────────────────────────────────────────────
empresasRouter.post("/", requireAuth, async (req: AuthRequest, res) => {
  const currentUser = req.user;

  if (!isPlatformAdmin(currentUser)) {
    return res.status(403).json({ error: "Apenas usuário master pode criar empresas" });
  }

  const parseResult = empresaBodySchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const repo = AppDataSource.getRepository(Empresa);

  const {
    salario_minimo: smNum,
    multa_percentual: multaNum,
    juros_percentual_dia: jurosNum,
    carencia_dias: carenciaNum,
    hub_expires_at,
    ...restData
  } = parseResult.data;

  const empresa = repo.create({
    ...restData,
    hub_expires_at: hub_expires_at ? new Date(hub_expires_at) : null,
    salario_minimo: smNum != null ? String(smNum) : null,
    multa_percentual: multaNum != null ? String(multaNum) : "2.00",
    juros_percentual_dia: jurosNum != null ? String(jurosNum) : "0.2000",
    carencia_dias: carenciaNum ?? 0,
    ativo: true,
  });
  const saved = await repo.save(empresa);

  return res.status(201).json(saved);
});

// ─── Ativar/desativar empresa (master only) ───────────────────────────────────
empresasRouter.put("/:id/ativo", requireAuth, async (req: AuthRequest, res) => {
  const currentUser = req.user;

  if (!isPlatformAdmin(currentUser)) {
    return res.status(403).json({ error: "Apenas usuário master pode alterar empresas" });
  }

  const { id } = req.params;

  const parseResult = z
    .object({ ativo: z.boolean() })
    .safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  const repo = AppDataSource.getRepository(Empresa);
  const empresa = await repo.findOne({ where: { id_empresa: Number(id) } });

  if (!empresa) {
    return res.status(404).json({ error: "Empresa não encontrada" });
  }

  empresa.ativo = parseResult.data.ativo;
  const saved = await repo.save(empresa);

  return res.json(saved);
});
