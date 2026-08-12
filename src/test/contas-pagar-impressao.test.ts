import { describe, expect, it, vi, beforeEach } from "vitest";
import { imprimirContasPagar, type ContasPagarImpressao } from "@/utils/contasPagar";

const DADOS: ContasPagarImpressao = {
  filtrosLabel: "Administrativas · Em aberto",
  contas: [
    {
      descricao: "internet", loteamento: "Administrativa", categoria: "Marketing",
      fornecedor: "fornecedor command 06", valorTotal: 50, valorPago: 0,
      parcelasPagas: 0, parcelasTotal: 1, vencimento: "2026-08-19",
      atrasada: false, recorrente: false,
    },
    {
      descricao: "energia", loteamento: "Administrativa", categoria: "Infraestrutura",
      fornecedor: null, valorTotal: 300, valorPago: 100,
      parcelasPagas: 1, parcelasTotal: 3, vencimento: "2026-07-28",
      atrasada: true, recorrente: true,
    },
  ],
};

let escrito = "";

function mockJanela(retorno: unknown = undefined) {
  escrito = "";
  const janela = {
    document: { write: (html: string) => { escrito += html; }, close: vi.fn() },
    focus: vi.fn(),
  };
  vi.stubGlobal("open", vi.fn(() => (retorno === undefined ? janela : retorno)));
}

beforeEach(() => vi.unstubAllGlobals());

describe("imprimirContasPagar", () => {
  it("lista as contas com fornecedor, parcelas e vencimento", () => {
    mockJanela();
    expect(imprimirContasPagar(DADOS, null, false)).toBe(true);

    expect(escrito).toContain("Contas a pagar");
    expect(escrito).toContain("Administrativas · Em aberto");
    expect(escrito).toContain("internet");
    expect(escrito).toContain("fornecedor command 06");
    expect(escrito).toContain("19/08/2026");
    expect(escrito).toContain("1/3");
    // Conta sem fornecedor não deixa a célula vazia.
    expect(escrito).toContain("—");
  });

  it("soma os totais e conta as atrasadas", () => {
    mockJanela();
    imprimirContasPagar(DADOS, null, false);

    expect(escrito).toMatch(/R\$\s350,00/); // valor total 50 + 300
    expect(escrito).toMatch(/R\$\s100,00/); // já pago
    expect(escrito).toMatch(/R\$\s250,00/); // em aberto
    // Uma conta atrasada, marcada com a classe de destaque.
    expect(escrito).toContain("atrasado");
  });

  it("marca contas recorrentes", () => {
    mockJanela();
    imprimirContasPagar(DADOS, null, false);
    expect(escrito).toContain("(recorrente)");
  });

  it("herda as proteções do relatório base", () => {
    mockJanela();
    imprimirContasPagar(DADOS, null, false);

    // Regressão do "font boosting" do Edge.
    expect(escrito).toContain('name="viewport"');
    expect(escrito).toMatch(/text-size-adjust:\s*100%/);
    expect(escrito).toContain("display: table-header-group");
    const idxMediaPrint = escrito.indexOf("@media print");
    expect(escrito.indexOf("@page")).toBeGreaterThan(idxMediaPrint);
  });

  it("inclui o timbrado apenas quando pedido", () => {
    const empresa = { nome_fantasia: "IMOBILIARIA TESTE" };

    mockJanela();
    imprimirContasPagar(DADOS, empresa, true);
    expect(escrito).toContain("IMOBILIARIA TESTE");

    mockJanela();
    imprimirContasPagar(DADOS, empresa, false);
    expect(escrito).not.toContain("IMOBILIARIA TESTE");
  });

  it("escapa conteudo vindo do banco", () => {
    mockJanela();
    imprimirContasPagar(
      { ...DADOS, contas: [{ ...DADOS.contas[0], descricao: "<img onerror=x>" }] },
      null,
      false,
    );
    expect(escrito).not.toContain("<img onerror=x>");
    expect(escrito).toContain("&lt;img");
  });

  it("mostra aviso quando o filtro nao retorna contas", () => {
    mockJanela();
    imprimirContasPagar({ ...DADOS, contas: [] }, null, false);
    expect(escrito).toContain("Nenhuma conta a pagar para os filtros aplicados.");
  });

  it("avisa quando o pop-up e bloqueado", () => {
    mockJanela(null);
    expect(imprimirContasPagar(DADOS, null, false)).toBe(false);
  });
});
