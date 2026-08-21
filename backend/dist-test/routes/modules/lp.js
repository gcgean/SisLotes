"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lpRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const data_source_1 = require("../../db/data-source");
const LpEvento_1 = require("../../entities/LpEvento");
exports.lpRouter = (0, express_1.Router)();
const eventoSchema = zod_1.z.object({
    tipo: zod_1.z.enum(["pageview", "section", "cta", "exit"]),
    secao: zod_1.z.string().max(40).optional().nullable(),
    cta: zod_1.z.string().max(40).optional().nullable(),
    duracao: zod_1.z.number().int().min(0).max(86400).optional().nullable(),
    scrollPct: zod_1.z.number().int().min(0).max(100).optional().nullable(),
});
const trackSchema = zod_1.z.object({
    visitorId: zod_1.z.string().max(40).optional().nullable(),
    sessionId: zod_1.z.string().max(40).optional().nullable(),
    referrer: zod_1.z.string().max(500).optional().nullable(),
    device: zod_1.z.string().max(20).optional().nullable(),
    utm: zod_1.z
        .object({
        source: zod_1.z.string().max(80).optional().nullable(),
        medium: zod_1.z.string().max(80).optional().nullable(),
        campaign: zod_1.z.string().max(80).optional().nullable(),
    })
        .optional(),
    events: zod_1.z.array(eventoSchema).min(1).max(30),
});
function clientIp(req) {
    const fwd = req.headers["x-forwarded-for"];
    if (typeof fwd === "string" && fwd.trim())
        return fwd.split(",")[0].trim().slice(0, 50);
    return (req.ip || req.socket?.remoteAddress || null)?.slice(0, 50) ?? null;
}
// ─── POST /lp/track ── (público, chamado pela landing page) ───────────────────
exports.lpRouter.post("/track", async (req, res) => {
    const parse = trackSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ error: "Dados inválidos" });
    }
    const d = parse.data;
    const ip = clientIp(req);
    const ua = (req.headers["user-agent"] || "").toString().slice(0, 1000) || null;
    try {
        const repo = data_source_1.AppDataSource.getRepository(LpEvento_1.LpEvento);
        const rows = d.events.map((ev) => repo.create({
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
        }));
        await repo.save(rows);
        return res.status(204).send();
    }
    catch (error) {
        console.error("Erro ao registrar evento LP:", error);
        // Nunca falha "barulhento" para o visitante
        return res.status(204).send();
    }
});
