import { describe, expect, it } from "vitest";
import { distribuirAbatimento, type ParcelaParaNegociar } from "@/lib/encargos";

// Negociação de encargos: o atendente informa quanto o cliente vai pagar pelo
// conjunto selecionado e o sistema distribui o abatimento. Sai só dos encargos,
// nunca do principal — perdoar principal é distrato, outra operação.

const soma = (ns: number[]) => Number(ns.reduce((a, b) => a + b, 0).toFixed(2));

const TRES: ParcelaParaNegociar[] = [
  { id: 1, valor: 100, multa: 2, juros: 50 },
  { id: 2, valor: 100, multa: 2, juros: 40 },
  { id: 3, valor: 100, multa: 2, juros: 10 },
];
// principal 300 · encargos 106 · total 406

describe("faixa permitida", () => {
  it("expõe o total original e o mínimo (só principal)", () => {
    const r = distribuirAbatimento(TRES, 406);
    expect(r.totalOriginal).toBe(406);
    expect(r.minimo).toBe(300);
  });

  it("sem abatimento quando o negociado é o total", () => {
    const r = distribuirAbatimento(TRES, 406);
    expect(r.abatimento).toBe(0);
    expect(soma(r.parcelas.map((p) => p.total))).toBe(406);
  });

  it("não deixa cobrar mais que o total com encargos", () => {
    const r = distribuirAbatimento(TRES, 9999);
    expect(r.totalNegociado).toBe(406);
    expect(r.abatimento).toBe(0);
  });

  it("não deixa descer abaixo do principal — isso seria perdoar a dívida", () => {
    const r = distribuirAbatimento(TRES, 50);
    expect(r.totalNegociado).toBe(300);
    expect(r.abatimento).toBe(106);
    // Todo encargo zerado, principal intacto.
    expect(soma(r.parcelas.map((p) => p.multa))).toBe(0);
    expect(soma(r.parcelas.map((p) => p.juros))).toBe(0);
    expect(soma(r.parcelas.map((p) => p.valor))).toBe(300);
  });
});

describe("distribuição do abatimento", () => {
  it("a soma das parcelas bate exatamente com o valor negociado", () => {
    for (const alvo of [406, 400, 380, 350, 333.33, 320, 301, 300]) {
      const r = distribuirAbatimento(TRES, alvo);
      expect(soma(r.parcelas.map((p) => p.total))).toBe(r.totalNegociado);
    }
  });

  it("nunca mexe no principal de nenhuma parcela", () => {
    const r = distribuirAbatimento(TRES, 310);
    for (const p of r.parcelas) expect(p.valor).toBe(100);
  });

  it("abate proporcionalmente ao encargo de cada parcela", () => {
    // Abatimento de 53 (metade dos 106 de encargo) deve tirar ~metade de cada.
    const r = distribuirAbatimento(TRES, 353);
    const enc = r.parcelas.map((p) => Number((p.multa + p.juros).toFixed(2)));
    // original: 52, 42, 12  → metade: 26, 21, 6
    expect(enc[0]).toBeCloseTo(26, 1);
    expect(enc[1]).toBeCloseTo(21, 1);
    expect(enc[2]).toBeCloseTo(6, 1);
  });

  it("abate primeiro dos juros e só depois da multa", () => {
    // Uma parcela só, abatendo 50 de um encargo de 52 (juros 50 + multa 2).
    const uma: ParcelaParaNegociar[] = [{ id: 1, valor: 100, multa: 2, juros: 50 }];
    const r = distribuirAbatimento(uma, 102);
    expect(r.parcelas[0].juros).toBe(0);
    expect(r.parcelas[0].multa).toBe(2);
  });

  it("não deixa multa nem juros negativos", () => {
    const r = distribuirAbatimento(TRES, 300);
    for (const p of r.parcelas) {
      expect(p.multa).toBeGreaterThanOrEqual(0);
      expect(p.juros).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("arredondamento em centavos", () => {
  it("fecha no centavo mesmo com divisão inexata", () => {
    const tres: ParcelaParaNegociar[] = [
      { id: 1, valor: 10, multa: 0, juros: 3.33 },
      { id: 2, valor: 10, multa: 0, juros: 3.33 },
      { id: 3, valor: 10, multa: 0, juros: 3.34 },
    ];
    const r = distribuirAbatimento(tres, 35);
    expect(soma(r.parcelas.map((p) => p.total))).toBe(35);
  });

  it("não produz centavo fantasma ao abater tudo", () => {
    const tres: ParcelaParaNegociar[] = [
      { id: 1, valor: 33.33, multa: 1.11, juros: 2.22 },
      { id: 2, valor: 33.33, multa: 1.11, juros: 2.22 },
      { id: 3, valor: 33.34, multa: 1.12, juros: 2.23 },
    ];
    const r = distribuirAbatimento(tres, 0);
    expect(soma(r.parcelas.map((p) => p.total))).toBe(100);
    expect(soma(r.parcelas.map((p) => p.multa + p.juros))).toBe(0);
  });
});

describe("casos de borda", () => {
  it("lida com parcelas sem encargo nenhum", () => {
    const semEncargo: ParcelaParaNegociar[] = [
      { id: 1, valor: 100, multa: 0, juros: 0 },
      { id: 2, valor: 100, multa: 0, juros: 0 },
    ];
    const r = distribuirAbatimento(semEncargo, 150);
    expect(r.minimo).toBe(200);
    expect(r.totalNegociado).toBe(200);
    expect(r.abatimento).toBe(0);
    expect(soma(r.parcelas.map((p) => p.total))).toBe(200);
  });

  it("lida com uma única parcela", () => {
    const r = distribuirAbatimento([{ id: 9, valor: 317.1, multa: 6.34, juros: 1088.6 }], 500);
    expect(soma(r.parcelas.map((p) => p.total))).toBe(500);
    expect(r.parcelas[0].valor).toBe(317.1);
  });

  it("lida com lista vazia sem quebrar", () => {
    const r = distribuirAbatimento([], 0);
    expect(r.parcelas).toEqual([]);
    expect(r.totalOriginal).toBe(0);
  });
});
