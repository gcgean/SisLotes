"use strict";
// ─── Contrato de provedor de IA ──────────────────────────────────────────────
// A camada de ferramentas (tools.ts) não sabe qual modelo está rodando. Trocar
// de provedor é implementar esta interface e apontar a configuração — nada da
// lógica de negócio, permissão ou isolamento por empresa muda junto.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErroProvedorIA = void 0;
/** Erro de provedor — separa falha de infraestrutura de erro de negócio. */
class ErroProvedorIA extends Error {
    constructor(message, status, detalhe) {
        super(message);
        this.status = status;
        this.detalhe = detalhe;
        this.name = "ErroProvedorIA";
    }
}
exports.ErroProvedorIA = ErroProvedorIA;
