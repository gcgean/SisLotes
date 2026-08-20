import { Response, Router } from "express";
import { z } from "zod";
import { AuthRequest, requireAuth } from "../../middleware/auth";
import { AuditoriaService } from "../../services/AuditoriaService";
import { responder } from "../../services/ia/assistente";
import { ProvedorDeepSeek } from "../../services/ia/deepseek";
import { ErroProvedorIA, MensagemIA, ProvedorIA } from "../../services/ia/provider";

export const assistenteRouter = Router();
assistenteRouter.use(requireAuth);

/**
 * O provedor é criado sob demanda (e reaproveitado) para o servidor subir mesmo
 * sem chave configurada — quem não usa o assistente não é afetado.
 * Trocar de IA é trocar esta função, nada mais.
 */
let provedorCache: ProvedorIA | null = null;
function obterProvedor(): ProvedorIA {
  if (!provedorCache) provedorCache = new ProvedorDeepSeek();
  return provedorCache;
}

const corpoSchema = z.object({
  pergunta: z.string().min(1, "Escreva uma pergunta").max(2000),
  // Histórico da conversa, enviado pelo frontend e limitado para conter custo.
  historico: z
    .array(
      z.object({
        papel: z.enum(["usuario", "assistente"]),
        conteudo: z.string().max(4000),
      }),
    )
    .max(20)
    .optional(),
});

// ─── Limite simples por empresa ──────────────────────────────────────────────
// Em memória: reinicia junto com o processo e não é compartilhado entre
// réplicas. Suficiente como trava de segurança inicial contra custo descontrolado;
// se o assistente virar uso pesado, isto deve virar contador no banco.
const LIMITE_POR_HORA = 100;
const usoPorEmpresa = new Map<number, { janelaIniciadaEm: number; chamadas: number }>();

function dentroDoLimite(idEmpresa: number): boolean {
  const agora = Date.now();
  const atual = usoPorEmpresa.get(idEmpresa);
  if (!atual || agora - atual.janelaIniciadaEm > 60 * 60 * 1000) {
    usoPorEmpresa.set(idEmpresa, { janelaIniciadaEm: agora, chamadas: 1 });
    return true;
  }
  if (atual.chamadas >= LIMITE_POR_HORA) return false;
  atual.chamadas += 1;
  return true;
}

// ─── GET /status — o frontend usa para exibir (ou esconder) o assistente ─────
assistenteRouter.get("/status", (_req: AuthRequest, res: Response) => {
  const configurado = Boolean(process.env.DEEPSEEK_API_KEY);
  return res.json({
    configurado,
    provedor: configurado ? obterProvedor().nome : null,
    modelo: configurado ? obterProvedor().modelo : null,
  });
});

// ─── POST / — pergunta ao assistente ─────────────────────────────────────────
assistenteRouter.post("/", async (req: AuthRequest, res: Response) => {
  const parse = corpoSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.issues[0]?.message ?? "Dados inválidos" });
  }

  const usuario = req.user;
  const idEmpresa = usuario?.id_empresa;
  if (!usuario || !idEmpresa) {
    return res.status(400).json({ error: "Empresa não definida para o usuário" });
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    return res.status(503).json({ error: "Assistente de IA não configurado neste servidor." });
  }

  if (!dentroDoLimite(idEmpresa)) {
    return res.status(429).json({
      error: "Limite de perguntas por hora atingido. Tente novamente mais tarde.",
    });
  }

  const historico: MensagemIA[] = (parse.data.historico ?? []).map((m) =>
    m.papel === "usuario"
      ? { papel: "usuario" as const, conteudo: m.conteudo }
      : { papel: "assistente" as const, conteudo: m.conteudo },
  );

  try {
    const resultado = await responder(obterProvedor(), parse.data.pergunta, { usuario, idEmpresa }, historico);

    console.log(
      `[assistente] empresa=${idEmpresa} usuario=${usuario.login} ` +
        `ferramentas=[${resultado.ferramentasUsadas.join(",")}] ` +
        `executou=${resultado.acoesExecutadas.length} ` +
        `tokens=${resultado.tokensEntrada}/${resultado.tokensSaida}`,
    );

    // Toda gravação feita pela IA entra na auditoria marcada como tal, para o
    // gestor conseguir separar depois o que foi a IA do que foi a pessoa.
    for (const acao of resultado.acoesExecutadas) {
      const tabela = acao.ferramenta === "criar_conta_a_pagar" ? "despesas" : "lancamentos_manuais";
      await AuditoriaService.registrar(
        req,
        tabela,
        "CREATE",
        acao.id,
        undefined,
        acao.resumo,
        `Criado pelo assistente de IA a pedido de ${usuario.login}: "${parse.data.pergunta.slice(0, 120)}"`,
      );
    }

    return res.json({
      resposta: resultado.resposta,
      acoesExecutadas: resultado.acoesExecutadas,
      propostas: resultado.propostas,
      ferramentasUsadas: resultado.ferramentasUsadas,
    });
  } catch (e) {
    if (e instanceof ErroProvedorIA) {
      // A chave e o corpo do erro do provedor nunca sobem para o cliente.
      console.error("[assistente] erro do provedor:", e.message, e.status ?? "", e.detalhe ?? "");
      return res.status(502).json({ error: e.message });
    }
    console.error("[assistente] erro inesperado:", e);
    return res.status(500).json({ error: "Erro ao falar com o assistente." });
  }
});
