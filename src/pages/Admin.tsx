import { FormEvent, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Users,
  CheckCircle,
  XCircle,
  ShieldAlert,
} from "lucide-react";
import { formatCpfCnpj } from "@/lib/cpfCnpj";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Navigate } from "react-router-dom";

interface Empresa {
  id_empresa: number;
  nome_fantasia: string;
  razao_social?: string | null;
  cnpj?: string | null;
  ie?: string | null;
  endereco?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  telefone?: string | null;
  email?: string | null;
  site?: string | null;
  ativo: boolean;
  plano?: string | null;
  data_vencimento?: string | null;
  ultimo_acesso?: string | null;
  observacoes?: string | null;
  hub_customer_id?: string | null;
  hub_product_code?: string | null;
  hub_license_status?: string | null;
  hub_license_reason?: string | null;
  hub_expires_at?: string | null;
  total_usuarios?: number;
  created_at: string;
}

interface Stats {
  totalEmpresas: number;
  ativas: number;
  inativas: number;
  totalUsuarios: number;
}

const PLANOS = ["básico", "profissional", "enterprise", "personalizado"];

function fmt(date?: string | null) {
  if (!date) return "—";
  try {
    return format(parseISO(date), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return date;
  }
}

function fmtDate(date?: string | null) {
  if (!date) return "—";
  try {
    return format(parseISO(date), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return date;
  }
}

const emptyForm = {
  nome_fantasia: "",
  razao_social: "",
  cnpj: "",
  ie: "",
  endereco: "",
  bairro: "",
  cidade: "",
  estado: "",
  cep: "",
  telefone: "",
  email: "",
  site: "",
  ativo: true,
  plano: "",
  data_vencimento: "",
  observacoes: "",
  hub_customer_id: "",
  hub_product_code: "",
  hub_license_status: "",
  hub_license_reason: "",
  hub_expires_at: "",
};

export default function Admin() {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const isPlatformAdmin = user?.login?.toLowerCase() === "gcgean";

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const { data: stats } = useQuery<Stats>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const r = await fetch("/api/admin/stats", { headers });
      if (!r.ok) throw new Error("Erro ao buscar stats");
      return r.json();
    },
  });

  const { data: empresas = [], isLoading } = useQuery<Empresa[]>({
    queryKey: ["admin-empresas"],
    queryFn: async () => {
      const r = await fetch("/api/admin/empresas", { headers });
      if (!r.ok) throw new Error("Erro ao buscar empresas");
      return r.json();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/admin/empresas/${id}/toggle-ativo`, {
        method: "PATCH",
        headers,
      });
      if (!r.ok) throw new Error("Erro ao alterar status");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-empresas"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      toast({ title: "Status atualizado com sucesso" });
    },
    onError: () => toast({ title: "Erro ao alterar status", variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof emptyForm & { id?: number }) => {
      const { id, ...body } = data;
      const url = id ? `/api/admin/empresas/${id}` : "/api/admin/empresas";
      const method = id ? "PUT" : "POST";
      const r = await fetch(url, { method, headers, body: JSON.stringify(body) });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao salvar empresa");
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-empresas"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      setDialogOpen(false);
      toast({ title: editingEmpresa ? "Empresa atualizada" : "Empresa criada com sucesso" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/admin/empresas/${id}`, { method: "DELETE", headers });
      if (!r.ok) throw new Error("Erro ao excluir empresa");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-empresas"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      setDeleteDialogOpen(false);
      toast({ title: "Empresa excluída" });
    },
    onError: () => toast({ title: "Erro ao excluir empresa", variant: "destructive" }),
  });

  function openNew() {
    setEditingEmpresa(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(e: Empresa) {
    setEditingEmpresa(e);
    setForm({
      nome_fantasia: e.nome_fantasia ?? "",
      razao_social: e.razao_social ?? "",
      cnpj: e.cnpj ?? "",
      ie: e.ie ?? "",
      endereco: e.endereco ?? "",
      bairro: e.bairro ?? "",
      cidade: e.cidade ?? "",
      estado: e.estado ?? "",
      cep: e.cep ?? "",
      telefone: e.telefone ?? "",
      email: e.email ?? "",
      site: e.site ?? "",
      ativo: e.ativo,
      plano: e.plano ?? "",
      data_vencimento: e.data_vencimento ?? "",
      observacoes: e.observacoes ?? "",
      hub_customer_id: e.hub_customer_id ?? "",
      hub_product_code: e.hub_product_code ?? "",
      hub_license_status: e.hub_license_status ?? "",
      hub_license_reason: e.hub_license_reason ?? "",
      hub_expires_at: e.hub_expires_at ? e.hub_expires_at.slice(0, 10) : "",
    });
    setDialogOpen(true);
  }

  function confirmDelete(id: number) {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    saveMutation.mutate({ ...form, id: editingEmpresa?.id_empresa });
  }

  const filtered = empresas.filter((e) =>
    [e.nome_fantasia, e.razao_social, e.cnpj, e.email, e.cidade]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  if (!isPlatformAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-emerald-600" />
            <h1 className="text-xl font-bold">Área Administrativa</h1>
          </div>
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Empresa
          </Button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs text-muted-foreground font-medium">Total de Empresas</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-2xl font-bold">{stats.totalEmpresas}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs text-muted-foreground font-medium">Empresas Ativas</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-2xl font-bold text-green-600">{stats.ativas}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs text-muted-foreground font-medium">Empresas Inativas</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-2xl font-bold text-red-500">{stats.inativas}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs text-muted-foreground font-medium">Total de Usuários</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span className="text-2xl font-bold">{stats.totalUsuarios}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search */}
        <Input
          placeholder="Buscar por nome, CNPJ, e-mail, cidade…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />

        {/* Table */}
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-semibold">Empresa</th>
                <th className="px-4 py-3 text-left font-semibold">CPF / CNPJ</th>
                <th className="px-4 py-3 text-left font-semibold">Plano</th>
                <th className="px-4 py-3 text-left font-semibold">Vencimento</th>
                <th className="px-4 py-3 text-left font-semibold">Último Acesso</th>
                <th className="px-4 py-3 text-left font-semibold">Usuários</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhuma empresa encontrada.
                  </td>
                </tr>
              ) : (
                filtered.map((emp) => (
                  <tr key={emp.id_empresa} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{emp.nome_fantasia}</div>
                      {emp.razao_social && (
                        <div className="text-xs text-muted-foreground">{emp.razao_social}</div>
                      )}
                      {emp.email && (
                        <div className="text-xs text-muted-foreground">{emp.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{emp.cnpj || "—"}</td>
                    <td className="px-4 py-3">
                      {emp.plano ? (
                        <Badge variant="outline" className="capitalize">{emp.plano}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {emp.data_vencimento ? (
                        <span className={
                          new Date(emp.data_vencimento) < new Date()
                            ? "text-red-500 font-medium"
                            : ""
                        }>
                          {fmtDate(emp.data_vencimento)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{fmt(emp.ultimo_acesso)}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        {emp.total_usuarios ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {emp.ativo ? (
                        <Badge className="bg-green-100 text-green-700 border-green-200">Ativa</Badge>
                      ) : (
                        <Badge variant="destructive">Inativa</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          title={emp.ativo ? "Desativar" : "Ativar"}
                          onClick={() => toggleMutation.mutate(emp.id_empresa)}
                        >
                          {emp.ativo
                            ? <ToggleRight className="h-4 w-4 text-green-600" />
                            : <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                          }
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          title="Editar"
                          onClick={() => openEdit(emp)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title="Excluir"
                          onClick={() => confirmDelete(emp.id_empresa)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog criar/editar empresa */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEmpresa ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label>Nome Fantasia *</Label>
                <Input
                  value={form.nome_fantasia}
                  onChange={(e) => setForm((f) => ({ ...f, nome_fantasia: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label>Razão Social</Label>
                <Input
                  value={form.razao_social}
                  onChange={(e) => setForm((f) => ({ ...f, razao_social: e.target.value }))}
                />
              </div>
              <div>
                <Label>CPF / CNPJ</Label>
                <Input
                  value={form.cnpj}
                  onChange={(e) => setForm((f) => ({ ...f, cnpj: formatCpfCnpj(e.target.value) }))}
                  placeholder="000.000.000-00 ou 00.000.000/0001-00"
                />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  value={form.telefone}
                  onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                />
              </div>
              <div>
                <Label>Plano</Label>
                <Select
                  value={form.plano || ""}
                  onValueChange={(v) => setForm((f) => ({ ...f, plano: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Sem plano —</SelectItem>
                    {PLANOS.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data de Vencimento</Label>
                <Input
                  type="date"
                  value={form.data_vencimento}
                  onChange={(e) => setForm((f) => ({ ...f, data_vencimento: e.target.value }))}
                />
              </div>
              <div>
                <Label>Hub Customer ID</Label>
                <Input
                  value={form.hub_customer_id}
                  onChange={(e) => setForm((f) => ({ ...f, hub_customer_id: e.target.value }))}
                  placeholder="UUID do cliente no Hub Billing"
                />
              </div>
              <div>
                <Label>Hub Product Code</Label>
                <Input
                  value={form.hub_product_code}
                  onChange={(e) => setForm((f) => ({ ...f, hub_product_code: e.target.value }))}
                  placeholder="SOFTX_PRO"
                />
              </div>
              <div>
                <Label>Status da Licença (Hub)</Label>
                <Input
                  value={form.hub_license_status}
                  onChange={(e) => setForm((f) => ({ ...f, hub_license_status: e.target.value }))}
                  placeholder="active, license_suspended..."
                />
              </div>
              <div>
                <Label>Motivo da Licença</Label>
                <Input
                  value={form.hub_license_reason}
                  onChange={(e) => setForm((f) => ({ ...f, hub_license_reason: e.target.value }))}
                  placeholder="license_expired, no_license..."
                />
              </div>
              <div>
                <Label>Hub Expires At</Label>
                <Input
                  type="date"
                  value={form.hub_expires_at}
                  onChange={(e) => setForm((f) => ({ ...f, hub_expires_at: e.target.value }))}
                />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input
                  value={form.cidade}
                  onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))}
                />
              </div>
              <div>
                <Label>Estado</Label>
                <Input
                  value={form.estado}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}
                  maxLength={2}
                  placeholder="UF"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Endereço</Label>
                <Input
                  value={form.endereco}
                  onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={form.ativo ? "true" : "false"}
                  onValueChange={(v) => setForm((f) => ({ ...f, ativo: v === "true" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Ativa</SelectItem>
                    <SelectItem value="false">Inativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Observações</Label>
                <Textarea
                  value={form.observacoes}
                  onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                  rows={3}
                  placeholder="Anotações internas da plataforma…"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os dados relacionados serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
