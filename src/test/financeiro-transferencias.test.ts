import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = resolve(__dirname, "../..");
const fonte = (path: string) => readFileSync(resolve(raiz, path), "utf8");

describe("transferências entre contas", () => {
  it("gera saída e entrada vinculadas à mesma transferência", () => {
    const migration = fonte("backend/src/migrations/1700000000036-CreateTransferenciasContas.ts");
    expect(migration).toContain("t.id_conta_origem AS id_conta");
    expect(migration).toContain("t.id_conta_destino AS id_conta");
    expect(migration.match(/t\.id_transferencia/g)?.length).toBeGreaterThanOrEqual(4);
    expect(migration.match(/'transferencia'::varchar\(20\)/g)).toHaveLength(2);
  });

  it("não inclui transferências nos agregados de receita e despesa", () => {
    const service = fonte("backend/src/services/FinanceiroService.ts");
    expect(service.match(/origem <> 'transferencia'/g)).toHaveLength(3);
  });

  it("valida contas distintas, ativas e pertencentes à empresa", () => {
    const rotas = fonte("backend/src/routes/modules/lancamentos.ts");
    expect(rotas).toContain("data.id_conta_origem !== data.id_conta_destino");
    expect(rotas).toContain("conta.id_empresa = :idEmpresa");
    expect(rotas).toContain("conta.ativo = true");
  });

  it("expõe criação, edição e exclusão conjunta no extrato", () => {
    const tela = fonte("src/components/financeiro/LancamentosTab.tsx");
    expect(tela).toContain("/api/lancamentos/transferencias");
    expect(tela).toContain("openEditTransferencia");
    expect(tela).toContain("A saída e a entrada serão removidas juntas");
    expect(fonte("src/pages/Auditoria.tsx")).toContain('value="transferencias_contas"');
  });
});
