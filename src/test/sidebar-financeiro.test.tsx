import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { login: "command06" }, token: "t" }),
}));

vi.mock("@/hooks/useLicenseFeatures", () => ({
  useLicenseFeatures: () => ({
    canUseVendas: true,
    canUsePagamentos: true,
    canUseDespesas: true,
    canUseRelatorios: true,
    canUseAuditoria: true,
    canUsePlanos: true,
  }),
}));

function renderSidebar(rota = "/despesas", onOpenTutorial?: () => void) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <SidebarProvider>
        <AppSidebar onOpenTutorial={onOpenTutorial} />
      </SidebarProvider>
    </MemoryRouter>,
  );
}

describe("Submenu Financeiro", () => {
  it("separa movimentação de cadastros", () => {
    renderSidebar();
    expect(screen.getByText("Movimentação")).toBeInTheDocument();
    expect(screen.getByText("Cadastros")).toBeInTheDocument();
  });

  it("usa um rótulo curto para o fluxo de caixa", () => {
    renderSidebar();
    // O rótulo longo era truncado ("Dashboard de Fluxo...") na barra lateral.
    expect(screen.getByText("Fluxo de Caixa")).toBeInTheDocument();
    expect(screen.queryByText(/Dashboard de Fluxo/)).not.toBeInTheDocument();
  });

  it("mantém os itens do dia a dia antes dos cadastros", () => {
    renderSidebar();
    const ordem = ["Fluxo de Caixa", "Contas a Pagar", "Extrato / Lançamento", "Contas", "Plano de Contas", "Fornecedores"];
    const posicoes = ordem.map((t) => {
      const el = screen.getByText(t);
      return { t, y: Array.from(document.querySelectorAll("*")).indexOf(el) };
    });
    const ordenado = [...posicoes].sort((a, b) => a.y - b.y).map((p) => p.t);
    expect(ordenado).toEqual(ordem);
  });

  it("preserva os destinos de cada aba", () => {
    renderSidebar();
    // A aba padrão vai para /despesas sem query; as demais levam ?tab=.
    expect(screen.getByText("Fluxo de Caixa").closest("a")).toHaveAttribute("href", "/despesas");
    expect(screen.getByText("Contas a Pagar").closest("a")).toHaveAttribute("href", "/despesas?tab=despesas");
    expect(screen.getByText("Extrato / Lançamento").closest("a")).toHaveAttribute("href", "/despesas?tab=lancamentos");
    expect(screen.getByText("Plano de Contas").closest("a")).toHaveAttribute("href", "/despesas?tab=categorias");
    expect(screen.getByText("Fornecedores").closest("a")).toHaveAttribute("href", "/despesas?tab=fornecedores");
    expect(screen.getByText("Contas").closest("a")).toHaveAttribute("href", "/despesas?tab=contas");
  });

  it("mantém o tutorial guiado acessível pelo menu", () => {
    const onOpenTutorial = vi.fn();
    renderSidebar("/", onOpenTutorial);
    fireEvent.click(screen.getByText("Tutorial guiado"));
    expect(onOpenTutorial).toHaveBeenCalledOnce();
  });
});
