// Testes das barreiras de segurança do assistente.
// Cobrem as duas garantias pedidas: nada sensível sai, e nada sai de outra empresa.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  exigirEscopoDeEmpresa,
  executaSemConfirmacao,
  sanitizar,
  TABELAS_PROIBIDAS,
} from "./seguranca";

describe("sanitizar — nada sensível sai do servidor", () => {
  it("remove senha, token e chave em qualquer nível", () => {
    const bruto = {
      nome: "Maria",
      senha: "123456",
      config: { bot_token: "abc", api_key: "xyz", cidade: "Fortaleza" },
      lista: [{ password: "p", ok: 1 }],
    };
    const limpo = sanitizar(bruto) as Record<string, never>;

    assert.equal(limpo.nome, "Maria");
    assert.equal(limpo.senha, "[protegido]");
    assert.equal((limpo.config as Record<string, unknown>).bot_token, "[protegido]");
    assert.equal((limpo.config as Record<string, unknown>).api_key, "[protegido]");
    // O que não é sensível continua legível.
    assert.equal((limpo.config as Record<string, unknown>).cidade, "Fortaleza");
    assert.equal((limpo.lista as Record<string, unknown>[])[0].password, "[protegido]");
    assert.equal((limpo.lista as Record<string, unknown>[])[0].ok, 1);
  });

  it("pega variações de caixa, acento e composição", () => {
    const limpo = sanitizar({
      SENHA: "x",
      senha_hash: "x",
      apiKey: "x",
      Authorization: "Bearer x",
      credentialId: "x",
    }) as Record<string, unknown>;

    for (const chave of Object.keys(limpo)) {
      assert.equal(limpo[chave], "[protegido]", `${chave} deveria estar protegido`);
    }
  });

  it("não quebra com nulo, data e tipos simples", () => {
    const d = new Date("2026-01-01");
    const limpo = sanitizar({ a: null, b: undefined, c: 1, d, e: "txt" }) as Record<string, unknown>;
    assert.equal(limpo.a, null);
    assert.equal(limpo.c, 1);
    assert.equal(limpo.d, d);
    assert.equal(limpo.e, "txt");
  });

  it("não entra em laço infinito com estrutura circular", () => {
    const a: Record<string, unknown> = { nome: "x" };
    a.eu = a;
    // Se a trava de profundidade falhar, isto estoura a pilha.
    assert.doesNotThrow(() => sanitizar(a));
  });
});

describe("exigirEscopoDeEmpresa — nada sai de outra empresa", () => {
  it("aceita consulta que filtra por id_empresa", () => {
    assert.doesNotThrow(() =>
      exigirEscopoDeEmpresa("SELECT nome FROM loteamentos WHERE id_empresa = $1", "teste"),
    );
  });

  it("recusa consulta sem filtro de empresa", () => {
    assert.throws(
      () => exigirEscopoDeEmpresa("SELECT nome FROM loteamentos", "teste"),
      /id_empresa/,
    );
  });

  it("recusa consulta às tabelas proibidas mesmo com filtro de empresa", () => {
    for (const tabela of TABELAS_PROIBIDAS) {
      assert.throws(
        () => exigirEscopoDeEmpresa(`SELECT * FROM ${tabela} WHERE id_empresa = $1`, "teste"),
        new RegExp(tabela),
        `deveria bloquear ${tabela}`,
      );
    }
  });

  it("bloqueia tabela proibida também em JOIN", () => {
    assert.throws(
      () =>
        exigirEscopoDeEmpresa(
          "SELECT c.nome FROM clientes c JOIN usuarios u ON u.id_usuario = c.id_empresa WHERE c.id_empresa = $1",
          "teste",
        ),
      /usuarios/,
    );
  });

  it("não confunde nome de coluna parecido com tabela proibida", () => {
    // "id_usuario" não pode disparar o bloqueio de "usuarios".
    assert.doesNotThrow(() =>
      exigirEscopoDeEmpresa(
        "SELECT id_usuario, descricao FROM lancamentos_manuais WHERE id_empresa = $1",
        "teste",
      ),
    );
  });
});

describe("níveis de risco", () => {
  it("consulta e escrita executam sozinhas", () => {
    assert.equal(executaSemConfirmacao("consulta"), true);
    assert.equal(executaSemConfirmacao("escrita"), true);
  });

  it("ação crítica exige confirmação", () => {
    assert.equal(executaSemConfirmacao("critica"), false);
  });
});
