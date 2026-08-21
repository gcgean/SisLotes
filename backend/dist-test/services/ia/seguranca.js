"use strict";
// ─── Barreiras de segurança do assistente ────────────────────────────────────
// Duas travas, aplicadas fora das ferramentas para valerem sempre — mesmo se uma
// ferramenta nova esquecer de se proteger:
//
//   1. Nada sensível sai. Senha, token, chave e afins são removidos de qualquer
//      resultado antes de chegar ao modelo (e portanto ao usuário).
//   2. Nada sai de outra empresa. O id_empresa vem do usuário autenticado; aqui
//      conferimos que a consulta escrita pela ferramenta realmente o aplica.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TABELAS_PROIBIDAS = void 0;
exports.sanitizar = sanitizar;
exports.exigirEscopoDeEmpresa = exigirEscopoDeEmpresa;
exports.executaSemConfirmacao = executaSemConfirmacao;
/**
 * Nomes de campo que nunca podem sair do servidor. A comparação é por trecho e
 * sem acento/caixa, então "senha_hash", "bot_token" e "apiKey" são pegos.
 */
const CAMPOS_PROIBIDOS = [
    "senha",
    "password",
    "token",
    "secret",
    "api_key",
    "apikey",
    "hash",
    "authorization",
    "credential",
    "private_key",
];
/** Tabelas que o assistente nunca consulta, nem para leitura. */
exports.TABELAS_PROIBIDAS = [
    "usuarios",
    "telegram_config",
    "hub_billing_charges",
    "hub_billing_events",
];
const VALOR_OCULTO = "[protegido]";
function chaveEhProibida(chave) {
    const normal = chave
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();
    return CAMPOS_PROIBIDOS.some((proibido) => normal.includes(proibido));
}
/**
 * Remove campos sensíveis de qualquer estrutura, em qualquer profundidade.
 * Aplicado no resultado de TODA ferramenta, sem exceção.
 */
function sanitizar(valor, profundidade = 0) {
    // Trava de profundidade contra estrutura circular ou muito aninhada.
    if (profundidade > 12)
        return VALOR_OCULTO;
    if (valor === null || valor === undefined)
        return valor;
    if (Array.isArray(valor))
        return valor.map((v) => sanitizar(v, profundidade + 1));
    if (typeof valor === "object") {
        if (valor instanceof Date)
            return valor;
        const saida = {};
        for (const [chave, v] of Object.entries(valor)) {
            saida[chave] = chaveEhProibida(chave) ? VALOR_OCULTO : sanitizar(v, profundidade + 1);
        }
        return saida;
    }
    return valor;
}
/**
 * Confere que a consulta é escopada pela empresa do usuário.
 * Uma ferramenta que leia dados sem filtrar por id_empresa é bug de
 * vazamento entre clientes — falha aqui, em desenvolvimento, e não em produção.
 */
function exigirEscopoDeEmpresa(sql, ondeVemDe) {
    const normal = sql.toLowerCase();
    for (const tabela of exports.TABELAS_PROIBIDAS) {
        // \b não serve: "usuarios" casaria dentro de "id_usuarios".
        if (new RegExp(`(from|join)\\s+${tabela}\\b`).test(normal)) {
            throw new Error(`[${ondeVemDe}] consulta a tabela proibida para o assistente: ${tabela}`);
        }
    }
    if (!normal.includes("id_empresa")) {
        throw new Error(`[${ondeVemDe}] consulta sem filtro de id_empresa — risco de vazar dados de outra empresa`);
    }
}
function executaSemConfirmacao(nivel) {
    return nivel !== "critica";
}
