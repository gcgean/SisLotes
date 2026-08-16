import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ler = (arquivo: string) => readFileSync(path.join(process.cwd(), arquivo), "utf8");

describe("retenções em contas a pagar", () => {
  it("adiciona ISS, IRRF e INSS com migration reversível", () => {
    const migration = ler("backend/src/migrations/1700000000046-AddRetencoesServicos.ts");
    for (const campo of ["iss_retido", "irrf_retido", "inss_retido"]) {
      expect(migration).toContain(`ADD COLUMN ${campo}`);
      expect(migration).toContain(`DROP COLUMN ${campo}`);
    }
  });

  it("deduz as retenções somente da saída líquida", () => {
    const rota = ler("backend/src/routes/modules/despesas.ts");
    expect(rota).toContain("const totalRetido = iss_retido + irrf_retido + inss_retido");
    expect(rota).toContain("valorBase + multa + juros - desconto - totalRetido");
    expect(rota).toContain("SUM(iss_retido)");
  });

  it("expõe os três valores no modal de pagamento", () => {
    const pagina = ler("src/pages/Despesas.tsx");
    expect(pagina).toContain("Retenções do serviço");
    expect(pagina).toContain("Total líquido a pagar");
    expect(pagina).toContain("iss_retido");
    expect(pagina).toContain("irrf_retido");
    expect(pagina).toContain("inss_retido");
  });
});
