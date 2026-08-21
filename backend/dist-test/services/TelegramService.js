"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramService = void 0;
const data_source_1 = require("../db/data-source");
const TelegramConfig_1 = require("../entities/TelegramConfig");
const API_BASE = "https://api.telegram.org";
function repo() {
    return data_source_1.AppDataSource.getRepository(TelegramConfig_1.TelegramConfig);
}
async function getConfig() {
    return repo().findOne({ where: { id: 1 } });
}
// Garante que a linha única de config exista e retorna ela.
async function ensureConfig() {
    const existing = await getConfig();
    if (existing)
        return existing;
    const created = repo().create({
        id: 1,
        ativo: false,
        bot_token: null,
        notificar_novo_lead: true,
        recipients: [],
    });
    return repo().save(created);
}
async function sendMessage(token, chatId, text) {
    try {
        const resp = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: "HTML",
                disable_web_page_preview: true,
            }),
        });
        const data = (await resp.json());
        if (!resp.ok || !data.ok) {
            return { ok: false, error: data.description || `HTTP ${resp.status}` };
        }
        return { ok: true };
    }
    catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}
// Envia um texto para todos os destinatários configurados.
async function broadcast(text) {
    const config = await getConfig();
    const erros = [];
    if (!config?.bot_token || !config.recipients?.length) {
        return { enviados: 0, total: 0, erros: ["Configuração incompleta (token ou destinatários)."] };
    }
    let enviados = 0;
    for (const r of config.recipients) {
        if (!r.chat_id)
            continue;
        const res = await sendMessage(config.bot_token, String(r.chat_id), text);
        if (res.ok)
            enviados++;
        else
            erros.push(`${r.nome || r.chat_id}: ${res.error}`);
    }
    return { enviados, total: config.recipients.length, erros };
}
function escapeHtml(v) {
    return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function agoraFmt() {
    return new Date().toLocaleString("pt-BR", { timeZone: "America/Fortaleza" });
}
function fmtValor(v) {
    const n = typeof v === "string" ? Number(v) : v;
    if (n == null || !Number.isFinite(n))
        return "—";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}
function buildNovoLeadMessage(p) {
    const linhas = ["🎉 <b>Novo lead cadastrado no SISLOTE!</b>", ""];
    linhas.push(`🏢 <b>Empresa:</b> ${escapeHtml(p.empresa || "—")}`);
    if (p.cnpj)
        linhas.push(`🧾 <b>CPF/CNPJ:</b> ${escapeHtml(p.cnpj)}`);
    if (p.responsavel)
        linhas.push(`👤 <b>Responsável:</b> ${escapeHtml(p.responsavel)}`);
    linhas.push(`📞 <b>Telefone:</b> ${escapeHtml(p.telefone || "Não informado")}`);
    if (p.email)
        linhas.push(`✉️ <b>E-mail:</b> ${escapeHtml(p.email)}`);
    const local = [p.cidade, p.estado].filter(Boolean).join("/");
    if (local)
        linhas.push(`📍 <b>Cidade:</b> ${escapeHtml(local)}`);
    if (p.plano)
        linhas.push(`🗂️ <b>Plano:</b> ${escapeHtml(p.plano)}`);
    linhas.push("", `🕒 ${escapeHtml(agoraFmt())}`);
    return linhas.join("\n");
}
function buildPagamentoMessage(p) {
    const linhas = ["💰 <b>Pagamento de assinatura recebido!</b>", ""];
    linhas.push(`🏢 <b>Empresa:</b> ${escapeHtml(p.empresa || "—")}`);
    if (p.cnpj)
        linhas.push(`🧾 <b>CPF/CNPJ:</b> ${escapeHtml(p.cnpj)}`);
    linhas.push(`💵 <b>Valor:</b> ${escapeHtml(fmtValor(p.valor))}`);
    if (p.plano)
        linhas.push(`🗂️ <b>Plano:</b> ${escapeHtml(p.plano)}`);
    linhas.push("", `🕒 ${escapeHtml(agoraFmt())}`);
    return linhas.join("\n");
}
// Dispara a notificação de novo lead — fire-and-forget, nunca lança erro.
async function notifyNovoLead(payload) {
    try {
        const config = await getConfig();
        if (!config?.ativo || !config.notificar_novo_lead)
            return;
        if (!config.bot_token || !config.recipients?.length)
            return;
        const text = buildNovoLeadMessage(payload);
        const res = await broadcast(text);
        if (res.erros.length) {
            console.warn("[Telegram] Falha ao notificar novo lead:", res.erros.join(" | "));
        }
    }
    catch (err) {
        console.warn("[Telegram] Erro inesperado ao notificar novo lead:", err instanceof Error ? err.message : err);
    }
}
function dataFmt(d) {
    return d.toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" });
}
function buildTrialMessage(p) {
    const expirado = p.diasRestantes <= 0;
    const linhas = expirado
        ? ["⚠️ <b>Trial EXPIRADO</b>", ""]
        : ["⏳ <b>Trial vencendo!</b>", ""];
    linhas.push(`🏢 <b>Empresa:</b> ${escapeHtml(p.empresa || "—")}`);
    if (p.cnpj)
        linhas.push(`🧾 <b>CPF/CNPJ:</b> ${escapeHtml(p.cnpj)}`);
    linhas.push(`📞 <b>Telefone:</b> ${escapeHtml(p.telefone || "Não informado")}`);
    if (expirado) {
        linhas.push(`📅 <b>Expirou em:</b> ${escapeHtml(dataFmt(p.vencimento))}`);
    }
    else {
        const dias = p.diasRestantes === 1 ? "1 dia" : `${p.diasRestantes} dias`;
        linhas.push(`⏳ <b>Vence em:</b> ${escapeHtml(dias)} (${escapeHtml(dataFmt(p.vencimento))})`);
    }
    linhas.push("", `🕒 ${escapeHtml(agoraFmt())}`);
    return linhas.join("\n");
}
// Dispara a notificação de trial — retorna true se enviou (para o chamador registrar dedup).
async function notifyTrial(payload) {
    try {
        const config = await getConfig();
        if (!config?.ativo || !config.notificar_trial)
            return false;
        if (!config.bot_token || !config.recipients?.length)
            return false;
        const text = buildTrialMessage(payload);
        const res = await broadcast(text);
        if (res.erros.length) {
            console.warn("[Telegram] Falha ao notificar trial:", res.erros.join(" | "));
        }
        return res.enviados > 0;
    }
    catch (err) {
        console.warn("[Telegram] Erro inesperado ao notificar trial:", err instanceof Error ? err.message : err);
        return false;
    }
}
// Indica se as notificações de trial estão habilitadas (evita varrer o banco à toa).
async function isTrialNotifyEnabled() {
    const config = await getConfig();
    return Boolean(config?.ativo && config.notificar_trial && config.bot_token && config.recipients?.length);
}
// Dispara a notificação de pagamento de assinatura — fire-and-forget, nunca lança erro.
async function notifyPagamento(payload) {
    try {
        const config = await getConfig();
        if (!config?.ativo || !config.notificar_pagamento)
            return;
        if (!config.bot_token || !config.recipients?.length)
            return;
        const text = buildPagamentoMessage(payload);
        const res = await broadcast(text);
        if (res.erros.length) {
            console.warn("[Telegram] Falha ao notificar pagamento:", res.erros.join(" | "));
        }
    }
    catch (err) {
        console.warn("[Telegram] Erro inesperado ao notificar pagamento:", err instanceof Error ? err.message : err);
    }
}
// Lista chats recentes que interagiram com o bot (para descobrir o chat_id).
async function detectChats(token) {
    const resp = await fetch(`${API_BASE}/bot${token}/getUpdates`);
    const data = (await resp.json());
    if (!resp.ok || !data.ok) {
        throw new Error(data.description || `HTTP ${resp.status}`);
    }
    const map = new Map();
    for (const upd of data.result || []) {
        const chat = upd.message?.chat;
        if (!chat)
            continue;
        const nome = chat.title ||
            [chat.first_name, chat.last_name].filter(Boolean).join(" ") ||
            (chat.username ? `@${chat.username}` : `Chat ${chat.id}`);
        map.set(String(chat.id), { nome, chat_id: String(chat.id) });
    }
    return Array.from(map.values());
}
exports.TelegramService = {
    getConfig,
    ensureConfig,
    sendMessage,
    broadcast,
    buildNovoLeadMessage,
    buildPagamentoMessage,
    buildTrialMessage,
    notifyNovoLead,
    notifyPagamento,
    notifyTrial,
    isTrialNotifyEnabled,
    detectChats,
};
