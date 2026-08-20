// ─── Provedor: DeepSeek ──────────────────────────────────────────────────────
// A API do DeepSeek segue o formato da OpenAI (chat/completions + tool calling),
// então falamos HTTP direto e evitamos mais uma dependência no backend.

import {
  ChamadaDeFerramenta,
  ErroProvedorIA,
  FerramentaDeclarada,
  MensagemIA,
  ProvedorIA,
  RespostaIA,
} from "./provider";

const URL_PADRAO = "https://api.deepseek.com/chat/completions";
const MODELO_PADRAO = "deepseek-chat";
const TIMEOUT_MS = 60_000;

type MensagemWire = {
  role: string;
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
};

function paraWire(m: MensagemIA): MensagemWire {
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
                type: "function" as const,
                function: { name: c.nome, arguments: JSON.stringify(c.argumentos) },
              })),
            }
          : {}),
      };
  }
}

/** Argumentos chegam como string JSON e podem vir malformados — nunca confiar. */
function lerArgumentos(bruto: string | undefined): Record<string, unknown> {
  if (!bruto) return {};
  try {
    const v = JSON.parse(bruto);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export class ProvedorDeepSeek implements ProvedorIA {
  readonly nome = "deepseek";
  readonly modelo: string;
  private readonly apiKey: string;
  private readonly url: string;

  constructor(opcoes?: { apiKey?: string; modelo?: string; url?: string }) {
    const apiKey = opcoes?.apiKey ?? process.env.DEEPSEEK_API_KEY ?? "";
    if (!apiKey) {
      throw new ErroProvedorIA("DEEPSEEK_API_KEY não configurada no servidor.");
    }
    this.apiKey = apiKey;
    this.modelo = opcoes?.modelo ?? process.env.DEEPSEEK_MODEL ?? MODELO_PADRAO;
    this.url = opcoes?.url ?? process.env.DEEPSEEK_URL ?? URL_PADRAO;
  }

  async conversar(mensagens: MensagemIA[], ferramentas: FerramentaDeclarada[]): Promise<RespostaIA> {
    const corpo = {
      model: this.modelo,
      messages: mensagens.map(paraWire),
      ...(ferramentas.length
        ? {
            tools: ferramentas.map((f) => ({
              type: "function" as const,
              function: { name: f.nome, description: f.descricao, parameters: f.parametros },
            })),
            tool_choice: "auto" as const,
          }
        : {}),
    };

    // Timeout explícito: sem isso uma resposta travada prende a requisição do usuário.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let resposta: Response;
    try {
      resposta = await fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(corpo),
        signal: controller.signal,
      });
    } catch (e) {
      const abortado = e instanceof Error && e.name === "AbortError";
      throw new ErroProvedorIA(
        abortado ? "A IA demorou demais para responder." : "Não foi possível falar com a IA.",
        undefined,
        e,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!resposta.ok) {
      const detalhe = await resposta.text().catch(() => "");
      // A chave nunca entra na mensagem de erro que sobe para o usuário.
      throw new ErroProvedorIA(`Provedor de IA respondeu ${resposta.status}.`, resposta.status, detalhe.slice(0, 500));
    }

    const dados = (await resposta.json()) as {
      choices?: { message?: MensagemWire }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const msg = dados.choices?.[0]?.message;
    const chamadas: ChamadaDeFerramenta[] = (msg?.tool_calls ?? []).map((c) => ({
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
