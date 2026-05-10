import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { Lote } from "../../entities/Lote";
import { Venda } from "../../entities/Venda";
import { Cliente } from "../../entities/Cliente";
import { Loteamento } from "../../entities/Loteamento";
import { Empresa } from "../../entities/Empresa";
import { AuthRequest, requireAuth } from "../../middleware/auth";
import { HubBillingService } from "../../services/HubBillingService";

export const lotesRouter = Router();

const loteBodySchema = z.object({
  id_loteamento: z.number().int().positive(),
  lote: z.string().min(1).max(20),
  quadra: z.string().min(1).max(20),
  area: z.string().max(20).optional(),
  frente: z.string().max(20).optional(),
  fundo: z.string().max(20).optional(),
  esquerdo: z.string().max(20).optional(),
  direito: z.string().max(20).optional(),
});

function getDbErrorMessage(error: unknown): { status: number; error: string } | null {
  if (!error || typeof error !== "object") return null;
  const err = error as { code?: string; detail?: string; constraint?: string };

  if (err.code === "23505") {
    if (String(err.constraint || "").includes("lotes_id_loteamento_quadra_lote")) {
      return {
        status: 409,
        error: "Já existe um lote com esta combinação de loteamento, quadra e lote.",
      };
    }
    return { status: 409, error: "Registro duplicado." };
  }

  if (err.code === "23503") {
    return { status: 400, error: "Loteamento inválido para este lote." };
  }

  return null;
}

lotesRouter.get("/", requireAuth, async (req: AuthRequest, res) => {
  const loteRepo = AppDataSource.getRepository(Lote);
  const vendaRepo = AppDataSource.getRepository(Venda);

  const whereLote: Record<string, unknown> = {};
  const whereVenda: Record<string, unknown> = {};

  if (req.user?.id_empresa) {
    whereLote.id_empresa = req.user.id_empresa;
    whereVenda.id_empresa = req.user.id_empresa;
  }

  const [lotes, vendas] = await Promise.all([
    loteRepo.find({
      where: whereLote,
      order: { quadra: "ASC", lote: "ASC" },
    }),
    vendaRepo.find({ where: whereVenda }),
  ]);

  const vendidos = new Set(
    vendas.filter((venda) => venda.status !== "cancelada").map((venda) => venda.id_lote),
  );

  const result = lotes.map((lote) => ({
    id_lote: lote.id_lote,
    id_loteamento: lote.id_loteamento,
    lote: lote.lote,
    quadra: lote.quadra,
    area: lote.area,
    frente: lote.frente,
    fundo: lote.fundo,
    esquerdo: lote.esquerdo,
    direito: lote.direito,
    status: vendidos.has(lote.id_lote) ? "vendido" : "disponivel",
  }));

  return res.json(result);
});

