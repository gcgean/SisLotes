"use strict";
// Testes do assistente de IA — usam o test runner nativo do Node (node:test),
// sem dependência nova, para não afetar o `npm ci` do servidor.
//
// Rodar: npm run test:ia (compila e executa)
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const zod_1 = require("zod");
const assistente_1 = require("./assistente");
const tools_1 = require("./tools");
function usuario(extra = {}) {
    return { id_usuario: 1, login: "teste", id_empresa: 7, user_master: false, ...extra };
}
function ctx(u) {
    return { usuario: u, idEmpresa: u.id_empresa };
}
/** Provedor de mentira: devolve respostas roteirizadas, sem rede. */
class ProvedorFalso {
    constructor(roteiro) {
        this.roteiro = roteiro;
        this.nome = "falso";
        this.modelo = "falso-1";
        this.chamadasRecebidas = [];
    }
    async conversar(mensagens, ferramentas) {
        this.chamadasRecebidas.push({ mensagens: [...mensagens], ferramentas });
        return this.roteiro.shift() ?? { texto: "fim", chamadas: [] };
    }
}
const texto = (t) => ({ texto: t, chamadas: [] });
const chama = (nome, argumentos = {}) => ({
    texto: "",
    chamadas: [{ id: "c1", nome, argumentos }],
});
(0, node_test_1.describe)("permissões das ferramentas", () => {
    const semPermissao = {
        nome: "acao_restrita",
        descricao: "x",
        risco: "escrita",
        schema: zod_1.z.object({}),
        permissao: "financeiro_estornar",
        executar: async () => ({ ok: true }),
    };
    (0, node_test_1.it)("libera ferramenta sem permissão exigida", () => {
        const livre = { nome: "livre", descricao: "x", risco: "consulta", schema: zod_1.z.object({}), executar: async () => ({}) };
        strict_1.default.equal((0, tools_1.podeUsar)(livre, usuario()), true);
    });
    (0, node_test_1.it)("bloqueia quem não tem a permissão", () => {
        strict_1.default.equal((0, tools_1.podeUsar)(semPermissao, usuario()), false);
    });
    (0, node_test_1.it)("libera quem tem a permissão", () => {
        strict_1.default.equal((0, tools_1.podeUsar)(semPermissao, usuario({ financeiro_estornar: true })), true);
    });
    (0, node_test_1.it)("user_master passa por cima da permissão", () => {
        strict_1.default.equal((0, tools_1.podeUsar)(semPermissao, usuario({ user_master: true })), true);
    });
    (0, node_test_1.it)("só declara ao modelo as ferramentas que o usuário pode usar", () => {
        const nomes = (0, assistente_1.declararFerramentas)(usuario()).map((f) => f.nome);
        // Nenhuma ferramenta declarada pode exigir permissão que o usuário não tem.
        strict_1.default.ok(nomes.length > 0);
        strict_1.default.ok(nomes.includes("listar_loteamentos"));
    });
});
(0, node_test_1.describe)("schema exposto ao modelo", () => {
    (0, node_test_1.it)("marca obrigatórios e opcionais corretamente", () => {
        const decl = (0, assistente_1.declararFerramentas)(usuario());
        const busca = decl.find((f) => f.nome === "buscar_cliente");
        strict_1.default.ok(busca);
        const p = busca.parametros;
        strict_1.default.deepEqual(p.required, ["termo"]);
        strict_1.default.equal(p.properties.termo.type, "string");
        const divida = decl.find((f) => f.nome === "divida_por_loteamento");
        const pd = divida.parametros;
        // id_loteamento é opcional — não pode entrar em required
        strict_1.default.equal(pd.required, undefined);
        strict_1.default.equal(pd.properties.id_loteamento.type, "number");
    });
});
(0, node_test_1.describe)("laço do assistente", () => {
    (0, node_test_1.it)("responde direto quando o modelo não pede ferramenta", async () => {
        const p = new ProvedorFalso([texto("Olá!")]);
        const r = await (0, assistente_1.responder)(p, "oi", ctx(usuario()));
        strict_1.default.equal(r.resposta, "Olá!");
        strict_1.default.deepEqual(r.ferramentasUsadas, []);
    });
    (0, node_test_1.it)("envia o prompt de sistema antes da pergunta", async () => {
        const p = new ProvedorFalso([texto("ok")]);
        await (0, assistente_1.responder)(p, "pergunta", ctx(usuario()));
        const enviadas = p.chamadasRecebidas[0].mensagens;
        strict_1.default.equal(enviadas[0].papel, "sistema");
        strict_1.default.equal(enviadas[enviadas.length - 1].papel, "usuario");
    });
    (0, node_test_1.it)("recusa ferramenta inexistente sem quebrar", async () => {
        const p = new ProvedorFalso([chama("ferramenta_que_nao_existe"), texto("Não consegui.")]);
        const r = await (0, assistente_1.responder)(p, "x", ctx(usuario()));
        strict_1.default.equal(r.resposta, "Não consegui.");
        // O resultado devolvido ao modelo deve sinalizar indisponibilidade.
        const devolvido = p.chamadasRecebidas[1].mensagens.find((m) => m.papel === "ferramenta");
        strict_1.default.ok(devolvido && "conteudo" in devolvido && devolvido.conteudo.includes("não disponível"));
    });
    (0, node_test_1.it)("rejeita argumentos que não passam no schema", async () => {
        // termo exige no mínimo 2 caracteres
        const p = new ProvedorFalso([chama("buscar_cliente", { termo: "a" }), texto("fim")]);
        await (0, assistente_1.responder)(p, "x", ctx(usuario()));
        const devolvido = p.chamadasRecebidas[1].mensagens.find((m) => m.papel === "ferramenta");
        strict_1.default.ok(devolvido && "conteudo" in devolvido && devolvido.conteudo.includes("Parâmetros inválidos"));
    });
    (0, node_test_1.it)("corta o laço quando o modelo insiste em chamar ferramentas", async () => {
        // Sempre pede ferramenta: o teto tem que interromper.
        const roteiro = Array.from({ length: 20 }, () => chama("listar_loteamentos"));
        const p = new ProvedorFalso(roteiro);
        const r = await (0, assistente_1.responder)(p, "x", ctx(usuario()));
        strict_1.default.match(r.resposta, /vezes demais/);
        // Não pode ter ido ao modelo 20 vezes.
        strict_1.default.ok(p.chamadasRecebidas.length <= 6, `foi ao modelo ${p.chamadasRecebidas.length}x`);
    });
    (0, node_test_1.it)("declara as ferramentas de escrita ao modelo", async () => {
        const nomes = (0, assistente_1.declararFerramentas)(usuario()).map((f) => f.nome);
        strict_1.default.ok(nomes.includes("criar_conta_a_pagar"));
        strict_1.default.ok(nomes.includes("criar_lancamento"));
    });
});
(0, node_test_1.describe)("isolamento por empresa", () => {
    (0, node_test_1.it)("usa o id_empresa do contexto, não o que o modelo mandar", async () => {
        const capturado = {};
        const espia = {
            nome: "espia",
            descricao: "x",
            risco: "consulta",
            schema: zod_1.z.object({ id_empresa: zod_1.z.number().optional() }),
            executar: async (_a, c) => {
                capturado.ctx = c;
                return { ok: true };
            },
        };
        // Injeta a ferramenta espiã no laço através de um provedor que a chama.
        const p = new ProvedorFalso([chama("espia", { id_empresa: 999 }), texto("fim")]);
        const { FERRAMENTAS } = await Promise.resolve().then(() => __importStar(require("./tools")));
        FERRAMENTAS.push(espia);
        try {
            await (0, assistente_1.responder)(p, "x", ctx(usuario({ id_empresa: 7 })));
        }
        finally {
            FERRAMENTAS.pop();
        }
        strict_1.default.ok(capturado.ctx, "a ferramenta deveria ter sido executada");
        // Mesmo o modelo mandando 999, o contexto manda 7.
        strict_1.default.equal(capturado.ctx.idEmpresa, 7);
    });
});
