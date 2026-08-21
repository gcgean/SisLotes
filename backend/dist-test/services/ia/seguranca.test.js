"use strict";
// Testes das barreiras de segurança do assistente.
// Cobrem as duas garantias pedidas: nada sensível sai, e nada sai de outra empresa.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const seguranca_1 = require("./seguranca");
(0, node_test_1.describe)("sanitizar — nada sensível sai do servidor", () => {
    (0, node_test_1.it)("remove senha, token e chave em qualquer nível", () => {
        const bruto = {
            nome: "Maria",
            senha: "123456",
            config: { bot_token: "abc", api_key: "xyz", cidade: "Fortaleza" },
            lista: [{ password: "p", ok: 1 }],
        };
        const limpo = (0, seguranca_1.sanitizar)(bruto);
        strict_1.default.equal(limpo.nome, "Maria");
        strict_1.default.equal(limpo.senha, "[protegido]");
        strict_1.default.equal(limpo.config.bot_token, "[protegido]");
        strict_1.default.equal(limpo.config.api_key, "[protegido]");
        // O que não é sensível continua legível.
        strict_1.default.equal(limpo.config.cidade, "Fortaleza");
        strict_1.default.equal(limpo.lista[0].password, "[protegido]");
        strict_1.default.equal(limpo.lista[0].ok, 1);
    });
    (0, node_test_1.it)("pega variações de caixa, acento e composição", () => {
        const limpo = (0, seguranca_1.sanitizar)({
            SENHA: "x",
            senha_hash: "x",
            apiKey: "x",
            Authorization: "Bearer x",
            credentialId: "x",
        });
        for (const chave of Object.keys(limpo)) {
            strict_1.default.equal(limpo[chave], "[protegido]", `${chave} deveria estar protegido`);
        }
    });
    (0, node_test_1.it)("não quebra com nulo, data e tipos simples", () => {
        const d = new Date("2026-01-01");
        const limpo = (0, seguranca_1.sanitizar)({ a: null, b: undefined, c: 1, d, e: "txt" });
        strict_1.default.equal(limpo.a, null);
        strict_1.default.equal(limpo.c, 1);
        strict_1.default.equal(limpo.d, d);
        strict_1.default.equal(limpo.e, "txt");
    });
    (0, node_test_1.it)("não entra em laço infinito com estrutura circular", () => {
        const a = { nome: "x" };
        a.eu = a;
        // Se a trava de profundidade falhar, isto estoura a pilha.
        strict_1.default.doesNotThrow(() => (0, seguranca_1.sanitizar)(a));
    });
});
(0, node_test_1.describe)("exigirEscopoDeEmpresa — nada sai de outra empresa", () => {
    (0, node_test_1.it)("aceita consulta que filtra por id_empresa", () => {
        strict_1.default.doesNotThrow(() => (0, seguranca_1.exigirEscopoDeEmpresa)("SELECT nome FROM loteamentos WHERE id_empresa = $1", "teste"));
    });
    (0, node_test_1.it)("recusa consulta sem filtro de empresa", () => {
        strict_1.default.throws(() => (0, seguranca_1.exigirEscopoDeEmpresa)("SELECT nome FROM loteamentos", "teste"), /id_empresa/);
    });
    (0, node_test_1.it)("recusa consulta às tabelas proibidas mesmo com filtro de empresa", () => {
        for (const tabela of seguranca_1.TABELAS_PROIBIDAS) {
            strict_1.default.throws(() => (0, seguranca_1.exigirEscopoDeEmpresa)(`SELECT * FROM ${tabela} WHERE id_empresa = $1`, "teste"), new RegExp(tabela), `deveria bloquear ${tabela}`);
        }
    });
    (0, node_test_1.it)("bloqueia tabela proibida também em JOIN", () => {
        strict_1.default.throws(() => (0, seguranca_1.exigirEscopoDeEmpresa)("SELECT c.nome FROM clientes c JOIN usuarios u ON u.id_usuario = c.id_empresa WHERE c.id_empresa = $1", "teste"), /usuarios/);
    });
    (0, node_test_1.it)("não confunde nome de coluna parecido com tabela proibida", () => {
        // "id_usuario" não pode disparar o bloqueio de "usuarios".
        strict_1.default.doesNotThrow(() => (0, seguranca_1.exigirEscopoDeEmpresa)("SELECT id_usuario, descricao FROM lancamentos_manuais WHERE id_empresa = $1", "teste"));
    });
});
(0, node_test_1.describe)("níveis de risco", () => {
    (0, node_test_1.it)("consulta e escrita executam sozinhas", () => {
        strict_1.default.equal((0, seguranca_1.executaSemConfirmacao)("consulta"), true);
        strict_1.default.equal((0, seguranca_1.executaSemConfirmacao)("escrita"), true);
    });
    (0, node_test_1.it)("ação crítica exige confirmação", () => {
        strict_1.default.equal((0, seguranca_1.executaSemConfirmacao)("critica"), false);
    });
});
