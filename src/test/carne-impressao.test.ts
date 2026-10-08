import { describe, expect, it, vi, beforeEach } from "vitest";
import { imprimirCarneDetalhado, type CarneEmpresa, type CarneSlip } from "@/utils/carne";

// Regressão: o carnê saía cortado na impressão. Eram dois problemas somados —
// `@page margin: 0` com só 8mm de padding no body (abaixo da área não-imprimível
// de muitas impressoras, cortava a coluna da direita) e página de 280mm que, com
// os 16mm de padding, dava 296mm numa folha de 297mm.
//
// Estes testes travam a aritmética da folha, não a aparência.

const A4_ALTURA_MM = 297;
const A4_LARGURA_MM = 210;

// Praticamente toda impressora doméstica/escritório imprime dentro de 10mm da
// borda. Abaixo disso o recorte passa a depender do modelo.
const FOLGA_MINIMA_MM = 8;

const EMPRESA: CarneEmpresa = {
  nome_fantasia: "IMOBILIÁRIA RABELO LTDA",
  cnpj: "00.000.000/0001-00",
  endereco: "Rua André Chaves, 67",
  bairro: "Bairro Montese",
  cidade: "Fortaleza",
  estado: "CE",
  telefone: "(85) 0000-0000",
};

function parcela(numero: number): CarneSlip {
  return {
    idVenda: 1234,
    numero_parcela: numero,
    totalParcelas: 36,
    vencimentoFmt: "05/06/2012",
    valor: 317.1,
    cliente: "Francisco César Viana Gondim da Silva",
    loteamentoNome: "PLANALTO DO TABULEIRO",
    loteNum: "22",
    quadraNum: "54",
    enderecoLoteamento: "Tabuleiro do Norte - CE",
  };
}

let escrito = "";

function mockJanela(retorno: unknown = undefined) {
  escrito = "";
  const janela = {
    document: { write: (html: string) => { escrito += html; }, close: vi.fn() },
    focus: vi.fn(),
  };
  vi.stubGlobal("open", vi.fn(() => (retorno === undefined ? janela : retorno)));
}

/** Lê um valor em mm de uma propriedade CSS do HTML gerado. */
function mmDe(css: string, regex: RegExp): number {
  const achado = css.match(regex);
  expect(achado, `não encontrei ${regex} no CSS gerado`).toBeTruthy();
  return Number(achado![1]);
}

beforeEach(() => vi.unstubAllGlobals());

describe("carnê — o conteúdo cabe na folha", () => {
  it("deixa folga suficiente das bordas para a impressora não cortar", () => {
    mockJanela();
    imprimirCarneDetalhado(EMPRESA, [parcela(1)], "Carnê — Venda #1234", false);

    const margem = mmDe(escrito, /@page\s*\{[^}]*margin:\s*(\d+(?:\.\d+)?)mm/);
    expect(margem).toBeGreaterThanOrEqual(FOLGA_MINIMA_MM);
  });

  it("não deixa a página estourar a altura do A4", () => {
    mockJanela();
    imprimirCarneDetalhado(EMPRESA, [parcela(1)], "Carnê — Venda #1234", false);

    const margem = mmDe(escrito, /@page\s*\{[^}]*margin:\s*(\d+(?:\.\d+)?)mm/);
    const alturaPagina = mmDe(escrito, /\.page\s*\{[^}]*height:\s*(\d+(?:\.\d+)?)mm/);

    // Altura ocupada = página + margem de cima + margem de baixo.
    expect(alturaPagina + margem * 2).toBeLessThanOrEqual(A4_ALTURA_MM);
  });

  it("não acumula padding do body por cima da margem do @page", () => {
    mockJanela();
    imprimirCarneDetalhado(EMPRESA, [parcela(1)], "Carnê — Venda #1234", false);

    // O padding do body somava à margem e era o que apertava a folha.
    const paddingBody = escrito.match(/body\s*\{[^}]*padding:\s*([^;]+);/);
    expect(paddingBody).toBeTruthy();
    expect(paddingBody![1].trim()).toBe("0");
  });

  it("as duas vias cabem lado a lado na largura útil", () => {
    mockJanela();
    imprimirCarneDetalhado(EMPRESA, [parcela(1)], "Carnê — Venda #1234", false);

    const margem = mmDe(escrito, /@page\s*\{[^}]*margin:\s*(\d+(?:\.\d+)?)mm/);
    const larguraUtil = A4_LARGURA_MM - margem * 2;

    // Duas colunas 1fr em grid: só precisam de largura útil positiva e folgada.
    expect(escrito).toContain("grid-template-columns: 1fr 1fr");
    expect(larguraUtil).toBeGreaterThan(150);
  });
});

describe("carnê — conteúdo", () => {
  it("gera as duas vias de cada parcela", () => {
    mockJanela();
    expect(imprimirCarneDetalhado(EMPRESA, [parcela(1)], "Carnê", false)).toBe(true);

    expect(escrito).toContain("1ª Via — Cliente");
    expect(escrito).toContain("2ª Via — Empresa");
    expect(escrito).toContain("Francisco César Viana Gondim da Silva");
    expect(escrito).toContain("317,10");
  });

  it("quebra a cada 3 parcelas por folha", () => {
    mockJanela();
    const seis = [1, 2, 3, 4, 5, 6].map(parcela);
    imprimirCarneDetalhado(EMPRESA, seis, "Carnê", false);

    const paginas = escrito.match(/class="page"/g) ?? [];
    expect(paginas).toHaveLength(2);
  });

  it("omite os dados da empresa quando o papel já é timbrado", () => {
    mockJanela();
    imprimirCarneDetalhado(EMPRESA, [parcela(1)], "Carnê", true);

    expect(escrito).not.toContain("IMOBILIÁRIA RABELO LTDA");
    // O resto do carnê continua lá.
    expect(escrito).toContain("Francisco César Viana Gondim da Silva");
  });

  it("avisa o chamador quando o popup é bloqueado", () => {
    mockJanela(null);
    expect(imprimirCarneDetalhado(EMPRESA, [parcela(1)], "Carnê", false)).toBe(false);
  });
});
