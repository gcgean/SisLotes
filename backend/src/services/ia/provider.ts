// ─── Contrato de provedor de IA ──────────────────────────────────────────────
// A camada de ferramentas (tools.ts) não sabe qual modelo está rodando. Trocar
// de provedor é implementar esta interface e apontar a configuração — nada da
// lógica de negócio, permissão ou isolamento por empresa muda junto.

export interface FerramentaDeclarada {
  nome: string;
  descricao: string;
  /** JSON Schema dos parâmetros, no formato aceito por function calling. */
  parametros: Record<string, unknown>;
}

export interface ChamadaDeFerramenta {
  id: string;
  nome: string;
  argumentos: Record<string, unknown>;
}

export type MensagemIA =
  | { papel: "sistema"; conteudo: string }
  | { papel: "usuario"; conteudo: string }
  | { papel: "assistente"; conteudo: string; chamadas?: ChamadaDeFerramenta[] }
  | { papel: "ferramenta"; idChamada: string; conteudo: string };

export interface RespostaIA {
  /** Texto para o usuário. Vazio quando o modelo só pediu ferramentas. */
  texto: string;
  chamadas: ChamadaDeFerramenta[];
  /** Tokens consumidos, quando o provedor informa — usado para custo/limite. */
  tokensEntrada?: number;
  tokensSaida?: number;
}

export interface ProvedorIA {
  readonly nome: string;
  readonly modelo: string;
  conversar(
    mensagens: MensagemIA[],
    ferramentas: FerramentaDeclarada[],
  ): Promise<RespostaIA>;
}

/** Erro de provedor — separa falha de infraestrutura de erro de negócio. */
export class ErroProvedorIA extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly detalhe?: unknown,
  ) {
    super(message);
    this.name = "ErroProvedorIA";
  }
}
