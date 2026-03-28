import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface RegistroAuditoria {
  id_auditoria: number;
  usuario: string;
  tabela: string;
  id_registro?: number;
  acao: "CREATE" | "UPDATE" | "DELETE";
  descricao?: string;
  ip_address?: string;
  data_hora: string;
  valores_novos?: Record<string, any>;
}

function getAuthHeaders() {
  const token = window.localStorage.getItem("token");
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

const Auditoria = () => {
  const [search, setSearch] = useState("");
  const [filterTabela, setFilterTabela] = useState("all");
  const [filterAcao, setFilterAcao] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data: auditoriaData, isLoading } = useQuery({
    queryKey: ["auditoria", page, filterTabela, filterAcao],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String((page - 1) * pageSize),
      });

      if (filterTabela !== "all") params.append("tabela", filterTabela);
      if (filterAcao !== "all") params.append("acao", filterAcao);

      const r = await fetch(`/api/auditoria?${params}`, { headers: { ...getAuthHeaders() } });
      if (!r.ok) throw new Error("Erro ao carregar auditoria");
      return r.json() as Promise<{ dados: RegistroAuditoria[]; total: number }>;
    },
  });

  const totalPages = Math.ceil((auditoriaData?.total ?? 0) / pageSize);

  const acaoConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
    CREATE: { label: "Criar", variant: "secondary" },
    UPDATE: { label: "Atualizar", variant: "default" },
    DELETE: { label: "Deletar", variant: "destructive" },
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Auditoria</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoading ? "Carregando..." : `Total de ${auditoriaData?.total ?? 0} registros`}
          </p>
        </div>

        {/* Filtros */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <select
            value={filterTabela}
            onChange={(e) => { setFilterTabela(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-background"
          >
            <option value="all">Todas as tabelas</option>
            <option value="vendas">Vendas</option>
            <option value="pagamentos">Pagamentos</option>
            <option value="clientes">Clientes</option>
            <option value="lotes">Lotes</option>
          </select>

          <select
            value={filterAcao}
            onChange={(e) => { setFilterAcao(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-background"
          >
            <option value="all">Todas as ações</option>
            <option value="CREATE">Criar</option>
            <option value="UPDATE">Atualizar</option>
            <option value="DELETE">Deletar</option>
          </select>
        </div>

        {/* Tabela */}
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-xs text-muted-foreground">Usuário</th>
                <th className="px-4 py-3 text-left font-medium text-xs text-muted-foreground">Tabela</th>
                <th className="px-4 py-3 text-left font-medium text-xs text-muted-foreground">Ação</th>
                <th className="px-4 py-3 text-left font-medium text-xs text-muted-foreground">Descrição</th>
                <th className="px-4 py-3 text-left font-medium text-xs text-muted-foreground">Data/Hora</th>
                <th className="px-4 py-3 text-left font-medium text-xs text-muted-foreground">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              ) : (auditoriaData?.dados?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum registro encontrado
                  </td>
                </tr>
              ) : (
                auditoriaData?.dados?.map((registro) => (
                  <tr key={registro.id_auditoria} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{registro.usuario}</td>
                    <td className="px-4 py-3 text-muted-foreground">{registro.tabela}</td>
                    <td className="px-4 py-3">
                      <Badge variant={acaoConfig[registro.acao]?.variant || "default"}>
                        {acaoConfig[registro.acao]?.label || registro.acao}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{registro.descricao}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(registro.data_hora).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{registro.ip_address}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Auditoria;
