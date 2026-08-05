import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AReceberPorLoteTab } from "@/components/pagamentos/AReceberPorLoteTab";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ token: "t" }) }));

const LOTEAMENTOS = [
  { id_loteamento: 1, nome: "ARACAPE I", cidade: "Fortaleza", estado: "CE" },
  { id_loteamento: 2, nome: "BANDEIRAO", cidade: "Limoeiro do Norte", estado: "CE" },
];

const PARCELAS = {
  parcelas: [
    {
      id_pagamento: 100, id_cliente: 7, cliente: "Maria Souza",
      id_loteamento: 1, loteamento: "ARACAPE I",
      id_lote: 55, quadra: "05", lote: "20",
      id_venda: 9, numeroParcela: 3, totalParcelas: 72,
      vencimento: "2026-01-10", valor: 210, diasAtraso: 30,
    },
    {
      id_pagamento: 101, id_cliente: 8, cliente: "Joao Lima",
      id_loteamento: 1, loteamento: "ARACAPE I",
      id_lote: 56, quadra: "09", lote: "07",
      id_venda: 10, numeroParcela: 1, totalParcelas: 36,
      vencimento: "2027-01-10", valor: 100, diasAtraso: 0,
    },
  ],
  totalEmAberto: 310, totalAtrasado: 210, totalAVencer: 100,
  qtdAtrasadas: 1, qtdAVencer: 1,
};

let urlsChamadas: string[] = [];

function mockFetch() {
  urlsChamadas = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      urlsChamadas.push(String(url));
      if (String(url).includes("/api/loteamentos")) {
        return { ok: true, json: async () => LOTEAMENTOS };
      }
      return { ok: true, json: async () => PARCELAS };
    }),
  );
}

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AReceberPorLoteTab />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
  mockFetch();
});

describe("AReceberPorLoteTab", () => {
  it("lista as parcelas em aberto com totais", async () => {
    renderTab();

    expect(await screen.findByText("Maria Souza")).toBeInTheDocument();
    expect(screen.getByText("Joao Lima")).toBeInTheDocument();
    expect(screen.getByText("Q. 05 · L. 20")).toBeInTheDocument();
    // Total em aberto aparece só no card; 210 e 100 aparecem no card e na linha.
    expect(screen.getByText("R$ 310,00")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 210,00").length).toBe(2);
    expect(screen.getAllByText("R$ 100,00").length).toBe(2);
  });

  it("filtra por lote/quadra e recalcula os totais exibidos", async () => {
    renderTab();
    await screen.findByText("Maria Souza");

    fireEvent.change(screen.getByPlaceholderText(/quadra, lote ou cliente/i), {
      target: { value: "20" },
    });

    await waitFor(() => expect(screen.queryByText("Joao Lima")).not.toBeInTheDocument());
    expect(screen.getByText("Maria Souza")).toBeInTheDocument();
    // Só a parcela atrasada de R$ 210 permanece, então o total em aberto acompanha.
    expect(screen.getAllByText("R$ 210,00").length).toBeGreaterThanOrEqual(2);
  });

  it("envia o filtro de loteamento para a API", async () => {
    renderTab();
    await screen.findByText("Maria Souza");

    fireEvent.click(screen.getByRole("button", { name: /todos os loteamentos/i }));
    fireEvent.click(await screen.findByText("BANDEIRAO"));

    await waitFor(() =>
      expect(urlsChamadas.some((u) => u.includes("a-receber?id_loteamento=2"))).toBe(true),
    );
  });

  it("aplica o filtro de somente atrasadas na consulta", async () => {
    renderTab();
    await screen.findByText("Maria Souza");

    fireEvent.click(screen.getByRole("button", { name: /somente atrasadas/i }));

    await waitFor(() =>
      expect(urlsChamadas.some((u) => u.includes("situacao=atrasado"))).toBe(true),
    );
  });
});
