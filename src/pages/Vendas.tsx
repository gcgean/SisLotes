import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Plus, Eye, Edit, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type VendaStatus = "aberta" | "quitada" | "cancelada";

interface VendaListItem {
  id_venda: number;
  cliente: string;
  lote: string;
  loteamento: string;
  data_venda: string;
  valor_entrada: number;
  parcelas: number;
  porcentagem: number;
  status: VendaStatus;
  valor_total: number;
}

const statusConfig: Record<VendaStatus, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  aberta: { label: "Aberta", variant: "default" },
  quitada: { label: "Quitada", variant: "secondary" },
  cancelada: { label: "Cancelada", variant: "destructive" },
};

function getAuthHeaders() {
  const token = window.localStorage.getItem("token");
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatDate = (dateStr: string) => {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR");
  } catch {
    return dateStr;
  }
};

const Vendas = () => {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | VendaStatus>("all");
  const [vendaSelecionada, setVendaSelecionada] = useState<VendaListItem | null>(null);
  const [dialogVisualizarAberto, setDialogVisualizarAberto] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState<VendaListItem | null>(null);
  const queryClient = useQueryClient();

  const { data: vendas = [], isLoading, isError } = useQuery<VendaListItem[]>({
    queryKey: ["vendas"],
    queryFn: async () => {
      const response = await fetch("/api/vendas", {
        headers: { ...getAuthHeaders() },
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar vendas");
      }

      const data = (await response.json()) as VendaListItem[];

      return data.map((venda) => ({
        ...venda,
        status: venda.status as VendaStatus,
        valor_total: Number(venda.valor_total ?? 0),
        valor_entrada: Number(venda.valor_entrada ?? 0),
      }));
    },
  });

  const excluirVendaMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/vendas/${id}`, {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
      });

      if (!response.ok) {
        let data: unknown;
        try { data = await response.json(); } catch { data = null; }
        const msg =
          typeof data === "object" && data !== null && "error" in data &&
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Erro ao excluir venda";
        throw new Error(msg);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      setConfirmarExclusao(null);
      toast({ title: "Venda excluída com sucesso" });
    },
    onError: (error) => {
      setConfirmarExclusao(null);
      toast({
        title: "Erro ao excluir venda",
        description: error instanceof Error ? error.message : "Erro ao excluir venda",
        variant: "destructive",
      });
    },
  });

  const filtered = vendas.filter((v) => {
    const matchSearch =
      v.cliente.toLowerCase().includes(search.toLowerCase()) ||
      v.lote.toLowerCase().includes(search.toLowerCase()) ||
      v.loteamento.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || v.status === filterStatus;
    return matchSearch && matchStatus;
  });

  function abrirVisualizar(venda: VendaListItem) {
    setVendaSelecionada(venda);
    setDialogVisualizarAberto(true);
  }

  function handleNovaVenda() {
    toast({
      title: "Funcionalidade em desenvolvimento",
      description: "O cadastro de novas vendas estará disponível em breve.",
    });
  }

  function handleEditar(venda: VendaListItem) {
    toast({
      title: "Funcionalidade em desenvolvimento",
      description: `Edição da venda #${venda.id_venda} estará disponível em breve.`,
    });
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Vendas</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isLoading ? "Carregando vendas..." : `${vendas.length} vendas registradas`}
            </p>
          </div>
          <Button size="sm" className="gap-2" onClick={handleNovaVenda}>
            <Plus className="h-4 w-4" />
            Nova Venda
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex flex-col md:flex-row md:flex-wrap gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, lote ou loteamento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "aberta", "quitada", "cancelada"] as const).map((s) => (
              <Button
                key={s}
                variant={filterStatus === s ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus(s)}
              >
                {s === "all" ? "Todas" : statusConfig[s].label}
              </Button>
            ))}
          </div>
        </div>

        {/* Tabela */}
        <div className="glass-card rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Cliente</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Lote</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Data</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Valor Total</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Entrada</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Parcelas</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Juros</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-5 py-3 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((venda) => (
                  <tr key={venda.id_venda} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium">{venda.cliente}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      <div>
                        <span>{venda.lote}</span>
                        <p className="text-xs text-muted-foreground/70">{venda.loteamento}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{formatDate(venda.data_venda)}</td>
                    <td className="px-5 py-3 font-medium">{formatCurrency(venda.valor_total)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{formatCurrency(venda.valor_entrada)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{venda.parcelas}x</td>
                    <td className="px-5 py-3 text-muted-foreground">{venda.porcentagem}%</td>
                    <td className="px-5 py-3">
                      <Badge variant={statusConfig[venda.status].variant}>
                        {statusConfig[venda.status].label}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Visualizar"
                          onClick={() => abrirVisualizar(venda)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Editar"
                          disabled={venda.status !== "aberta"}
                          onClick={() => handleEditar(venda)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title="Excluir"
                          disabled={venda.status === "quitada"}
                          onClick={() => setConfirmarExclusao(venda)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!isLoading && !isError && filtered.length === 0 && (
            <div className="p-12 text-center text-sm text-muted-foreground">Nenhuma venda encontrada</div>
          )}
          {isError && (
            <div className="p-12 text-center text-sm text-destructive">Erro ao carregar vendas</div>
          )}
        </div>
      </div>

      {/* Dialog de visualização de venda */}
      <Dialog open={dialogVisualizarAberto} onOpenChange={setDialogVisualizarAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes da Venda #{vendaSelecionada?.id_venda}</DialogTitle>
          </DialogHeader>

          {vendaSelecionada && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Cliente</p>
                  <p className="font-medium">{vendaSelecionada.cliente}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Status</p>
                  <Badge variant={statusConfig[vendaSelecionada.status].variant}>
                    {statusConfig[vendaSelecionada.status].label}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Lote</p>
                  <p className="font-medium">{vendaSelecionada.lote}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Loteamento</p>
                  <p className="font-medium">{vendaSelecionada.loteamento}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Data da Venda</p>
                  <p className="font-medium">{formatDate(vendaSelecionada.data_venda)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Valor Total</p>
                  <p className="font-semibold text-primary">{formatCurrency(vendaSelecionada.valor_total)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Entrada</p>
                  <p className="font-medium">{formatCurrency(vendaSelecionada.valor_entrada)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Parcelas</p>
                  <p className="font-medium">{vendaSelecionada.parcelas}x</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Taxa de Juros</p>
                  <p className="font-medium">{vendaSelecionada.porcentagem}% a.m.</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogVisualizarAberto(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog de confirmação de exclusão */}
      <AlertDialog open={!!confirmarExclusao} onOpenChange={(open) => { if (!open) setConfirmarExclusao(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente excluir a venda do cliente{" "}
              <span className="font-semibold">{confirmarExclusao?.cliente}</span>
              ? Todos os títulos associados também serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => {
                if (confirmarExclusao) {
                  excluirVendaMutation.mutate(confirmarExclusao.id_venda);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Vendas;
