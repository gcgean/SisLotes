import { Request, Response, Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { LpEvento } from "../../entities/LpEvento";

export const lpRouter = Router();

const eventoSchema = z.object({
  tipo: z.enum(["pageview", "section", "cta", "exit"]),
  secao: z.string().max(40).optional().nullable(),
  cta: z.string().max(40).optional().nullable(),
  duracao: z.number().int().min(0).max(86400).optional().nullable(),
  scrollPct: z.number().int().min(0).max(100).optional().nullable(),
});

const trackSchema = z.object({
  visitorId: z.string().max(40).optional().nullable(),
  sessionId: z.string().max(40).optional().nullable(),
  referrer: z.string().max(500).optional().nullable(),
  device: z.string().max(20).optional().nullable(),
  utm: z
    .object({
      source: z.string().max(80).optional().nullable(),
      medium: z.string().max(80).optional().nullable(),
      campaign: z.string().max(80).optional().nullable(),
    })
    .optional(),
  events: z.array(eventoSchema).min(1).max(30),
});

function clientIp(req: Request): string | null {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.trim()) return fwd.split(",")[0].trim().slice(0, 50);
  return (req.ip || req.socket?.remoteAddress || null)?.slice(0, 50) ?? null;
}

// ─── POST /lp/track ── (público, chamado pela landing page) ───────────────────
lpRouter.post("/track", async (req: Request, res: Response) => {
  const parse = trackSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Dados inválidos" });
  }

  const d = parse.data;
  const ip = clientIp(req);
  const ua = (req.headers["user-agent"] || "").toString().slice(0, 1000) || null;

  try {
    const repo = AppDataSource.getRepository(LpEvento);
    const rows = d.events.map((ev) =>
      repo.create({
        visitor_id: d.visitorId ?? null,
        session_id: d.sessionId ?? null,
        tipo: ev.tipo,
        secao: ev.secao ?? null,
        cta: ev.cta ?? null,
        referrer: d.referrer ?? null,
        utm_source: d.utm?.source ?? null,
        utm_medium: d.utm?.medium ?? null,
        utm_campaign: d.utm?.campaign ?? null,
        device: d.device ?? null,
        user_agent: ua,
        ip,
        duracao: ev.duracao ?? null,
        scroll_pct: ev.scrollPct ?? null,
      })
    );
    await repo.save(rows);
    return res.status(204).send();
  } catch (error) {
    console.error("Erro ao registrar evento LP:", error);
    // Nunca falha "barulhento" para o visitante
    return res.status(204).send();
  }
});
