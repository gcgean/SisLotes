import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { VisaoGeralTab } from "@/components/financeiro/VisaoGeralTab";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ token: "t" }) }));

// Dias 1..3 já passaram (hoje = 04/08/2026); 4 e 5 ainda vão acontecer.
function dia(data: string, aPagar: number, aReceber: number, saldoDia: number) {
  return { data, aPagar, aReceber, resultadoDia: aReceber - aPagar, saldoDia, itensPagar: [], itensReceber: [] };
}

const FLUXO_FUTURO = {
  mes: "2026-08",
  saldoInicialPeriodo: 650,
  totalAPagar: 150,
  totalAReceber: 0,
  saldoFinalProjetado: 500,
  dias: [
    // Saldo negativo só em dia passado: não deve gerar alerta de risco.
    dia("2026-08-01", 0, 0, -100),
    dia("2026-08-02", 0, 0, 650),
    dia("2026-08-03", 0, 0, 650),
    dia("2026-08-04", 0, 0, 650),
    dia("2026-08-05", 150, 0, 500),
  ],
  diasNegativos: ["2026-08-01"],
  melhorDiaPagamento: "2026-08-01",
  melhorDiaSaldo: 650,
};

function mockFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("fluxo-de-caixa-futuro")) return { ok: true, json: async () => FLUXO_FUTURO };
      if (u.includes("dashboard-kpis")) return { ok: true, json: async () => ({ recebidoMes: 0, despesasMes: 0 }) };
      return { ok: true, json: async () => [] };
    }),
  );
}

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <VisaoGeralTab />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
  // shouldAdvanceTime: sem isso os timers do React Query / testing-library
  // congelam e todo findBy* estoura timeout.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 7, 4)); // 04/08/2026, local
  mockFetch();
});
afterEach(() => vi.useRealTimers());

describe("VisaoGeralTab — fluxo de caixa futuro", () => {
  it("escreve o mês por extenso sem capitalizar a preposição", async () => {
    renderTab();
    expect(await screen.findByText("Agosto de 2026")).toBeInTheDocument();
    expect(screen.queryByText("Agosto De 2026")).not.toBeInTheDocument();
  });

  it("mostra os totais do período nos cards", async () => {
    renderTab();
    expect(await screen.findByText("R$ 650,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 150,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 500,00")).toBeInTheDocument();
  });

  it("ignora dias já passados ao avaliar risco de caixa", async () => {
    renderTab();
    // O único saldo negativo está no dia 01, que já passou.
    expect(await screen.findByText(/Fluxo de caixa positivo/)).toBeInTheDocument();
    expect(screen.queryByText(/Risco de falta de caixa/)).not.toBeInTheDocument();
  });

  it("não sugere um dia que já passou como melhor dia de pagamento", async () => {
    renderTab();
    await screen.findByText(/Fluxo de caixa positivo/);
    // Melhor dia deve sair dos dias 04/05, nunca do dia 01.
    expect(screen.queryByText(/dia 01/)).not.toBeInTheDocument();
    expect(screen.getByText(/dia 0[45]/)).toBeInTheDocument();
  });
});
