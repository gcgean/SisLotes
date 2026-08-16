import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ler = (arquivo: string) => readFileSync(path.join(process.cwd(), arquivo), "utf8");

describe("distrato e renegociação", () => {
  it("mantém histórico versionado e reversível", () => {
    const migration = ler("backend/src/migrations/1700000000048-CreateVendaAcordos.ts");
    expect(migration).toContain("CREATE TABLE venda_acordos");
    expect(migration).toContain("snapshot_antes jsonb");
    expect(migration).toContain("snapshot_depois jsonb");
    expect(migration).toContain("DROP TABLE venda_acordos");
  });

  it("renegocia apenas parcelas em aberto e preserva as pagas", () => {
    const rota = ler("backend/src/routes/modules/vendas.ts");
    expect(rota).toContain('p.situacao === "aberto"');
    expect(rota).toContain('p.situacao === "pago"');
    expect(rota).toContain('tipo: "renegociacao"');
    expect(rota).toContain("await manager.remove(abertas)");
  });

  it("distrata sem gerar devolução automática", () => {
    const rota = ler("backend/src/routes/modules/vendas.ts");
    expect(rota).toContain('tipo: "distrato"');
    expect(rota).toContain("devolucao_automatica: false");
    expect(rota).toContain('venda.status = "cancelada"');
  });

  it("explica as consequências antes da confirmação", () => {
    const pagina = ler("src/pages/Vendas.tsx");
    expect(pagina).toContain("Nenhuma devolução será gerada automaticamente");
    expect(pagina).toContain("Recebimentos anteriores não serão alterados");
  });
});
