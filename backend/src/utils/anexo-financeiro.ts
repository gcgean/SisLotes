import { RefinementCtx, z } from "zod";

const TIPOS_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export const anexoFinanceiroCampos = {
  anexo_nome: z.string().trim().max(200).optional().nullable(),
  anexo_base64: z.string().max(8_000_000, "O comprovante excede o limite permitido.").optional().nullable(),
};

export function refinarAnexoFinanceiro(anexo: { anexo_nome?: string | null; anexo_base64?: string | null }, ctx: RefinementCtx) {
  if (Boolean(anexo.anexo_nome) !== Boolean(anexo.anexo_base64)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe o nome e o conteúdo do comprovante.", path: ["anexo_base64"] });
  }
  if (anexo.anexo_base64) {
    const tipo = /^data:([^;,]+);base64,/.exec(anexo.anexo_base64)?.[1];
    if (!tipo || !TIPOS_PERMITIDOS.includes(tipo)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "O comprovante deve ser PDF, JPG, PNG ou WEBP.", path: ["anexo_base64"] });
    }
  }
}

export const anexoFinanceiroSchema = z.object(anexoFinanceiroCampos).superRefine(refinarAnexoFinanceiro);
