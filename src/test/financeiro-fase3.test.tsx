import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MoneyInput, formatMoneyInput } from "@/components/ui/money-input";
import { rotuloParcela } from "@/lib/parcelas";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("integridade e segurança do financeiro — fase 3", () => {
  it("formata moeda brasileira e não usa input numérico", () => {
    expect(formatMoneyInput("1234.56")).toBe("R$ 1.234,56");
    const onValueChange = vi.fn();
    render(<MoneyInput aria-label="Valor" value="1234.56" onValueChange={onValueChange} />);
    const input = screen.getByLabelText("Valor");
    expect(input).toHaveAttribute("type", "text");
    fireEvent.change(input, { target: { value: "R$ 1.234,57" } });
    expect(onValueChange).toHaveBeenCalledWith("1234.57");
  });

  it("remove o foco no scroll para impedir alteração acidental", () => {
    render(<MoneyInput aria-label="Valor" value="10.00" onValueChange={() => undefined} />);
    const input = screen.getByLabelText("Valor");
    input.focus();
    fireEvent.wheel(input);
    expect(input).not.toHaveFocus();
  });

  it("não usa denominador finito em conta recorrente", () => {
    expect(rotuloParcela(3, 3, true)).toBe("Parcela 3 · recorrente");
    expect(rotuloParcela(2, 3, false)).toBe("2/3");
  });

  it("protege contas sintéticas no backend e baixas no extrato", () => {
    const raiz = resolve(__dirname, "../..");
    const despesas = readFileSync(resolve(raiz, "backend/src/routes/modules/despesas.ts"), "utf8");
    const lancamentos = readFileSync(resolve(raiz, "src/components/financeiro/LancamentosTab.tsx"), "utf8");
    expect(despesas).toContain("contaContabilAceitaLancamento");
    expect(lancamentos).toContain('m.origem === "manual"');
    expect(lancamentos).toContain('const exibirSaldoCorrente = contaFiltro !== "todas"');
  });
});
