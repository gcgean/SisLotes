import { Router } from "express";
import { AppDataSource } from "../../db/data-source";
import { Auditoria } from "../../entities/Auditoria";
import { AuthRequest, requireAuth, requireFeature } from "../../middleware/auth";

export const auditoriaRouter = Router();
auditoriaRouter.use(requireAuth, requireFeature("module_auditoria"));

auditoriaRouter.get("/", requireAuth, async (req: AuthRequest, res) => {
  const { tabela, acao, id_usuario, data_inicio, data_fim, limit = 100, offset = 0 } = req.query;
  const idEmpresa = req.user?.id_empresa;

  if (!idEmpresa) {
    return res.status(400).json({ error: "Empresa não definida" });
  }

  const auditoriaRepo = AppDataSource.getRepository(Auditoria);
  const queryBuilder = auditoriaRepo
    .createQueryBuilder("a")
    .leftJoinAndSelect("a.usuario", "usuario")
    .where("a.id_empresa = :id_empresa", { id_empresa: idEmpresa });

  if (tabela) {
    queryBuilder.andWhere("a.tabela = :tabela", { tabela });
  }

  if (acao) {
    queryBuilder.andWhere("a.acao = :acao", { acao });
  }

  if (id_usuario) {
    queryBuilder.andWhere("a.id_usuario = :id_usuario", { id_usuario });
  }

  if (data_inicio) {
    queryBuilder.andWhere("a.data_hora >= :data_inicio", { data_inicio });
  }

  if (data_fim) {
    queryBuilder.andWhere("a.data_hora <= :data_fim", { data_fim });
  }

  const [dados, total] = await queryBuilder
    .orderBy("a.data_hora", "DESC")
    .limit(Number(limit))
    .offset(Number(offset))
    .getManyAndCount();

  return res.json({
    dados: dados.map((a) => ({
      id_auditoria: a.id_auditoria,
      usuario: a.usuario?.login || "desconhecido",
      tabela: a.tabela,
      id_registro: a.id_registro,
      acao: a.acao,
      descricao: a.descricao,
      ip_address: a.ip_address,
      data_hora: a.data_hora,
      valores_novos: a.valores_novos,
    })),
    total,
    limit: Number(limit),
    offset: Number(offset),
  });
});

auditoriaRouter.get("/usuario/:id_usuario", requireAuth, async (req: AuthRequest, res) => {
  const { id_usuario } = req.params;
  const { limit = 50, offset = 0 } = req.query;
  const idEmpresa = req.user?.id_empresa;

  if (!idEmpresa) {
    return res.status(400).json({ error: "Empresa não definida" });
  }

  const auditoriaRepo = AppDataSource.getRepository(Auditoria);
  const [dados, total] = await auditoriaRepo
    .createQueryBuilder("a")
    .leftJoinAndSelect("a.usuario", "usuario")
    .where("a.id_usuario = :id_usuario", { id_usuario: Number(id_usuario) })
    .andWhere("a.id_empresa = :id_empresa", { id_empresa: idEmpresa })
    .orderBy("a.data_hora", "DESC")
    .limit(Number(limit))
    .offset(Number(offset))
    .getManyAndCount();

  return res.json({
    dados: dados.map((a) => ({
      id_auditoria: a.id_auditoria,
      usuario: a.usuario?.login,
      tabela: a.tabela,
      id_registro: a.id_registro,
      acao: a.acao,
      descricao: a.descricao,
      data_hora: a.data_hora,
    })),
    total,
  });
});
