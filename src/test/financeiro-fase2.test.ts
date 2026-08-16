import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = resolve(__dirname, "../..");
const ler = (arquivo: string) => readFileSync(resolve(raiz, arquivo), "utf8");

describe("regressões da fase 2 do financeiro", () => {
  it("consulta contas a pagar no plano de contas atual e preserva despesas administrativas", () => {
    const fonte = ler("backend/src/routes/modules/relatorios.ts");
    expect(fonte).toContain("LEFT JOIN loteamentos lo ON lo.id_loteamento = d.id_loteamento");
    expect(fonte).toContain("COALESCE(lo.nome, 'Administrativa') AS loteamento");
    expect(fonte).toContain("LEFT JOIN plano_de_contas cat ON cat.id_conta_contabil = d.id_categoria");
    expect(fonte).not.toContain("categorias_despesa cat");
  });

  it("mantém relatório selecionado na URL e só consulta após busca automática ou explícita", () => {
    const fonte = ler("src/pages/Relatorios.tsx");
    expect(fonte).toContain('searchParams.get("r")');
    expect(fonte).toContain('setSearchParams(report ? { r: report } : {}');
    expect(fonte).toContain('enabled: selectedReport === "fluxo-caixa" && hasSearchedFluxoCaixa');
    expect(fonte).toContain('useState(() => selectedReport === "fluxo-caixa")');
  });

  it("audita operações financeiras críticas com valores anteriores e novos", () => {
    const fontes = ["pagamentos.ts", "despesas.ts", "lancamentos.ts", "contas.ts", "empresas.ts"]
      .map((arquivo) => ler(`backend/src/routes/modules/${arquivo}`))
      .join("\n");

    for (const tabela of [
      "pagamentos",
      "despesas",
      "despesa_parcelas",
      "lancamentos_manuais",
      "contas",
      "plano_de_contas",
      "fornecedores",
      "configuracoes_financeiras",
    ]) {
      expect(fontes).toContain(`"${tabela}"`);
    }
    expect(fontes).toContain("valoresAntigos");
    expect(ler("backend/src/routes/modules/auditoria.ts")).toContain("valores_antigos: a.valores_antigos");
  });
});
