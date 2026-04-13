import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { Empresa } from "../../entities/Empresa";
import { Usuario } from "../../entities/Usuario";
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
