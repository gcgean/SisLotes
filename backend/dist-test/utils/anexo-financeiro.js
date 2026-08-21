"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.anexoFinanceiroSchema = exports.anexoFinanceiroCampos = void 0;
exports.refinarAnexoFinanceiro = refinarAnexoFinanceiro;
const zod_1 = require("zod");
const TIPOS_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
exports.anexoFinanceiroCampos = {
    anexo_nome: zod_1.z.string().trim().max(200).optional().nullable(),
    anexo_base64: zod_1.z.string().max(8000000, "O comprovante excede o limite permitido.").optional().nullable(),
};
function refinarAnexoFinanceiro(anexo, ctx) {
    if (Boolean(anexo.anexo_nome) !== Boolean(anexo.anexo_base64)) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "Informe o nome e o conteúdo do comprovante.", path: ["anexo_base64"] });
    }
    if (anexo.anexo_base64) {
        const tipo = /^data:([^;,]+);base64,/.exec(anexo.anexo_base64)?.[1];
        if (!tipo || !TIPOS_PERMITIDOS.includes(tipo)) {
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "O comprovante deve ser PDF, JPG, PNG ou WEBP.", path: ["anexo_base64"] });
        }
    }
}
exports.anexoFinanceiroSchema = zod_1.z.object(exports.anexoFinanceiroCampos).superRefine(refinarAnexoFinanceiro);
