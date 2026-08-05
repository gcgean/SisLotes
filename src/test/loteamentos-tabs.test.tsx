import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MapaLotesTab } from "@/components/loteamentos/MapaLotesTab";
import { DividaPorLoteamentoTab } from "@/components/loteamentos/DividaPorLoteamentoTab";
import { LoteamentoMultiCombobox } from "@/components/ui/loteamento-multi-combobox";

// As abas só dependem do token do useAuth para montar o header das requisições.
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ token: "t" }) }));

const LOTEAMENTOS = [
  { id_loteamento: 1, nome: "ARACAPE I", cidade: "Fortaleza", estado: "CE" },
  { id_loteamento: 2, nome: "BANDEIRAO", cidade: "Limoeiro do Norte", estado: "CE" },
];

function renderComQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function mockFetch(porUrl: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const chave = Object.keys(porUrl).find((k) => String(url).includes(k));
      return { ok: chave !== undefined, json: async () => (chave ? porUrl[chave] : []) };
    }),
  );
}

beforeEach(() => vi.unstubAllGlobals());

describe("abas de loteamentos", () => {
  // Regressão: o ícone Map do lucide sombreava o construtor nativo usado em
  // `new Map()`, quebrando o render da aba inteira (tela em branco).
  it("MapaLotesTab renderiza e agrupa os lotes por quadra", async () => {
    mockFetch({
      "/api/relatorios/lotes-por-loteamento": [
        { ...LOTEAMENTOS[0], totalLotes: 2, vendidos: 1, disponiveis: 1, percentualVendido: 50 },
      ],
      "/api/loteamentos/1/lotes": [
        { id_lote: 10, lote: "01", quadra: "A", status: "disponivel", cliente: null, status_venda: null },
        { id_lote: 11, lote: "02", quadra: "A", status: "vendido", cliente: "Fulano", status_venda: "aberta" },
      ],
    });

    renderComQuery(<MapaLotesTab />);

    expect(await screen.findByText("ARACAPE I")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /ver mapa/i }));
    expect(await screen.findByText(/Quadra A/)).toBeInTheDocument();
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
  });

  it("MapaLotesTab não quebra com quadra vazia", async () => {
    mockFetch({
      "/api/relatorios/lotes-por-loteamento": [
        { ...LOTEAMENTOS[0], totalLotes: 1, vendidos: 0, disponiveis: 1, percentualVendido: 0 },
      ],
      "/api/loteamentos/1/lotes": [
        { id_lote: 10, lote: "01", quadra: null, status: "disponivel", cliente: null, status_venda: null },
      ],
    });

    renderComQuery(<MapaLotesTab />);
    fireEvent.click(await screen.findByRole("button", { name: /ver mapa/i }));
    expect(await screen.findByText(/Quadra —/)).toBeInTheDocument();
  });

  it("DividaPorLoteamentoTab renderiza a tabela", async () => {
    mockFetch({
      "/api/relatorios/divida-por-loteamento": [
        {
          ...LOTEAMENTOS[0],
          totalVendido: 1000, totalPago: 400, totalAtrasado: 600, totalAVencer: 0,
          qtdParcelasAtrasadas: 3, qtdParcelasAVencer: 0, qtdVendas: 2, percentualPago: 40,
        },
      ],
    });

    renderComQuery(<DividaPorLoteamentoTab />);
    expect(await screen.findByText("ARACAPE I")).toBeInTheDocument();
    expect(screen.getByText("3 parcelas")).toBeInTheDocument();
  });
});

describe("LoteamentoMultiCombobox", () => {
  it("seleciona em um único clique e permite mais de um loteamento", async () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <LoteamentoMultiCombobox loteamentos={LOTEAMENTOS} value={[]} onValueChange={onValueChange} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /todos os loteamentos/i }));
    fireEvent.click(await screen.findByText("ARACAPE I"));
    // Regressão: com <label> em volta do Checkbox o clique disparava duas vezes.
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith([1]);

    onValueChange.mockClear();
    rerender(
      <LoteamentoMultiCombobox loteamentos={LOTEAMENTOS} value={[1]} onValueChange={onValueChange} />,
    );
    fireEvent.click(screen.getByText("BANDEIRAO"));
    expect(onValueChange).toHaveBeenCalledWith([1, 2]);
  });

  it("busca por cidade além do nome", async () => {
    render(
      <LoteamentoMultiCombobox loteamentos={LOTEAMENTOS} value={[]} onValueChange={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /todos os loteamentos/i }));
    fireEvent.change(await screen.findByPlaceholderText(/loteamento ou cidade/i), {
      target: { value: "limoeiro" },
    });

    await waitFor(() => expect(screen.queryByText("ARACAPE I")).not.toBeInTheDocument());
    expect(screen.getByText("BANDEIRAO")).toBeInTheDocument();
  });
});
