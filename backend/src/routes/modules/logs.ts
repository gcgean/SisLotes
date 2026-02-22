import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { Log } from "../../entities/Log";

export const logsRouter = Router();

const listLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  id_usuario: z.coerce.number().int().positive().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

logsRouter.get("/", async (req, res) => {
  const parseResult = listLogsQuerySchema.safeParse(req.query);

  if (!parseResult.success) {
    return res.status(400).json({ error: "Parâmetros inválidos", issues: parseResult.error.issues });
  }

  const { page, limit, id_usuario, from, to } = parseResult.data;

  const repo = AppDataSource.getRepository(Log);

  const qb = repo
    .createQueryBuilder("log")
    .leftJoinAndSelect("log.usuario", "usuario")
    .orderBy("log.data_hora", "DESC")
    .skip((page - 1) * limit)
    .take(limit);

  if (id_usuario) {
    qb.andWhere("log.id_usuario = :id_usuario", { id_usuario });
  }

  if (from) {
    qb.andWhere("log.data_hora >= :from", { from });
  }

  if (to) {
    qb.andWhere("log.data_hora <= :to", { to });
  }

  const [data, total] = await qb.getManyAndCount();

  return res.json({
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

