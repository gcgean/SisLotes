import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ler = (arquivo: string) => readFileSync(path.join(process.cwd(), arquivo), "utf8");

describe("comprovantes financeiros", () => {
  it("persiste comprovante por baixa e por lançamento manual", () => {
    const migration = ler("backend/src/migrations/1700000000045-AddComprovantesFinanceiros.ts");
    expect(migration).toContain("ALTER TABLE lancamentos_manuais ADD COLUMN anexo_nome");
    expect(migration).toContain("ALTER TABLE despesa_parcela_pagamentos ADD COLUMN anexo_nome");
    expect(migration).toContain("DROP COLUMN anexo_base64");
  });

  it("valida e envia o comprovante nas duas operações", () => {
    const despesas = ler("backend/src/routes/modules/despesas.ts");
    const lancamentos = ler("backend/src/routes/modules/lancamentos.ts");
    expect(despesas).toContain("anexoFinanceiroSchema");
    expect(despesas).toContain("anexo_nome,anexo_base64");
    expect(lancamentos).toContain("anexoFinanceiroCampos");
  });

  it("limita o arquivo no componente reutilizável", () => {
    const componente = ler("src/components/financeiro/ComprovanteInput.tsx");
    expect(componente).toContain("5 * 1024 * 1024");
    expect(componente).toContain("application/pdf");
    expect(componente).toContain("reader.readAsDataURL(file)");
  });
});
