import { describe, expect, it } from "vitest";
import { consolidarMovimentos, contaRecebimentoValida } from "@/lib/financeiro";

describe("livro financeiro único", () => {
  it("consolida recebimento, pagamento e lançamento manual", () => {
    expect(consolidarMovimentos([
      { tipo: "receita", valor: 200 },
      { tipo: "despesa", valor: 100 },
      { tipo: "despesa", valor: 50 },
    ])).toEqual({ receita: 200, despesa: 150, resultado: 50 });
  });

  it("exige conta válida para recebimento", () => {
    expect(contaRecebimentoValida("")).toBe(false);
    expect(contaRecebimentoValida("0")).toBe(false);
    expect(contaRecebimentoValida("12")).toBe(true);
  });
});