lotesRouter.get("/limit-status", requireAuth, async (req: AuthRequest, res) => {
  const idEmpresa = req.user?.id_empresa ?? 1;
  const empresa = await AppDataSource.getRepository(Empresa).findOne({ where: { id_empresa: idEmpresa } });
  if (!empresa) {
    return res.status(400).json({ error: "Empresa inválida" });
  }

  const planControlDisabled = HubBillingService.isPlanControlDisabled(empresa);
  const hubConfigured = HubBillingService.isConfigured();

  if (!planControlDisabled && hubConfigured) {
    try {
      await HubBillingService.syncEmpresaLicense(empresa);
    } catch {
      const cachedQuantity = HubBillingService.getStoredQuantity(empresa);
      if (cachedQuantity === null) {
        return res.status(503).json({
          error: "Não foi possível validar o limite de lotes do seu plano no momento. Tente novamente.",
        });
      }
    }
  }

  if (!planControlDisabled && HubBillingService.isLicenseDenied(empresa)) {
    return res.status(403).json({
      error: HubBillingService.getLicenseMessage(empresa),
      reason: empresa.hub_license_reason || empresa.hub_license_status,
      limiteAtingido: true,
      necessitaUpgrade: true,
    });
  }

  const quantidadePermitida = !planControlDisabled && hubConfigured ? HubBillingService.getStoredQuantity(empresa) : null;
  const quantidadeUsada = await AppDataSource.getRepository(Lote).count({ where: { id_empresa: idEmpresa } });

  const limiteAtingido = quantidadePermitida != null && Number.isFinite(quantidadePermitida)
    ? quantidadeUsada >= quantidadePermitida
    : false;

  let nextPlan: Record<string, unknown> | null = null;
  if (limiteAtingido && hubConfigured) {
    const productId = process.env.HUB_BILLING_PRODUCT_ID || "";
    if (productId && quantidadePermitida != null) {
      try {
        const plans = await HubBillingService.getProductPlans(productId);
        const current = quantidadePermitida;
        const candidates = (plans as Array<Record<string, unknown>>)
          .map((p) => {
            const q = (p as Record<string, unknown>).quantity;
            const qNum = typeof q === "number" && Number.isFinite(q) ? q : null;
            return { p, qNum };
          })
          .filter((x) => x.qNum !== null && (x.qNum as number) > current)
          .sort((a, b) => (a.qNum as number) - (b.qNum as number));
        const best = candidates[0]?.p;
        if (best) {
          nextPlan = {
            planId: typeof best.id === "string" ? best.id : null,
            code: typeof best.code === "string" ? best.code : null,
            name: typeof best.name === "string" ? best.name : null,
            amount: typeof best.amount === "number" ? best.amount : null,
            quantity: typeof (best as Record<string, unknown>).quantity === "number" ? (best as Record<string, unknown>).quantity : null,
          };
        }
      } catch {
        nextPlan = null;
      }
    }
  }

  const meta = (empresa.hub_features && typeof empresa.hub_features === "object" && !Array.isArray(empresa.hub_features))
    ? (empresa.hub_features as Record<string, unknown>).__hubMeta
    : null;
  const planName = meta && typeof meta === "object" && !Array.isArray(meta) && typeof (meta as Record<string, unknown>).planName === "string"
    ? String((meta as Record<string, unknown>).planName)
    : null;

  return res.json({
    plano: planName,
    quantidadePermitida,
    quantidadeUsada,
    limiteAtingido,
    necessitaUpgrade: limiteAtingido,
    planControlDisabled,
    hubConfigured,
    nextPlan,
  });
});

lotesRouter.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;

  const repo = AppDataSource.getRepository(Lote);

  const where: Record<string, unknown> = { id_lote: Number(id) };

  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const lote = await repo.findOne({ where });

  if (!lote) {
    return res.status(404).json({ error: "Lote não encontrado" });
  }

  return res.json(lote);
});

lotesRouter.get("/:id/status", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;

  const vendaRepo = AppDataSource.getRepository(Venda);

  const where: Record<string, unknown> = { id_lote: Number(id) };

  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const venda = await vendaRepo.findOne({
    where,
  });

  const status = venda && venda.status !== "cancelada" ? "vendido" : "disponivel";

  return res.json({
    id_lote: Number(id),
    status,
  });
});

