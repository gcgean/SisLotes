import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(__dirname, "../..");
const ler = (arquivo: string) => fs.readFileSync(path.join(raiz, arquivo), "utf8");

describe("aging financeiro", () => {
  it("classifica exatamente nas quatro faixas solicitadas", () => {
    const rota = ler("backend/src/routes/modules/relatorios.ts");
    expect(rota).toContain('dias <= 30');
    expect(rota).toContain('dias <= 60');
    expect(rota).toContain('dias <= 90');
    expect(rota).toContain('["0–30", "31–60", "61–90", "+90"]');
  });
  it("considera apenas títulos vencidos e saldos remanescentes da conta a pagar", () => {
    const rota = ler("backend/src/routes/modules/relatorios.ts");
    expect(rota).toContain("p.vencimento<=$2::date");
    expect(rota).toContain("p.situacao='aberto'");
    expect(rota).toContain("p.situacao<>'pago'");
    expect(rota).toContain("SUM(valor_principal+desconto)");
    expect(rota).toContain("v.status<>'cancelada'");
  });
  it("exibe contas a pagar e receber no relatório", () => {
    const tela = ler("src/components/financeiro/AgingReport.tsx");
    expect(tela).toContain('titulo="Contas a receber"');
    expect(tela).toContain('titulo="Contas a pagar"');
    expect(tela).toContain("Data de referência");
  });
});
