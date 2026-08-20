// Testes do assistente de IA — usam o test runner nativo do Node (node:test),
// sem dependência nova, para não afetar o `npm ci` do servidor.
//
// Rodar: npm run test:ia (compila e executa)

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { declararFerramentas, responder } from "./assistente";
import { FerramentaDeclarada, MensagemIA, ProvedorIA, RespostaIA } from "./provider";
import { ContextoIA, Ferramenta, podeUsar } from "./tools";

type UsuarioFalso = { id_usuario: number; login: string; id_empresa: number; user_master: boolean } & Record<
  string,
  unknown
>;

function usuario(extra: Partial<UsuarioFalso> = {}): UsuarioFalso {
  return { id_usuario: 1, login: "teste", id_empresa: 7, user_master: false, ...extra };
}

function ctx(u: UsuarioFalso): ContextoIA {
  return { usuario: u as never, idEmpresa: u.id_empresa };
}

/** Provedor de mentira: devolve respostas roteirizadas, sem rede. */
class ProvedorFalso implements ProvedorIA {
  readonly nome = "falso";
  readonly modelo = "falso-1";
  chamadasRecebidas: { mensagens: MensagemIA[]; ferramentas: FerramentaDeclarada[] }[] = [];

  constructor(private roteiro: RespostaIA[]) {}

  async conversar(mensagens: MensagemIA[], ferramentas: FerramentaDeclarada[]): Promise<RespostaIA> {
    this.chamadasRecebidas.push({ mensagens: [...mensagens], ferramentas });
    return this.roteiro.shift() ?? { texto: "fim", chamadas: [] };
  }
}

const texto = (t: string): RespostaIA => ({ texto: t, chamadas: [] });
const chama = (nome: string, argumentos: Record<string, unknown> = {}): RespostaIA => ({
  texto: "",
  chamadas: [{ id: "c1", nome, argumentos }],
});

describe("permissões das ferramentas", () => {
  const semPermissao: Ferramenta = {
    nome: "acao_restrita",
    descricao: "x",
    schema: z.object({}),
    permissao: "financeiro_estornar",
    executar: async () => ({ ok: true }),
  };

  it("libera ferramenta sem permissão exigida", () => {
    const livre: Ferramenta = { nome: "livre", descricao: "x", schema: z.object({}), executar: async () => ({}) };
    assert.equal(podeUsar(livre, usuario() as never), true);
  });

  it("bloqueia quem não tem a permissão", () => {
    assert.equal(podeUsar(semPermissao, usuario() as never), false);
  });

  it("libera quem tem a permissão", () => {
    assert.equal(podeUsar(semPermissao, usuario({ financeiro_estornar: true }) as never), true);
  });

  it("user_master passa por cima da permissão", () => {
    assert.equal(podeUsar(semPermissao, usuario({ user_master: true }) as never), true);
  });

  it("só declara ao modelo as ferramentas que o usuário pode usar", () => {
    const nomes = declararFerramentas(usuario() as never).map((f) => f.nome);
    // Nenhuma ferramenta declarada pode exigir permissão que o usuário não tem.
    assert.ok(nomes.length > 0);
    assert.ok(nomes.includes("listar_loteamentos"));
  });
});

describe("schema exposto ao modelo", () => {
  it("marca obrigatórios e opcionais corretamente", () => {
    const decl = declararFerramentas(usuario() as never);
    const busca = decl.find((f) => f.nome === "buscar_cliente");
    assert.ok(busca);
    const p = busca.parametros as { required?: string[]; properties: Record<string, { type: string }> };
    assert.deepEqual(p.required, ["termo"]);
    assert.equal(p.properties.termo.type, "string");

    const divida = decl.find((f) => f.nome === "divida_por_loteamento");
    const pd = divida!.parametros as { required?: string[]; properties: Record<string, { type: string }> };
    // id_loteamento é opcional — não pode entrar em required
    assert.equal(pd.required, undefined);
    assert.equal(pd.properties.id_loteamento.type, "number");
  });
});

