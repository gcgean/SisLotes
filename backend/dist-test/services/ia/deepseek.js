"use strict";
// ─── Provedor: DeepSeek ──────────────────────────────────────────────────────
// A API do DeepSeek segue o formato da OpenAI (chat/completions + tool calling),
// então falamos HTTP direto e evitamos mais uma dependência no backend.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProvedorDeepSeek = void 0;
const provider_1 = require("./provider");
const URL_PADRAO = "https://api.deepseek.com/chat/completions";
const MODELO_PADRAO = "deepseek-v4-pro";
const TIMEOUT_MS = 60000;
function paraWire(m) {
    switch (m.papel) {
        case "sistema":
            return { role: "system", content: m.conteudo };
        case "usuario":
            return { role: "user", content: m.conteudo };
        case "ferramenta":
            return { role: "tool", content: m.conteudo, tool_call_id: m.idChamada };
        case "assistente":
            return {
                role: "assistant",
                content: m.conteudo || null,
                ...(m.chamadas?.length
                    ? {
                        tool_calls: m.chamadas.map((c) => ({
                            id: c.id,
                            type: "function",
                            function: { name: c.nome, arguments: JSON.stringify(c.argumentos) },
                        })),
                    }
                    : {}),
            };
    }
}
/** Argumentos chegam como string JSON e podem vir malformados — nunca confiar. */
function lerArgumentos(bruto) {
    if (!bruto)
        return {};
    try {
        const v = JSON.parse(bruto);
        return v && typeof v === "object" && !Array.isArray(v) ? v : {};
    }
    catch {
        return {};
    }
}
class ProvedorDeepSeek {
    constructor(opcoes) {
        this.nome = "deepseek";
        const apiKey = opcoes?.apiKey ?? process.env.DEEPSEEK_API_KEY ?? "";
        if (!apiKey) {
            throw new provider_1.ErroProvedorIA("DEEPSEEK_API_KEY não configurada no servidor.");
        }
        this.apiKey = apiKey;
        this.modelo = opcoes?.modelo ?? process.env.DEEPSEEK_MODEL ?? MODELO_PADRAO;
        this.url = opcoes?.url ?? process.env.DEEPSEEK_URL ?? URL_PADRAO;
    }
    async conversar(mensagens, ferramentas) {
        const corpo = {
            model: this.modelo,
            messages: mensagens.map(paraWire),
            ...(ferramentas.length
                ? {
                    tools: ferramentas.map((f) => ({
                        type: "function",
                        function: { name: f.nome, description: f.descricao, parameters: f.parametros },
                    })),
                    tool_choice: "auto",
                }
                : {}),
        };
        // Timeout explícito: sem isso uma resposta travada prende a requisição do usuário.
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        let resposta;
        try {
            resposta = await fetch(this.url, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
                body: JSON.stringify(corpo),
                signal: controller.signal,
            });
        }
        catch (e) {
            const abortado = e instanceof Error && e.name === "AbortError";
            throw new provider_1.ErroProvedorIA(abortado ? "A IA demorou demais para responder." : "Não foi possível falar com a IA.", undefined, e);
        }
        finally {
            clearTimeout(timer);
        }
        if (!resposta.ok) {
            const detalhe = await resposta.text().catch(() => "");
            // A chave nunca entra na mensagem de erro que sobe para o usuário.
            throw new provider_1.ErroProvedorIA(`Provedor de IA respondeu ${resposta.status}.`, resposta.status, detalhe.slice(0, 500));
        }
        const dados = (await resposta.json());
        const msg = dados.choices?.[0]?.message;
        const chamadas = (msg?.tool_calls ?? []).map((c) => ({
            id: c.id,
            nome: c.function?.name ?? "",
            argumentos: lerArgumentos(c.function?.arguments),
        }));
        return {
            texto: msg?.content ?? "",
            chamadas,
            tokensEntrada: dados.usage?.prompt_tokens,
            tokensSaida: dados.usage?.completion_tokens,
        };
    }
}
exports.ProvedorDeepSeek = ProvedorDeepSeek;
