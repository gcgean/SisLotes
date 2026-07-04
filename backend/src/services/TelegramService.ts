import { AppDataSource } from "../db/data-source";
import { TelegramConfig, TelegramRecipient } from "../entities/TelegramConfig";

export interface NovoLeadPayload {
  empresa: string;
  cnpj?: string | null;
  responsavel?: string | null;
  telefone?: string | null;
  email?: string | null;
  cidade?: string | null;
  estado?: string | null;
  plano?: string | null;
}

export interface PagamentoPayload {
  empresa: string;
  cnpj?: string | null;
  valor?: number | string | null;
  plano?: string | null;
}

const API_BASE = "https://api.telegram.org";

function repo() {
  return AppDataSource.getRepository(TelegramConfig);
}

async function getConfig(): Promise<TelegramConfig | null> {
  return repo().findOne({ where: { id: 1 } });
}

// Garante que a linha única de config exista e retorna ela.
async function ensureConfig(): Promise<TelegramConfig> {
  const existing = await getConfig();
  if (existing) return existing;
  const created = repo().create({
    id: 1,
    ativo: false,
    bot_token: null,
    notificar_novo_lead: true,
    recipients: [],
  });
  return repo().save(created);
}

async function sendMessage(token: string, chatId: string, text: string): Promise<{ ok: boolean; error?: string }> {
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
    const data = (await resp.json()) as { ok?: boolean; description?: string };
    if (!resp.ok || !data.ok) {
      return { ok: false, error: data.description || `HTTP ${resp.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Envia um texto para todos os destinatários configurados.
async function broadcast(text: string): Promise<{ enviados: number; total: number; erros: string[] }> {
  const config = await getConfig();
  const erros: string[] = [];
  if (!config?.bot_token || !config.recipients?.length) {
    return { enviados: 0, total: 0, erros: ["Configuração incompleta (token ou destinatários)."] };
  }
  let enviados = 0;
  for (const r of config.recipients) {
    if (!r.chat_id) continue;
    const res = await sendMessage(config.bot_token, String(r.chat_id), text);
    if (res.ok) enviados++;
    else erros.push(`${r.nome || r.chat_id}: ${res.error}`);
  }
  return { enviados, total: config.recipients.length, erros };
}

function escapeHtml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function agoraFmt(): string {
  return new Date().toLocaleString("pt-BR", { timeZone: "America/Fortaleza" });
}

function fmtValor(v: number | string | null | undefined): string {
  const n = typeof v === "string" ? Number(v) : v;
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function buildNovoLeadMessage(p: NovoLeadPayload): string {
  const linhas: string[] = ["🎉 <b>Novo lead cadastrado no SISLOTE!</b>", ""];
  linhas.push(`🏢 <b>Empresa:</b> ${escapeHtml(p.empresa || "—")}`);
  if (p.cnpj) linhas.push(`🧾 <b>CPF/CNPJ:</b> ${escapeHtml(p.cnpj)}`);
  if (p.responsavel) linhas.push(`👤 <b>Responsável:</b> ${escapeHtml(p.responsavel)}`);
  linhas.push(`📞 <b>Telefone:</b> ${escapeHtml(p.telefone || "Não informado")}`);
  if (p.email) linhas.push(`✉️ <b>E-mail:</b> ${escapeHtml(p.email)}`);
  const local = [p.cidade, p.estado].filter(Boolean).join("/");
  if (local) linhas.push(`📍 <b>Cidade:</b> ${escapeHtml(local)}`);
  if (p.plano) linhas.push(`🗂️ <b>Plano:</b> ${escapeHtml(p.plano)}`);
  linhas.push("", `🕒 ${escapeHtml(agoraFmt())}`);
  return linhas.join("\n");
}

function buildPagamentoMessage(p: PagamentoPayload): string {
  const linhas: string[] = ["💰 <b>Pagamento de assinatura recebido!</b>", ""];
  linhas.push(`🏢 <b>Empresa:</b> ${escapeHtml(p.empresa || "—")}`);
  if (p.cnpj) linhas.push(`🧾 <b>CPF/CNPJ:</b> ${escapeHtml(p.cnpj)}`);
  linhas.push(`💵 <b>Valor:</b> ${escapeHtml(fmtValor(p.valor))}`);
  if (p.plano) linhas.push(`🗂️ <b>Plano:</b> ${escapeHtml(p.plano)}`);
  linhas.push("", `🕒 ${escapeHtml(agoraFmt())}`);
  return linhas.join("\n");
}

// Dispara a notificação de novo lead — fire-and-forget, nunca lança erro.
async function notifyNovoLead(payload: NovoLeadPayload): Promise<void> {
  try {
    const config = await getConfig();
    if (!config?.ativo || !config.notificar_novo_lead) return;
    if (!config.bot_token || !config.recipients?.length) return;
    const text = buildNovoLeadMessage(payload);
    const res = await broadcast(text);
    if (res.erros.length) {
      console.warn("[Telegram] Falha ao notificar novo lead:", res.erros.join(" | "));
    }
  } catch (err) {
    console.warn("[Telegram] Erro inesperado ao notificar novo lead:", err instanceof Error ? err.message : err);
  }
}

// Dispara a notificação de pagamento de assinatura — fire-and-forget, nunca lança erro.
async function notifyPagamento(payload: PagamentoPayload): Promise<void> {
  try {
    const config = await getConfig();
    if (!config?.ativo || !config.notificar_pagamento) return;
    if (!config.bot_token || !config.recipients?.length) return;
    const text = buildPagamentoMessage(payload);
    const res = await broadcast(text);
    if (res.erros.length) {
      console.warn("[Telegram] Falha ao notificar pagamento:", res.erros.join(" | "));
    }
  } catch (err) {
    console.warn("[Telegram] Erro inesperado ao notificar pagamento:", err instanceof Error ? err.message : err);
  }
}

// Lista chats recentes que interagiram com o bot (para descobrir o chat_id).
async function detectChats(token: string): Promise<TelegramRecipient[]> {
  const resp = await fetch(`${API_BASE}/bot${token}/getUpdates`);
  const data = (await resp.json()) as {
    ok?: boolean;
    description?: string;
    result?: Array<{ message?: { chat?: { id: number; type: string; title?: string; first_name?: string; last_name?: string; username?: string } } }>;
  };
  if (!resp.ok || !data.ok) {
    throw new Error(data.description || `HTTP ${resp.status}`);
  }
  const map = new Map<string, TelegramRecipient>();
  for (const upd of data.result || []) {
    const chat = upd.message?.chat;
    if (!chat) continue;
    const nome =
      chat.title ||
      [chat.first_name, chat.last_name].filter(Boolean).join(" ") ||
      (chat.username ? `@${chat.username}` : `Chat ${chat.id}`);
    map.set(String(chat.id), { nome, chat_id: String(chat.id) });
  }
  return Array.from(map.values());
}

export const TelegramService = {
  getConfig,
  ensureConfig,
  sendMessage,
  broadcast,
  buildNovoLeadMessage,
  buildPagamentoMessage,
  notifyNovoLead,
  notifyPagamento,
  detectChats,
};
