import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, Eye, Edit, Trash2 } from "lucide-react";

const mockLoteamentos = [
  { id: 1, nome: "Residencial Primavera" },
  { id: 2, nome: "Jardim das Flores" },
  { id: 3, nome: "Vila Verde" },
  { id: 4, nome: "Parque do Sol" },
];

const mockLotes = [
  { id: 1, id_loteamento: 1, loteamento: "Residencial Primavera", lote: "01", quadra: "A", area: "250m²", frente: "10m", fundo: "10m", esquerdo: "25m", direito: "25m", status: "disponivel" as const },
  { id: 2, id_loteamento: 1, loteamento: "Residencial Primavera", lote: "02", quadra: "A", area: "300m²", frente: "12m", fundo: "12m", esquerdo: "25m", direito: "25m", status: "vendido" as const },
  { id: 3, id_loteamento: 1, loteamento: "Residencial Primavera", lote: "03", quadra: "A", area: "275m²", frente: "11m", fundo: "11m", esquerdo: "25m", direito: "25m", status: "disponivel" as const },
  { id: 4, id_loteamento: 2, loteamento: "Jardim das Flores", lote: "01", quadra: "B", area: "200m²", frente: "10m", fundo: "10m", esquerdo: "20m", direito: "20m", status: "vendido" as const },
  { id: 5, id_loteamento: 2, loteamento: "Jardim das Flores", lote: "02", quadra: "B", area: "220m²", frente: "10m", fundo: "10m", esquerdo: "22m", direito: "22m", status: "disponivel" as const },
  { id: 6, id_loteamento: 3, loteamento: "Vila Verde", lote: "01", quadra: "C", area: "350m²", frente: "14m", fundo: "14m", esquerdo: "25m", direito: "25m", status: "vendido" as const },
  { id: 7, id_loteamento: 3, loteamento: "Vila Verde", lote: "02", quadra: "C", area: "320m²", frente: "13m", fundo: "13m", esquerdo: "24.6m", direito: "24.6m", status: "disponivel" as const },
  { id: 8, id_loteamento: 4, loteamento: "Parque do Sol", lote: "01", quadra: "D", area: "400m²", frente: "16m", fundo: "16m", esquerdo: "25m", direito: "25m", status: "vendido" as const },
  { id: 9, id_loteamento: 4, loteamento: "Parque do Sol", lote: "02", quadra: "D", area: "380m²", frente: "15m", fundo: "15m", esquerdo: "25.3m", direito: "25.3m", status: "disponivel" as const },
  { id: 10, id_loteamento: 4, loteamento: "Parque do Sol", lote: "03", quadra: "D", area: "360m²", frente: "14m", fundo: "14m", esquerdo: "25.7m", direito: "25.7m", status: "disponivel" as const },
];

const Lotes = () => {
  const [search, setSearch] = useState("");
  const [filterLoteamento, setFilterLoteamento] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "disponivel" | "vendido">("all");

  const filtered = mockLotes.filter((l) => {
    const matchSearch =
      l.lote.includes(search) ||
      l.quadra.toLowerCase().includes(search.toLowerCase()) ||
      l.loteamento.toLowerCase().includes(search.toLowerCase());
    const matchLot = filterLoteamento === "all" || l.id_loteamento === Number(filterLoteamento);
    const matchStatus = filterStatus === "all" || l.status === filterStatus;
    return matchSearch && matchLot && matchStatus;
  });

  const totalDisponivel = mockLotes.filter((l) => l.status === "disponivel").length;
  const totalVendido = mockLotes.filter((l) => l.status === "vendido").length;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Lotes</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mockLotes.length} lotes · {totalDisponivel} disponíveis · {totalVendido} vendidos
            </p>
          </div>
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Lote
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por lote ou quadra..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterLoteamento} onValueChange={setFilterLoteamento}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Loteamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os loteamentos</SelectItem>
              {mockLoteamentos.map((l) => (
                <SelectItem key={l.id} value={String(l.id)}>
                  {l.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            {(["all", "disponivel", "vendido"] as const).map((s) => (
              <Button
                key={s}
                variant={filterStatus === s ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus(s)}
              >
                {s === "all" ? "Todos" : s === "disponivel" ? "Disponível" : "Vendido"}
              </Button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="glass-card rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Loteamento</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Quadra</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Lote</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Área</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Frente</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Fundo</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-5 py-3 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((lote) => (
                  <tr key={lote.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium">{lote.loteamento}</td>
                    <td className="px-5 py-3 text-muted-foreground">{lote.quadra}</td>
                    <td className="px-5 py-3 text-muted-foreground">{lote.lote}</td>
                    <td className="px-5 py-3 text-muted-foreground">{lote.area}</td>
                    <td className="px-5 py-3 text-muted-foreground">{lote.frente}</td>
                    <td className="px-5 py-3 text-muted-foreground">{lote.fundo}</td>
                    <td className="px-5 py-3">
                      <Badge
                        variant={lote.status === "disponivel" ? "default" : "secondary"}
                        className={lote.status === "disponivel" ? "" : ""}
                      >
                        {lote.status === "disponivel" ? "Disponível" : "Vendido"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Nenhum lote encontrado
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Lotes;