describe("laço do assistente", () => {
  it("responde direto quando o modelo não pede ferramenta", async () => {
    const p = new ProvedorFalso([texto("Olá!")]);
    const r = await responder(p, "oi", ctx(usuario()));
    assert.equal(r.resposta, "Olá!");
    assert.deepEqual(r.ferramentasUsadas, []);
  });

  it("envia o prompt de sistema antes da pergunta", async () => {
    const p = new ProvedorFalso([texto("ok")]);
    await responder(p, "pergunta", ctx(usuario()));
    const enviadas = p.chamadasRecebidas[0].mensagens;
    assert.equal(enviadas[0].papel, "sistema");
    assert.equal(enviadas[enviadas.length - 1].papel, "usuario");
  });

  it("recusa ferramenta inexistente sem quebrar", async () => {
    const p = new ProvedorFalso([chama("ferramenta_que_nao_existe"), texto("Não consegui.")]);
    const r = await responder(p, "x", ctx(usuario()));
    assert.equal(r.resposta, "Não consegui.");
    // O resultado devolvido ao modelo deve sinalizar indisponibilidade.
    const devolvido = p.chamadasRecebidas[1].mensagens.find((m) => m.papel === "ferramenta");
    assert.ok(devolvido && "conteudo" in devolvido && devolvido.conteudo.includes("não disponível"));
  });

  it("rejeita argumentos que não passam no schema", async () => {
    // termo exige no mínimo 2 caracteres
    const p = new ProvedorFalso([chama("buscar_cliente", { termo: "a" }), texto("fim")]);
    await responder(p, "x", ctx(usuario()));
    const devolvido = p.chamadasRecebidas[1].mensagens.find((m) => m.papel === "ferramenta");
    assert.ok(devolvido && "conteudo" in devolvido && devolvido.conteudo.includes("Parâmetros inválidos"));
  });

  it("corta o laço quando o modelo insiste em chamar ferramentas", async () => {
    // Sempre pede ferramenta: o teto tem que interromper.
    const roteiro = Array.from({ length: 20 }, () => chama("listar_loteamentos"));
    const p = new ProvedorFalso(roteiro);
    const r = await responder(p, "x", ctx(usuario()));
    assert.match(r.resposta, /vezes demais/);
    // Não pode ter ido ao modelo 20 vezes.
    assert.ok(p.chamadasRecebidas.length <= 6, `foi ao modelo ${p.chamadasRecebidas.length}x`);
  });

  it("não expõe ferramenta de escrita a quem não pode usá-la", async () => {
    const decl = declararFerramentas(usuario() as never);
    const propor = decl.find((f) => f.nome === "propor_conta_a_pagar");
    // A ferramenta de proposta não exige permissão (não grava nada), então está disponível.
    assert.ok(propor, "propor_conta_a_pagar deve estar disponível");
  });
});

describe("isolamento por empresa", () => {
  it("usa o id_empresa do contexto, não o que o modelo mandar", async () => {
    const capturado: { ctx?: ContextoIA } = {};
    const espia: Ferramenta = {
      nome: "espia",
      descricao: "x",
      schema: z.object({ id_empresa: z.number().optional() }),
      executar: async (_a, c) => {
        capturado.ctx = c;
        return { ok: true };
      },
    };

    // Injeta a ferramenta espiã no laço através de um provedor que a chama.
    const p = new ProvedorFalso([chama("espia", { id_empresa: 999 }), texto("fim")]);
    const { FERRAMENTAS } = await import("./tools");
    FERRAMENTAS.push(espia);
    try {
      await responder(p, "x", ctx(usuario({ id_empresa: 7 })));
    } finally {
      FERRAMENTAS.pop();
    }

    assert.ok(capturado.ctx, "a ferramenta deveria ter sido executada");
    // Mesmo o modelo mandando 999, o contexto manda 7.
    assert.equal(capturado.ctx.idEmpresa, 7);
  });
});
