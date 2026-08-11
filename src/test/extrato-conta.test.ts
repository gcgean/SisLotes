import { describe, expect, it, vi, beforeEach } from "vitest";
import { imprimirExtratoConta, type ExtratoImpressao } from "@/utils/extratoConta";

const EXTRATO: ExtratoImpressao = {
  contaLabel: "BANCO DO BRASIL",
  periodoDe: "2026-08-01",
  periodoAte: "2026-08-11",
  saldoInicialPeriodo: 600,
  saldoFinalPeriodo: 650,
  totalCreditos: 150,
  totalDebitos: 100,
  movimentos: [
    {
      data: "2026-08-04", movimento: "entrada", descricao: "internet",
      contaContabil: null, contaApelido: "BANCO DO BRASIL", valor: 150, saldo: 750,
    },
    {
      data: "2026-08-04", movimento: "saida", descricao: "energia",
      contaContabil: "Rede Elétrica", contaApelido: "BANCO DO BRASIL", valor: 100, saldo: 650,
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
  return janela;
}

beforeEach(() => vi.unstubAllGlobals());

describe("imprimirExtratoConta", () => {
  it("monta o extrato com periodo, totais e movimentos", () => {
    mockJanela();
    expect(imprimirExtratoConta(EXTRATO, null, false)).toBe(true);

    expect(escrito).toContain("BANCO DO BRASIL");
    // Datas convertidas para o formato brasileiro.
    expect(escrito).toContain("01/08/2026");
    expect(escrito).toContain("11/08/2026");
    expect(escrito).toContain("04/08/2026");
    // Credito com sinal de mais, debito com sinal de menos.
    expect(escrito).toMatch(/\+R\$\s150,00/);
    expect(escrito).toMatch(/−R\$\s100,00/);
    // Saldos inicial e final.
    expect(escrito).toContain("R$ 600,00");
    expect(escrito).toContain("R$ 650,00");
    expect(escrito).toContain("energia");
    expect(escrito).toContain("Rede Elétrica");
  });

  it("inclui o timbrado da empresa apenas quando pedido", () => {
    const empresa = { nome_fantasia: "IMOBILIARIA TESTE", cnpj: "12.345.678/0001-90" };

    mockJanela();
    imprimirExtratoConta(EXTRATO, empresa, true);
    expect(escrito).toContain("IMOBILIARIA TESTE");
    expect(escrito).toContain("12.345.678/0001-90");

    mockJanela();
    imprimirExtratoConta(EXTRATO, empresa, false);
    expect(escrito).not.toContain("IMOBILIARIA TESTE");
  });

  it("escapa conteudo vindo do banco para nao injetar HTML", () => {
    mockJanela();
    imprimirExtratoConta(
      { ...EXTRATO, movimentos: [{ ...EXTRATO.movimentos[0], descricao: "<script>x</script>" }] },
      null,
      false,
    );
    expect(escrito).not.toContain("<script>x</script>");
    expect(escrito).toContain("&lt;script&gt;");
  });

  it("avisa quando o pop-up e bloqueado", () => {
    mockJanela(null);
    expect(imprimirExtratoConta(EXTRATO, null, false)).toBe(false);
  });

  it("mostra aviso quando nao ha movimentos", () => {
    mockJanela();
    imprimirExtratoConta({ ...EXTRATO, movimentos: [] }, null, false);
    expect(escrito).toContain("Nenhum movimento no período.");
  });
});
