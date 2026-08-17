import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  imprimirExtratoFechamento,
  imprimirRelatorioFechamento,
  type ExtratoFechamentoImpressao,
  type RelatorioFechamentoImpressao,
} from "@/utils/fechamento";

const MOVIMENTOS = [
  { data: "2026-08-04", tipo: "despesa" as const, descricao: "energia", conta: "BANCO DO BRASIL", loteamento: "Administrativa", origem: "manual", valor: 100 },
  { data: "2026-08-04", tipo: "receita" as const, descricao: "internet", conta: "BANCO DO BRASIL", loteamento: "Administrativa", origem: "manual", valor: 150 },
];

const EXTRATO: ExtratoFechamentoImpressao = {
  contaLabel: "Todas as contas",
  periodoDe: "2026-08-01", periodoAte: "2026-08-16",
  saldoInicial: 600, entradas: 150, saidas: 100, saldoFinal: 650,
  variacaoCaixa: 50, contasReceberPendentes: 0, contasPagarPendentes: 0, saldoNaoConsolidado: 0,
  movimentos: MOVIMENTOS,
};

const RELATORIO: RelatorioFechamentoImpressao = {
  idRelatorio: 7, empresaNome: "IMOBILIARIA RABELO", contaLabel: "BANCO DO BRASIL",
  periodoDe: "2026-08-01", periodoAte: "2026-08-16",
  saldoInicial: 600, entradas: 150, saidas: 100, saldoFinal: 650,
  lancamentos: MOVIMENTOS,
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

describe("impressão do fechamento", () => {
  it("coloca os totalizadores depois da tabela", () => {
    mockJanela();
    expect(imprimirExtratoFechamento(EXTRATO, null, false)).toBe(true);

    const idxTabela = escrito.indexOf("<table>");
    const idxTotais = escrito.indexOf("Totais do período");
    expect(idxTabela).toBeGreaterThan(-1);
    expect(idxTotais).toBeGreaterThan(idxTabela);
    // E o bloco de totais fica dentro do container de fim, antes do rodapé.
    expect(escrito.indexOf('class="resumo-fim"')).toBeGreaterThan(idxTabela);
    expect(escrito.indexOf('class="rodape"')).toBeGreaterThan(idxTotais);
  });

  it("mesma ordem no relatório de fechamento salvo", () => {
    mockJanela();
    imprimirRelatorioFechamento(RELATORIO, null, false);

    const idxTabela = escrito.indexOf("<table>");
    expect(escrito.indexOf("Totais do período")).toBeGreaterThan(idxTabela);
    expect(escrito).toContain("Relatório de fechamento #7");
  });

  it("mostra os valores do período e o resultado de caixa", () => {
    mockJanela();
    imprimirExtratoFechamento(EXTRATO, null, false);

    expect(escrito).toMatch(/R\$\s600,00/);
    expect(escrito).toMatch(/R\$\s650,00/);
    expect(escrito).toContain("O período acumulou caixa");
    expect(escrito).toContain("energia");
    expect(escrito).toContain("Administrativa");
  });

  it("indica quando o período queimou caixa", () => {
    mockJanela();
    imprimirExtratoFechamento({ ...EXTRATO, variacaoCaixa: -50 }, null, false);
    expect(escrito).toContain("O período queimou caixa");
  });

  it("herda as proteções do relatório base", () => {
    mockJanela();
    imprimirExtratoFechamento(EXTRATO, null, false);

    expect(escrito).toContain('name="viewport"');
    expect(escrito).toMatch(/text-size-adjust:\s*100%/);
    expect(escrito).toContain("display: table-header-group");
    expect(escrito.indexOf("@page")).toBeGreaterThan(escrito.indexOf("@media print"));
  });

  it("escapa conteudo vindo do banco", () => {
    mockJanela();
    imprimirExtratoFechamento(
      { ...EXTRATO, movimentos: [{ ...MOVIMENTOS[0], descricao: "<img onerror=x>" }] },
      null,
      false,
    );
    expect(escrito).not.toContain("<img onerror=x>");
    expect(escrito).toContain("&lt;img");
  });

  it("mostra aviso quando nao ha movimentos", () => {
    mockJanela();
    imprimirExtratoFechamento({ ...EXTRATO, movimentos: [] }, null, false);
    expect(escrito).toContain("Nenhum movimento no período.");
  });

  it("avisa quando o pop-up e bloqueado", () => {
    mockJanela(null);
    expect(imprimirExtratoFechamento(EXTRATO, null, false)).toBe(false);
  });
});
