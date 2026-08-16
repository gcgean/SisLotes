import { describe, expect, it } from "vitest";
import { getScreenTutorial } from "@/lib/screen-tutorials";

describe("tutoriais por tela", () => {
  it("resolve as páginas principais", () => {
    expect(getScreenTutorial("/vendas", "").title).toBe("Vendas");
    expect(getScreenTutorial("/pagamentos", "").title).toBe("Contas a Receber");
    expect(getScreenTutorial("/auditoria", "").steps.length).toBeGreaterThan(0);
  });

  it("troca o tutorial conforme a aba financeira", () => {
    expect(getScreenTutorial("/despesas", "?tab=lancamentos").title).toBe("Extrato e Lançamentos");
    expect(getScreenTutorial("/despesas", "?tab=fechamento").title).toBe("Fechamento de Período");
    expect(getScreenTutorial("/despesas", "").title).toBe("Fluxo de Caixa");
  });

  it("mantém um tutorial seguro para rotas ainda não catalogadas", () => {
    const tutorial = getScreenTutorial("/nova-tela", "");
    expect(tutorial.title).toBe("Ajuda desta tela");
    expect(tutorial.videoUrl).toBeUndefined();
  });
});
