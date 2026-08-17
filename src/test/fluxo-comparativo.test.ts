import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const fonte = readFileSync(path.join(process.cwd(), "src/components/financeiro/VisaoGeralTab.tsx"), "utf8");

describe("fluxo de caixa realizado versus projetado", () => {
  it("mantém fontes independentes para realizado e projeção", () => {
    expect(fonte).toContain('/api/relatorios/fluxo-de-caixa"');
    expect(fonte).toContain('/api/relatorios/fluxo-de-caixa-previsto"');
  });

  it("apresenta cada período em uma linha completa", () => {
    expect(fonte).toContain("Fluxo de caixa: realizado × projetado");
    expect(fonte).toContain("Realizado — últimos 12 meses");
    expect(fonte).toContain("Projetado — próximos 12 meses");
    expect(fonte).toContain('className="grid grid-cols-1 gap-4"');
    expect(fonte).not.toContain("xl:grid-cols-2");
  });
});