lotesRouter.get("/:id/cliente", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const idEmpresa = req.user?.id_empresa;

  const loteRepo = AppDataSource.getRepository(Lote);
  const vendaRepo = AppDataSource.getRepository(Venda);
  const clienteRepo = AppDataSource.getRepository(Cliente);
  const loteamentoRepo = AppDataSource.getRepository(Loteamento);

  const whereLote: Record<string, unknown> = { id_lote: Number(id) };
  if (idEmpresa) whereLote.id_empresa = idEmpresa;

  const lote = await loteRepo.findOne({ where: whereLote });
  if (!lote) {
    return res.status(404).json({ error: "Lote não encontrado" });
  }

  const whereLoteamento: Record<string, unknown> = { id_loteamento: lote.id_loteamento };
  if (idEmpresa) whereLoteamento.id_empresa = idEmpresa;
  const loteamento = await loteamentoRepo.findOne({ where: whereLoteamento });

  const whereVenda: Record<string, unknown> = { id_lote: Number(id) };
  if (idEmpresa) whereVenda.id_empresa = idEmpresa;

  const venda = await vendaRepo.findOne({ where: whereVenda });

  if (!venda || venda.status === "cancelada") {
    return res.json({
      lote: {
        id_lote: lote.id_lote,
        lote: lote.lote,
        quadra: lote.quadra,
        area: lote.area ?? null,
        frente: lote.frente ?? null,
        fundo: lote.fundo ?? null,
        esquerdo: lote.esquerdo ?? null,
        direito: lote.direito ?? null,
        loteamento: loteamento?.nome ?? null,
        cidade: loteamento?.cidade ?? null,
        estado: loteamento?.estado ?? null,
      },
      status: "disponivel",
      venda: null,
      cliente: null,
    });
  }

  const whereCliente: Record<string, unknown> = { id_cliente: venda.id_cliente };
  if (idEmpresa) whereCliente.id_empresa = idEmpresa;
  const cliente = await clienteRepo.findOne({ where: whereCliente });

  return res.json({
    lote: {
      id_lote: lote.id_lote,
      lote: lote.lote,
      quadra: lote.quadra,
      area: lote.area ?? null,
      frente: lote.frente ?? null,
      fundo: lote.fundo ?? null,
      esquerdo: lote.esquerdo ?? null,
      direito: lote.direito ?? null,
      loteamento: loteamento?.nome ?? null,
      cidade: loteamento?.cidade ?? null,
      estado: loteamento?.estado ?? null,
    },
    status: "vendido",
    venda: {
      id_venda: venda.id_venda,
      data_venda: venda.data_venda,
      valor_entrada: Number(venda.valor_entrada ?? 0),
      parcelas: venda.parcelas,
      porcentagem: Number(venda.porcentagem ?? 0),
      status: venda.status,
    },
    cliente: cliente
      ? {
          id_cliente: cliente.id_cliente,
          nome: cliente.nome,
          cpf: cliente.cpf ?? null,
          cnpj: cliente.cnpj ?? null,
          tipo: cliente.tipo,
          fone_res: cliente.fone_res ?? null,
          fone_com: cliente.fone_com ?? null,
          cidade: cliente.cidade ?? null,
          estado: cliente.estado ?? null,
        }
      : null,
  });
});

