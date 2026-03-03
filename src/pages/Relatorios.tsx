import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Download, BarChart3, DollarSign, Users, Calendar, Printer } from "lucide-react";

function getAuthHeaders() {
  const token = window.localStorage.getItem("token");
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
  };
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const parseDateBR = (value: string) => {
  if (!value) return null;
  // Aceita apenas formato DD/MM/AAAA (4 dígitos de ano)
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return null;

  const [dStr, mStr, yStr] = value.split("/");
  const d = Number(dStr);
  const m = Number(mStr);
  const y = Number(yStr);

  if (!d || !m || !y) return null;

  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const formatDateBR = (date: Date) => {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const toIsoFromBr = (value: string) => {
  const d = parseDateBR(value);
  if (!d) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const monthNames = [
  "",
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const reportTypes = [
  {
    id: "entradas",
    title: "Entradas por Loteamento",
    description: "Resumo de entradas recebidas por loteamento no ano selecionado",
    icon: BarChart3,
  },
  {
    id: "enderecos",
    title: "Endereços para Carnê",
    description: "Lista de endereços dos clientes para emissão de carnês",
    icon: FileText,
  },
  {
    id: "atraso",
    title: "Títulos em Atraso",
    description: "Listagem completa de títulos vencidos e não pagos",
    icon: Calendar,
  },
  {
    id: "total-conta",
    title: "Total por Conta",
    description: "Totais recebidos agrupados por conta bancária",
    icon: DollarSign,
  },
  {
    id: "juros",
    title: "Juros Recebidos",
    description: "Relatório de juros e multas recebidos no período",
    icon: DollarSign,
  },
  {
    id: "clientes-conta",
    title: "Clientes por Conta",
    description: "Clientes agrupados por conta bancária utilizada",
    icon: Users,
  },
];

interface Loteamento {
  id_loteamento: number;
  nome: string;
}

interface EntradasPorLoteamento {
  id_loteamento: number;
  loteamento: string;
  jan: number;
  fev: number;
  mar: number;
  abr: number;
   mai: number;
   jun: number;
   jul: number;
   ago: number;
   set: number;
   out: number;
   nov: number;
   dez: number;
  total: number;
}

interface TituloEmAtraso {
  id_pagamento: number;
  cliente: string;
  lote: string;
  parcela: string;
  vencimento: string;
  valor: number;
  diasAtraso: number;
  multa: number;
  juros: number;
  total: number;
}

interface EnderecoCarne {
  id_cliente: number;
  nome: string;
  telefone: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  complemento: string;
  quadra: string;
  lote: string;
  loteamento: string;
}

interface TotalPorConta {
  id_conta: number;
  apelido: string;
  titular: string;
  agencia: string;
  conta: string;
  qtdPagamentos: number;
  total: number;
}

interface ContaRelatorio {
  id_conta: number;
  apelido: string;
  titular: string;
  agencia: string;
  conta: string;
}

interface JurosMes {
  mes: number;
  total: number;
}

interface JurosRecebidos {
  id_conta: number;
  titular: string;
  agencia: string;
  conta: string;
  meses: JurosMes[];
  totalGeral: number;
}

const Relatorios = () => {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [ano] = useState("2026");

  const defaultDataIni = (() => {
    const hoje = new Date();
    const inicioAno = new Date(hoje.getFullYear(), 0, 1);
    return formatDateBR(inicioAno);
  })();
  const defaultDataFim = formatDateBR(new Date());

  const [loteamentoIdInput, setLoteamentoIdInput] = useState<string>("all");
  const [dataIniInput, setDataIniInput] = useState(defaultDataIni);
  const [dataFimInput, setDataFimInput] = useState(defaultDataFim);

  const [diasAtrasoInput, setDiasAtrasoInput] = useState("1");
  const [clienteInput, setClienteInput] = useState("");

   const currentYear = new Date().getFullYear();
   const [contaIdJurosInput, setContaIdJurosInput] = useState<string>("");
   const [anoJurosInput, setAnoJurosInput] = useState(String(currentYear));

  const [loteamentoId, setLoteamentoId] = useState<string>("all");
  const [dataIni, setDataIni] = useState(defaultDataIni);
  const [dataFim, setDataFim] = useState(defaultDataFim);

  const [diasAtraso, setDiasAtraso] = useState("1");
  const [cliente, setCliente] = useState("");

  const [contaIdJuros, setContaIdJuros] = useState<string>("");
  const [anoJuros, setAnoJuros] = useState(String(currentYear));

  const [hasSearchedEntradas, setHasSearchedEntradas] = useState(false);
  const [hasSearchedAtraso, setHasSearchedAtraso] = useState(false);
  const [hasSearchedEnderecos, setHasSearchedEnderecos] = useState(false);
  const [hasSearchedTotalConta, setHasSearchedTotalConta] = useState(false);
  const [hasSearchedJuros, setHasSearchedJuros] = useState(false);

  const [pageEntradas, setPageEntradas] = useState(1);
  const [pageAtraso, setPageAtraso] = useState(1);
  const [pageEnderecos, setPageEnderecos] = useState(1);
  const [pageTotalConta, setPageTotalConta] = useState(1);

  const printRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPageEntradas(1);
    setPageAtraso(1);
    setPageEnderecos(1);
    setPageTotalConta(1);
  }, [ano, loteamentoId, dataIni, dataFim, diasAtraso, cliente, selectedReport]);

  const { data: loteamentosData = [] } = useQuery<Loteamento[]>({
    queryKey: ["loteamentos"],
    queryFn: async () => {
      const response = await fetch("/api/loteamentos", {
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar loteamentos");
      }

      return response.json();
    },
    enabled: selectedReport === "entradas",
  });

  const { data: contasData = [] } = useQuery<ContaRelatorio[]>({
    queryKey: ["contas"],
    queryFn: async () => {
      const response = await fetch("/api/contas", {
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar contas");
      }

      return response.json();
    },
    enabled: selectedReport === "juros" || selectedReport === "total-conta",
  });

  const { data: entradasData = [], isLoading: loadingEntradas } = useQuery<EntradasPorLoteamento[]>({
    queryKey: ["relatorios", "entradas-por-loteamento", loteamentoId, dataIni, dataFim],
    queryFn: async () => {
      const params = new URLSearchParams();
      const fromIso = toIsoFromBr(dataIni);
      const toIso = toIsoFromBr(dataFim);
      if (fromIso) params.set("from", fromIso);
      if (toIso) params.set("to", toIso);
      if (loteamentoId !== "all") {
        params.set("id_loteamento", loteamentoId);
      }
      const response = await fetch(`/api/relatorios/entradas-por-loteamento?${params.toString()}`, {
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar relatório de entradas por loteamento");
      }

      return response.json();
    },
    enabled: selectedReport === "entradas" && hasSearchedEntradas,
  });

  const { data: atrasadosData = [], isLoading: loadingAtrasados } = useQuery<TituloEmAtraso[]>({
    queryKey: ["relatorios", "titulos-em-atraso", dataIni, dataFim, loteamentoId, diasAtraso, cliente],
    queryFn: async () => {
      const params = new URLSearchParams();
      const fromIso = toIsoFromBr(dataIni);
      const toIso = toIsoFromBr(dataFim);
      if (fromIso) params.set("from", fromIso);
      if (toIso) params.set("to", toIso);
      if (diasAtraso.trim() !== "") params.set("dias_atraso", diasAtraso.trim());
      if (loteamentoId !== "all") params.set("id_loteamento", loteamentoId);
      if (cliente.trim() !== "") params.set("cliente", cliente.trim());

      const response = await fetch(`/api/relatorios/titulos-em-atraso?${params.toString()}`, {
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar relatório de títulos em atraso");
      }

      return response.json();
    },
    enabled: selectedReport === "atraso" && hasSearchedAtraso,
  });

  const { data: enderecosCarneData = [], isLoading: loadingEnderecosCarne } = useQuery<EnderecoCarne[]>({
    queryKey: ["relatorios", "enderecos-carne", loteamentoId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (loteamentoId !== "all") {
        params.set("id_loteamento", loteamentoId);
      }

      const response = await fetch(`/api/relatorios/enderecos-carne?${params.toString()}`, {
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar relatório de endereços para carnê");
      }

      return response.json();
    },
    enabled: selectedReport === "enderecos" && hasSearchedEnderecos,
  });

  const { data: totalContaData = [], isLoading: loadingTotalConta } = useQuery<TotalPorConta[]>({
    queryKey: ["relatorios", "entradas-por-conta", dataIni, dataFim],
    queryFn: async () => {
      const params = new URLSearchParams();
      const fromIso = toIsoFromBr(dataIni);
      const toIso = toIsoFromBr(dataFim);
      if (fromIso) params.set("from", fromIso);
      if (toIso) params.set("to", toIso);

      const response = await fetch(`/api/relatorios/entradas-por-conta?${params.toString()}`, {
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar relatório de entradas por conta");
      }

      return response.json();
    },
    enabled: selectedReport === "total-conta" && hasSearchedTotalConta,
  });

  const { data: jurosData, isLoading: loadingJuros } = useQuery<JurosRecebidos | null>({
    queryKey: ["relatorios", "juros-recebidos", contaIdJuros, anoJuros],
    queryFn: async () => {
      if (!contaIdJuros || !anoJuros) {
        return null;
      }

      const params = new URLSearchParams();
      params.set("id_conta", contaIdJuros);
      params.set("ano", anoJuros);

      const response = await fetch(`/api/relatorios/juros-recebidos?${params.toString()}`, {
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar relatório de juros recebidos");
      }

      return response.json();
    },
    enabled: selectedReport === "juros" && hasSearchedJuros && !!contaIdJuros && !!anoJuros,
  });

  const entradasPageSize = 20;
  const totalPagesEntradas = Math.max(1, Math.ceil(entradasData.length / entradasPageSize));
  const currentPageEntradas = Math.min(pageEntradas, totalPagesEntradas || 1);
  const entradasPage = entradasData.slice(
    (currentPageEntradas - 1) * entradasPageSize,
    currentPageEntradas * entradasPageSize,
  );

  const atrasoPageSize = 50;
  const totalPagesAtraso = Math.max(1, Math.ceil(atrasadosData.length / atrasoPageSize));
  const currentPageAtraso = Math.min(pageAtraso, totalPagesAtraso || 1);
  const atrasoPage = atrasadosData.slice(
    (currentPageAtraso - 1) * atrasoPageSize,
    currentPageAtraso * atrasoPageSize,
  );

  const enderecosPageSize = 30;
  const totalPagesEnderecos = Math.max(1, Math.ceil(enderecosCarneData.length / enderecosPageSize));
  const currentPageEnderecos = Math.min(pageEnderecos, totalPagesEnderecos || 1);
  const enderecosPage = enderecosCarneData.slice(
    (currentPageEnderecos - 1) * enderecosPageSize,
    currentPageEnderecos * enderecosPageSize,
  );

  const totalContaPageSize = 20;
  const totalPagesTotalConta = Math.max(
    1,
    Math.ceil(totalContaData.length / totalContaPageSize) || 1,
  );
  const currentPageTotalConta = Math.min(pageTotalConta, totalPagesTotalConta);
  const totalContaPage = totalContaData.slice(
    (currentPageTotalConta - 1) * totalContaPageSize,
    currentPageTotalConta * totalContaPageSize,
  );

  const canPrint =
    (selectedReport === "entradas" &&
      hasSearchedEntradas &&
      !loadingEntradas &&
      entradasData.length > 0) ||
    (selectedReport === "atraso" &&
      hasSearchedAtraso &&
      !loadingAtrasados &&
      atrasadosData.length > 0) ||
    (selectedReport === "enderecos" &&
      hasSearchedEnderecos &&
      !loadingEnderecosCarne &&
      enderecosCarneData.length > 0) ||
    (selectedReport === "total-conta" &&
      hasSearchedTotalConta &&
      !loadingTotalConta &&
      totalContaData.length > 0) ||
    (selectedReport === "juros" &&
      hasSearchedJuros &&
      !loadingJuros &&
      jurosData &&
      jurosData.meses.length > 0) ||
    selectedReport === "clientes-conta";

  const handlePrint = () => {
    if (!printRef.current) {
      return;
    }

    const content = printRef.current.innerHTML;
    const win = window.open("", "_blank", "width=1024,height=768");
    if (!win) {
      return;
    }

    win.document.open();
    win.document.write(`
      <html>
        <head>
          <title>Relatório</title>
          <meta charSet="utf-8" />
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              padding: 24px;
              color: #000;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th, td {
              padding: 4px 8px;
              font-size: 12px;
            }
            th {
              border-bottom: 1px solid #000;
              text-align: left;
            }
            .assinatura-cell {
              padding-top: 18px;
            }
            .assinatura-linha {
              border-top: 1px solid #000;
              width: 160px;
              margin-top: 8px;
            }
            h1, h2, h3 {
              margin: 0;
            }
            .text-center { text-align: center; }
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground mt-1">Geração de relatórios e consultas</p>
        </div>

        {!selectedReport ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {reportTypes.map((report, i) => (
              <button
                key={report.id}
                onClick={() => setSelectedReport(report.id)}
                className="glass-card rounded-lg p-5 text-left hover:border-primary/40 transition-all cursor-pointer animate-fade-in group"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-lg bg-muted text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <report.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{report.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{report.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => setSelectedReport(null)}>
                ← Voltar
              </Button>
              <div className="flex gap-2">
                {(selectedReport === "entradas" ||
                  selectedReport === "enderecos" ||
                  selectedReport === "atraso") && (
                  <Select value={loteamentoIdInput} onValueChange={setLoteamentoIdInput}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Selecione um loteamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os loteamentos</SelectItem>
                      {loteamentosData.map((lot) => (
                        <SelectItem key={lot.id_loteamento} value={String(lot.id_loteamento)}>
                          {lot.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {selectedReport === "juros" && (
                  <Select value={contaIdJurosInput} onValueChange={setContaIdJurosInput}>
                    <SelectTrigger className="w-[260px]">
                      <SelectValue placeholder="Selecione uma conta" />
                    </SelectTrigger>
                    <SelectContent>
                      {contasData.map((conta) => (
                        <SelectItem key={conta.id_conta} value={String(conta.id_conta)}>
                          {conta.titular} ({conta.conta})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {selectedReport !== "juros" && (
                  <div className="flex items-center gap-2">
                    <Input
                      className="w-[120px]"
                      value={dataIniInput}
                      onChange={(e) => setDataIniInput(e.target.value)}
                      placeholder="Data inicial"
                    />
                    <span className="text-xs text-muted-foreground">até</span>
                    <Input
                      className="w-[120px]"
                      value={dataFimInput}
                      onChange={(e) => setDataFimInput(e.target.value)}
                      placeholder="Data final"
                    />
                  </div>
                )}
                {selectedReport === "juros" && (
                  <Input
                    className="w-[90px]"
                    value={anoJurosInput}
                    onChange={(e) => setAnoJurosInput(e.target.value)}
                    placeholder="Ano"
                  />
                )}
                {selectedReport === "atraso" && (
                  <>
                    <Input
                      className="w-[90px]"
                      type="number"
                      min={0}
                      value={diasAtrasoInput}
                      onChange={(e) => setDiasAtrasoInput(e.target.value)}
                      placeholder="Dias atraso"
                    />
                    <Input
                      className="w-[200px]"
                      value={clienteInput}
                      onChange={(e) => setClienteInput(e.target.value)}
                      placeholder="Cliente"
                    />
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    setLoteamentoId(loteamentoIdInput);
                    setDataIni(dataIniInput);
                    setDataFim(dataFimInput);
                    setDiasAtraso(diasAtrasoInput);
                    setCliente(clienteInput);
                    if (selectedReport === "entradas") {
                      setHasSearchedEntradas(true);
                      setPageEntradas(1);
                    }
                    if (selectedReport === "atraso") {
                      setHasSearchedAtraso(true);
                      setPageAtraso(1);
                    }
                    if (selectedReport === "enderecos") {
                      setHasSearchedEnderecos(true);
                      setPageEnderecos(1);
                    }
                    if (selectedReport === "total-conta") {
                      setHasSearchedTotalConta(true);
                      setPageTotalConta(1);
                    }
                    if (selectedReport === "juros") {
                      setContaIdJuros(contaIdJurosInput);
                      setAnoJuros(anoJurosInput);
                      setHasSearchedJuros(true);
                    }
                  }}
                >
                  Buscar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handlePrint}
                  disabled={!canPrint}
                >
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Exportar
                </Button>
              </div>
            </div>

            <div ref={printRef} className="space-y-4">
              {selectedReport === "entradas" && (
                <div className="glass-card rounded-lg overflow-hidden">
                  <div className="p-5 border-b border-border">
                    <h2 className="font-semibold">Entradas por Loteamento – {ano}</h2>
                  </div>
                  {loadingEntradas ? (
                    <div className="p-5 text-sm text-muted-foreground">Carregando dados...</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/50">
                            <th className="text-left px-5 py-3 font-medium text-muted-foreground">Loteamento</th>
                            <th className="text-right px-5 py-3 font-medium text-muted-foreground">Jan</th>
                            <th className="text-right px-5 py-3 font-medium text-muted-foreground">Fev</th>
                            <th className="text-right px-5 py-3 font-medium text-muted-foreground">Mar</th>
                            <th className="text-right px-5 py-3 font-medium text-muted-foreground">Abr</th>
                            <th className="text-right px-5 py-3 font-medium text-muted-foreground">Mai</th>
                            <th className="text-right px-5 py-3 font-medium text-muted-foreground">Jun</th>
                            <th className="text-right px-5 py-3 font-medium text-muted-foreground">Jul</th>
                            <th className="text-right px-5 py-3 font-medium text-muted-foreground">Ago</th>
                            <th className="text-right px-5 py-3 font-medium text-muted-foreground">Set</th>
                            <th className="text-right px-5 py-3 font-medium text-muted-foreground">Out</th>
                            <th className="text-right px-5 py-3 font-medium text-muted-foreground">Nov</th>
                            <th className="text-right px-5 py-3 font-medium text-muted-foreground">Dez</th>
                            <th className="text-right px-5 py-3 font-medium text-muted-foreground font-bold">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {entradasPage.map((row) => (
                            <tr key={row.loteamento} className="hover:bg-muted/30 transition-colors">
                              <td className="px-5 py-3 font-medium">{row.loteamento}</td>
                              <td className="px-5 py-3 text-right text-muted-foreground">
                                {formatCurrency(row.jan)}
                              </td>
                              <td className="px-5 py-3 text-right text-muted-foreground">
                                {formatCurrency(row.fev)}
                              </td>
                              <td className="px-5 py-3 text-right text-muted-foreground">
                                {formatCurrency(row.mar)}
                              </td>
                              <td className="px-5 py-3 text-right text-muted-foreground">
                                {formatCurrency(row.abr)}
                              </td>
                              <td className="px-5 py-3 text-right text-muted-foreground">
                                {formatCurrency(row.mai)}
                              </td>
                              <td className="px-5 py-3 text-right text-muted-foreground">
                                {formatCurrency(row.jun)}
                              </td>
                              <td className="px-5 py-3 text-right text-muted-foreground">
                                {formatCurrency(row.jul)}
                              </td>
                              <td className="px-5 py-3 text-right text-muted-foreground">
                                {formatCurrency(row.ago)}
                              </td>
                              <td className="px-5 py-3 text-right text-muted-foreground">
                                {formatCurrency(row.set)}
                              </td>
                              <td className="px-5 py-3 text-right text-muted-foreground">
                                {formatCurrency(row.out)}
                              </td>
                              <td className="px-5 py-3 text-right text-muted-foreground">
                                {formatCurrency(row.nov)}
                              </td>
                              <td className="px-5 py-3 text-right text-muted-foreground">
                                {formatCurrency(row.dez)}
                              </td>
                              <td className="px-5 py-3 text-right font-bold">{formatCurrency(row.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-border bg-muted/30">
                            <td className="px-5 py-3 font-bold">Total Geral</td>
                            <td className="px-5 py-3 text-right font-bold">
                              {formatCurrency(entradasData.reduce((s, r) => s + r.jan, 0))}
                            </td>
                            <td className="px-5 py-3 text-right font-bold">
                              {formatCurrency(entradasData.reduce((s, r) => s + r.fev, 0))}
                            </td>
                            <td className="px-5 py-3 text-right font-bold">
                              {formatCurrency(entradasData.reduce((s, r) => s + r.mar, 0))}
                            </td>
                            <td className="px-5 py-3 text-right font-bold">
                              {formatCurrency(entradasData.reduce((s, r) => s + r.abr, 0))}
                            </td>
                            <td className="px-5 py-3 text-right font-bold">
                              {formatCurrency(entradasData.reduce((s, r) => s + r.mai, 0))}
                            </td>
                            <td className="px-5 py-3 text-right font-bold">
                              {formatCurrency(entradasData.reduce((s, r) => s + r.jun, 0))}
                            </td>
                            <td className="px-5 py-3 text-right font-bold">
                              {formatCurrency(entradasData.reduce((s, r) => s + r.jul, 0))}
                            </td>
                            <td className="px-5 py-3 text-right font-bold">
                              {formatCurrency(entradasData.reduce((s, r) => s + r.ago, 0))}
                            </td>
                            <td className="px-5 py-3 text-right font-bold">
                              {formatCurrency(entradasData.reduce((s, r) => s + r.set, 0))}
                            </td>
                            <td className="px-5 py-3 text-right font-bold">
                              {formatCurrency(entradasData.reduce((s, r) => s + r.out, 0))}
                            </td>
                            <td className="px-5 py-3 text-right font-bold">
                              {formatCurrency(entradasData.reduce((s, r) => s + r.nov, 0))}
                            </td>
                            <td className="px-5 py-3 text-right font-bold">
                              {formatCurrency(entradasData.reduce((s, r) => s + r.dez, 0))}
                            </td>
                            <td className="px-5 py-3 text-right font-bold text-primary">
                              {formatCurrency(entradasData.reduce((s, r) => s + r.total, 0))}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                  {entradasData.length > 0 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground">
                      <span>
                        Página {currentPageEntradas} de {totalPagesEntradas}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPageEntradas <= 1}
                          onClick={() => setPageEntradas(currentPageEntradas - 1)}
                        >
                          Anterior
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPageEntradas >= totalPagesEntradas}
                          onClick={() => setPageEntradas(currentPageEntradas + 1)}
                        >
                          Próxima
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

            {selectedReport === "atraso" && (
              <div className="glass-card rounded-lg overflow-hidden">
                <div className="p-5 border-b border-border">
                  <h2 className="font-semibold">Títulos em Atraso</h2>
                  <p className="text-xs text-muted-foreground mt-1">Multa: 2% + Juros: 0,20% ao dia</p>
                </div>
                {loadingAtrasados ? (
                  <div className="p-5 text-sm text-muted-foreground">Carregando dados...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="text-left px-5 py-3 font-medium text-muted-foreground">Cliente</th>
                          <th className="text-left px-5 py-3 font-medium text-muted-foreground">Lote</th>
                          <th className="text-left px-5 py-3 font-medium text-muted-foreground">Parcela</th>
                          <th className="text-left px-5 py-3 font-medium text-muted-foreground">Vencimento</th>
                          <th className="text-right px-5 py-3 font-medium text-muted-foreground">Valor</th>
                          <th className="text-right px-5 py-3 font-medium text-muted-foreground">Dias</th>
                          <th className="text-right px-5 py-3 font-medium text-muted-foreground">Multa</th>
                          <th className="text-right px-5 py-3 font-medium text-muted-foreground">Juros</th>
                          <th className="text-right px-5 py-3 font-medium text-muted-foreground">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {atrasoPage.map((row) => (
                          <tr key={row.id_pagamento} className="hover:bg-muted/30 transition-colors">
                            <td className="px-5 py-3 font-medium">{row.cliente}</td>
                            <td className="px-5 py-3 text-muted-foreground">{row.lote}</td>
                            <td className="px-5 py-3 text-muted-foreground">{row.parcela}</td>
                            <td className="px-5 py-3 text-muted-foreground">{row.vencimento}</td>
                            <td className="px-5 py-3 text-right text-muted-foreground">{formatCurrency(row.valor)}</td>
                            <td className="px-5 py-3 text-right text-destructive font-medium">{row.diasAtraso}</td>
                            <td className="px-5 py-3 text-right text-muted-foreground">{formatCurrency(row.multa)}</td>
                            <td className="px-5 py-3 text-right text-muted-foreground">{formatCurrency(row.juros)}</td>
                            <td className="px-5 py-3 text-right font-bold text-warning">{formatCurrency(row.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {atrasadosData.length > 0 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground">
                    <span>
                      Página {currentPageAtraso} de {totalPagesAtraso}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPageAtraso <= 1}
                        onClick={() => setPageAtraso(currentPageAtraso - 1)}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPageAtraso >= totalPagesAtraso}
                        onClick={() => setPageAtraso(currentPageAtraso + 1)}
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedReport === "total-conta" && (
              <div className="glass-card rounded-lg overflow-hidden">
                <div className="p-5 border-b border-border">
                  <h2 className="font-semibold">Total de Entradas por Conta</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Totais recebidos por conta bancária no período selecionado
                  </p>
                </div>
                {loadingTotalConta ? (
                  <div className="p-5 text-sm text-muted-foreground">Carregando dados...</div>
                ) : totalContaData.length === 0 ? (
                  <div className="p-5 text-sm text-muted-foreground">
                    Nenhum registro encontrado para os filtros selecionados
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/50">
                            <th className="text-left px-5 py-3 font-medium text-muted-foreground">Conta</th>
                            <th className="text-left px-5 py-3 font-medium text-muted-foreground">Apelido</th>
                            <th className="text-left px-5 py-3 font-medium text-muted-foreground">Agência</th>
                            <th className="text-right px-5 py-3 font-medium text-muted-foreground">Pagamentos</th>
                            <th className="text-right px-5 py-3 font-medium text-muted-foreground">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {totalContaPage.map((row) => (
                            <tr key={row.id_conta} className="hover:bg-muted/30 transition-colors">
                              <td className="px-5 py-3 font-medium">
                                {row.titular} ({row.conta})
                              </td>
                              <td className="px-5 py-3 text-muted-foreground">{row.apelido}</td>
                              <td className="px-5 py-3 text-muted-foreground">{row.agencia}</td>
                              <td className="px-5 py-3 text-right text-muted-foreground">{row.qtdPagamentos}</td>
                              <td className="px-5 py-3 text-right font-bold">{formatCurrency(row.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground">
                      <span>
                        Página {currentPageTotalConta} de {totalPagesTotalConta}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPageTotalConta <= 1}
                          onClick={() => setPageTotalConta(currentPageTotalConta - 1)}
                        >
                          Anterior
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPageTotalConta >= totalPagesTotalConta}
                          onClick={() => setPageTotalConta(currentPageTotalConta + 1)}
                        >
                          Próxima
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {selectedReport === "juros" && jurosData && (
              <div className="glass-card rounded-lg overflow-hidden">
                <div className="p-5 border-b border-border">
                  <h2 className="font-semibold text-center">Relatório de Juros Recebidos (Pag. Atrasados)</h2>
                  <p className="text-xs text-muted-foreground mt-1 text-center">
                    {jurosData.titular && jurosData.conta
                      ? `Titular: ${jurosData.titular} – Agência: ${jurosData.agencia} Conta: ${jurosData.conta}`
                      : "Nenhuma informação de conta disponível"}
                  </p>
                </div>
                {loadingJuros ? (
                  <div className="p-5 text-sm text-muted-foreground">Carregando dados...</div>
                ) : jurosData.meses.length === 0 ? (
                  <div className="p-5 text-sm text-muted-foreground">
                    Nenhum registro encontrado para os filtros selecionados
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="text-left px-5 py-3 font-medium text-muted-foreground">Mês</th>
                          <th className="text-right px-5 py-3 font-medium text-muted-foreground">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {jurosData.meses
                          .slice()
                          .sort((a, b) => a.mes - b.mes)
                          .map((mes) => (
                            <tr key={mes.mes} className="hover:bg-muted/30 transition-colors">
                              <td className="px-5 py-3 text-muted-foreground">
                                {monthNames[mes.mes]} de {anoJuros}
                              </td>
                              <td className="px-5 py-3 text-right font-medium">
                                {formatCurrency(mes.total)}
                              </td>
                            </tr>
                          ))}
                        <tr className="border-t-2 border-border bg-muted/30">
                          <td className="px-5 py-3 font-bold">Total</td>
                          <td className="px-5 py-3 text-right font-bold text-primary">
                            {formatCurrency(jurosData.totalGeral)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {selectedReport === "enderecos" && (
              <div className="glass-card rounded-lg overflow-hidden">
                <div className="p-5 border-b border-border">
                  <h2 className="font-semibold text-center">
                    Relação de clientes por loteamento – Entrega de carnês
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    {loteamentoId !== "all"
                      ? `Loteamento: ${
                          loteamentosData.find((l) => String(l.id_loteamento) === loteamentoId)?.nome ??
                          "selecionado"
                        }`
                      : "Todos os loteamentos com clientes com venda"}
                  </p>
                </div>
                {loadingEnderecosCarne ? (
                  <div className="p-5 text-sm text-muted-foreground">Carregando dados...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="text-left px-5 py-3 font-medium text-muted-foreground">Cliente</th>
                          <th className="text-left px-5 py-3 font-medium text-muted-foreground">Telefone</th>
                          <th className="text-left px-5 py-3 font-medium text-muted-foreground">Endereço</th>
                          <th className="text-left px-5 py-3 font-medium text-muted-foreground">Bairro</th>
                          <th className="text-left px-5 py-3 font-medium text-muted-foreground">Cidade/UF</th>
                          <th className="text-left px-5 py-3 font-medium text-muted-foreground">CEP</th>
                          <th className="text-left px-5 py-3 font-medium text-muted-foreground">Lote/Quadra</th>
                          <th className="text-left px-5 py-3 font-medium text-muted-foreground">Assinatura</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {enderecosPage.map((row) => (
                          <tr
                            key={`${row.id_cliente}-${row.lote}-${row.quadra}`}
                            className="hover:bg-muted/30 transition-colors"
                          >
                            <td className="px-5 py-3 font-medium">{row.nome}</td>
                            <td className="px-5 py-3 text-muted-foreground">
                              {row.telefone || "-"}
                            </td>
                            <td className="px-5 py-3 text-muted-foreground">
                              {row.endereco}
                              {row.complemento ? `, ${row.complemento}` : ""}
                            </td>
                            <td className="px-5 py-3 text-muted-foreground">{row.bairro}</td>
                            <td className="px-5 py-3 text-muted-foreground">
                              {row.cidade}
                              {row.estado ? `/${row.estado}` : ""}
                            </td>
                            <td className="px-5 py-3 text-muted-foreground">{row.cep}</td>
                            <td className="px-5 py-3 text-muted-foreground">
                              Lote: {row.lote || "-"} Quadra: {row.quadra || "-"}
                            </td>
                            <td className="px-5 py-3 text-muted-foreground assinatura-cell">
                              <div className="assinatura-linha" />
                            </td>
                          </tr>
                        ))}
                        {enderecosCarneData.length === 0 && (
                          <tr>
                            <td
                              colSpan={7}
                              className="px-5 py-6 text-center text-sm text-muted-foreground"
                            >
                              Nenhum cliente encontrado para os filtros selecionados
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
                {enderecosCarneData.length > 0 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground">
                    <span>
                      Página {currentPageEnderecos} de {totalPagesEnderecos}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPageEnderecos <= 1}
                        onClick={() => setPageEnderecos(currentPageEnderecos - 1)}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPageEnderecos >= totalPagesEnderecos}
                        onClick={() => setPageEnderecos(currentPageEnderecos + 1)}
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedReport === "clientes-conta" && (
              <div className="glass-card rounded-lg p-8 text-center">
                <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium">Relatório: {reportTypes.find(r => r.id === selectedReport)?.title}</p>
                <p className="text-xs text-muted-foreground mt-1">Dados serão carregados do banco de dados quando o backend estiver conectado</p>
              </div>
            )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Relatorios;
