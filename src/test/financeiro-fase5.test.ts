import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTAS_RECEITA_PADRAO, GRUPO_RECEITA_PADRAO } from "../../backend/src/config/contas-receita-padrao";

const raiz = resolve(__dirname, "../..");
const fonte = (path: string) => readFileSync(resolve(raiz, path), "utf8");

describe("plano de contas de receitas — fase 5", () => {
  it("mantém o catálogo padrão de receitas", () => {
    expect(GRUPO_RECEITA_PADRAO).toBe("Receitas");
    expect(CONTAS_RECEITA_PADRAO).toEqual([
      "Venda de Lotes",
      "Juros e Multas Recebidos",
      "Receitas Financeiras",
      "Outras Receitas",
    ]);
  });

  it("semeia empresas existentes sem duplicar grupos ou contas", () => {
    const migration = fonte("backend/src/migrations/1700000000035-SeedPlanoContasReceitas.ts");
    expect(migration).toContain("WHERE NOT EXISTS");
    expect(migration).toContain("existente.id_empresa = e.id_empresa");
    expect(migration).toContain("existente.id_pai = pai.id_conta_contabil");
    expect(fonte("backend/src/db/data-source.ts")).toContain("SeedPlanoContasReceitas1700000000035");
  });

  it("inclui o mesmo catálogo no primeiro acesso de novas empresas", () => {
    const setup = fonte("backend/src/routes/modules/setup.ts");
    expect(setup).toContain("GRUPO_RECEITA_PADRAO");
    expect(setup).toContain("CONTAS_RECEITA_PADRAO.map");
    expect(setup).toContain('tipo: "receita"');
  });
});