lotesRouter.post("/", requireAuth, async (req: AuthRequest, res) => {
  const parseResult = loteBodySchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  try {
    const idEmpresa = req.user?.id_empresa ?? 1;

    const empresaRepo = AppDataSource.getRepository(Empresa);
    const empresa = await empresaRepo.findOne({ where: { id_empresa: idEmpresa } });
    if (!empresa) {
      return res.status(400).json({ error: "Empresa inválida" });
    }

    if (!HubBillingService.isPlanControlDisabled(empresa) && HubBillingService.isConfigured()) {
      try {
        await HubBillingService.syncEmpresaLicense(empresa);
      } catch (err) {
        const cachedQuantity = HubBillingService.getStoredQuantity(empresa);
        if (cachedQuantity === null) {
          return res.status(503).json({
            error: "Não foi possível validar o limite de lotes do seu plano no momento. Tente novamente.",
          });
        }
      }

      if (HubBillingService.isLicenseDenied(empresa)) {
        return res.status(403).json({
          error: HubBillingService.getLicenseMessage(empresa),
          reason: empresa.hub_license_reason || empresa.hub_license_status,
        });
      }

      const quantity = HubBillingService.getStoredQuantity(empresa);
      if (quantity === null || !Number.isFinite(quantity)) {
        return res.status(403).json({
          error: "Não foi possível validar o limite de lotes do seu plano. Contate o suporte.",
        });
      }

      if (quantity <= 0) {
        return res.status(403).json({
          error: "Seu plano atual não permite cadastro de lotes. Para cadastrar novos lotes, escolha um plano superior.",
          code: "lotes_limit_zero",
          quantidadePermitida: quantity,
        });
      }

      const loteRepo = AppDataSource.getRepository(Lote);
      const quantidadeUsada = await loteRepo.count({ where: { id_empresa: idEmpresa } });
      if (quantidadeUsada >= quantity) {
        let nextPlan: Record<string, unknown> | null = null;
        const productId = process.env.HUB_BILLING_PRODUCT_ID || "";
        if (productId) {
          try {
            const plans = await HubBillingService.getProductPlans(productId);
            const current = quantity;
            const candidates = (plans as Array<Record<string, unknown>>)
              .map((p) => {
                const q = (p as Record<string, unknown>).quantity;
                const qNum = typeof q === "number" && Number.isFinite(q) ? q : null;
                return { p, qNum };
              })
              .filter((x) => x.qNum !== null && (x.qNum as number) > current)
              .sort((a, b) => (a.qNum as number) - (b.qNum as number));
            const best = candidates[0]?.p;
            if (best) {
              nextPlan = {
                planId: typeof best.id === "string" ? best.id : null,
                code: typeof best.code === "string" ? best.code : null,
                name: typeof best.name === "string" ? best.name : null,
                amount: typeof best.amount === "number" ? best.amount : null,
                quantity: typeof (best as Record<string, unknown>).quantity === "number" ? (best as Record<string, unknown>).quantity : null,
              };
            }
          } catch {
            nextPlan = null;
          }
        }

        return res.status(403).json({
          error: "Você atingiu o limite de lotes do seu plano atual. Para cadastrar novos lotes, escolha um plano superior.",
          code: "lotes_limit_reached",
          quantidadePermitida: quantity,
          quantidadeUsada,
          limiteAtingido: true,
          necessitaUpgrade: true,
          nextPlan,
        });
      }
    }

    const repo = AppDataSource.getRepository(Lote);

    const lote = repo.create({
      ...parseResult.data,
      id_empresa: req.user?.id_empresa ?? 1,
    });

    const saved = await repo.save(lote);

    return res.status(201).json(saved);
  } catch (error) {
    const mapped = getDbErrorMessage(error);
    if (mapped) return res.status(mapped.status).json({ error: mapped.error });
    console.error("[POST /api/lotes] erro:", error);
    return res.status(500).json({ error: "Erro ao criar lote" });
  }
});

lotesRouter.put("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;

  const parseResult = loteBodySchema.partial().safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Dados inválidos", issues: parseResult.error.issues });
  }

  try {
    const repo = AppDataSource.getRepository(Lote);

    const where: Record<string, unknown> = { id_lote: Number(id) };

    if (req.user?.id_empresa) {
      where.id_empresa = req.user.id_empresa;
    }

    const lote = await repo.findOne({ where });

    if (!lote) {
      return res.status(404).json({ error: "Lote não encontrado" });
    }

    Object.assign(lote, parseResult.data);

    const saved = await repo.save(lote);

    return res.json(saved);
  } catch (error) {
    const mapped = getDbErrorMessage(error);
    if (mapped) return res.status(mapped.status).json({ error: mapped.error });
    console.error("[PUT /api/lotes/:id] erro:", error);
    return res.status(500).json({ error: "Erro ao editar lote" });
  }
});

lotesRouter.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;

  const repo = AppDataSource.getRepository(Lote);

  const where: Record<string, unknown> = { id_lote: Number(id) };

  if (req.user?.id_empresa) {
    where.id_empresa = req.user.id_empresa;
  }

  const lote = await repo.findOne({ where });

  if (!lote) {
    return res.status(404).json({ error: "Lote não encontrado" });
  }

  await repo.remove(lote);

  return res.status(204).send();
});
