import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(__dirname, "../..");
const ler = (arquivo: string) => fs.readFileSync(path.join(raiz, arquivo), "utf8");

describe("estrutura de cobranças bancárias", () => {
  it("mantém os dados de integração opcionais e o estado inicial como rascunho", () => {
    const migration = ler("backend/src/migrations/1700000000040-CreateCobrancasBancarias.ts");
    expect(migration).toContain("DEFAULT 'rascunho'");
    expect(migration).toContain("provedor varchar(80)");
    expect(migration).toContain("linha_digitavel varchar(200)");
    expect(migration).toContain("pix_copia_cola text");
  });
  it("expõe apenas CRUD de rascunho, com isolamento por empresa", () => {
    const rota = ler("backend/src/routes/modules/cobrancas.ts");
    expect(rota).toContain('requireFeature("module_despesas")');
    expect(rota).toContain("AND id_empresa=$2");
    expect(rota).toContain('a.status!=="rascunho"');
    expect(rota).not.toMatch(/emitir|baixar|webhook/i);
  });
  it("informa claramente na interface que a integração ainda não existe", () => {
    const tela = ler("src/components/financeiro/CobrancasTab.tsx");
    expect(tela).toContain("Estrutura preparada, integração pendente.");
    expect(tela).toContain("Nenhum boleto, QR Code ou remessa bancária é gerado");
    expect(tela).toContain("DestructiveConfirmationDialog");
  });
});
