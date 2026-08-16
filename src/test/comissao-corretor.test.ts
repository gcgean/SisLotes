import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ler = (arquivo: string) => readFileSync(path.join(process.cwd(), arquivo), "utf8");

describe("comissão de corretor vinculada à venda", () => {
  it("cria vínculos reversíveis entre venda, fornecedor e despesa", () => {
    const migration = ler("backend/src/migrations/1700000000047-AddComissaoVenda.ts");
    expect(migration).toContain("id_corretor integer REFERENCES fornecedores");
    expect(migration).toContain("id_venda_origem integer REFERENCES vendas");
    expect(migration).toContain("DROP COLUMN id_venda_origem");
  });

  it("gera a conta a pagar na mesma transação da venda", () => {
    const rota = ler("backend/src/routes/modules/vendas.ts");
    expect(rota).toContain("queryRunner.manager.create(Despesa");
    expect(rota).toContain("queryRunner.manager.create(DespesaParcela");
    expect(rota).toContain("Comissão de Corretor");
    expect(rota).toContain("id_venda_origem: savedVenda.id_venda");
  });

  it("bloqueia cancelamento se a comissão já tiver baixa", () => {
    const rota = ler("backend/src/routes/modules/vendas.ts");
    expect(rota).toContain('error: "comissao_paga"');
    expect(rota).toContain("Estorne o pagamento da comissão");
    expect(rota).toContain("novoTotalContrato");
    expect(rota).toContain("Estorne a comissão antes de alterar os valores da venda");
  });

  it("permite valor fixo ou percentual no fluxo de nova venda", () => {
    const pagina = ler("src/pages/Vendas.tsx");
    expect(pagina).toContain("Gerar comissão de corretor");
    expect(pagina).toContain("Percentual do contrato");
    expect(pagina).toContain("Valor fixo");
  });
});
