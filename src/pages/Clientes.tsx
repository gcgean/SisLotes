import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Eye } from "lucide-react";

const mockClientes = [
  { id: 1, tipo: "f" as const, nome: "João Silva", cpf: "123.456.789-00", cidade: "São Paulo", estado: "SP", fone_res: "(11) 98765-4321" },
  { id: 2, tipo: "j" as const, nome: "Construtora ABC", cnpj: "12.345.678/0001-90", cidade: "Campinas", estado: "SP", fone_com: "(19) 3456-7890" },
  { id: 3, tipo: "f" as const, nome: "Maria Santos", cpf: "987.654.321-00", cidade: "Ribeirão Preto", estado: "SP", fone_res: "(16) 99876-5432" },
  { id: 4, tipo: "f" as const, nome: "Carlos Lima", cpf: "456.789.123-00", cidade: "Belo Horizonte", estado: "MG", fone_res: "(31) 97654-3210" },
  { id: 5, tipo: "j" as const, nome: "Imobiliária XYZ Ltda", cnpj: "98.765.432/0001-10", cidade: "Curitiba", estado: "PR", fone_com: "(41) 3234-5678" },
  { id: 6, tipo: "f" as const, nome: "Ana Oliveira", cpf: "321.654.987-00", cidade: "Goiânia", estado: "GO", fone_res: "(62) 98123-4567" },
  { id: 7, tipo: "f" as const, nome: "Pedro Souza", cpf: "654.321.987-00", cidade: "Uberlândia", estado: "MG", fone_res: "(34) 99234-5678" },
  { id: 8, tipo: "j" as const, nome: "Incorporadora Delta", cnpj: "45.678.901/0001-23", cidade: "Brasília", estado: "DF", fone_com: "(61) 3345-6789" },
];

const Clientes = () => {
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<"all" | "f" | "j">("all");

  const filtered = mockClientes.filter((c) => {
    const matchSearch = c.nome.toLowerCase().includes(search.toLowerCase());
    const matchTipo = filterTipo === "all" || c.tipo === filterTipo;
    return matchSearch && matchTipo;
  });

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mockClientes.length} clientes cadastrados
            </p>
          </div>
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Cliente
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            {(["all", "f", "j"] as const).map((tipo) => (
              <Button
                key={tipo}
                variant={filterTipo === tipo ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterTipo(tipo)}
              >
                {tipo === "all" ? "Todos" : tipo === "f" ? "Pessoa Física" : "Pessoa Jurídica"}
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
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Nome</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">CPF/CNPJ</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Cidade</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Telefone</th>
                  <th className="text-right px-5 py-3 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium">{cliente.nome}</td>
                    <td className="px-5 py-3">
                      <Badge variant={cliente.tipo === "f" ? "secondary" : "outline"}>
                        {cliente.tipo === "f" ? "PF" : "PJ"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground font-mono text-xs">
                      {cliente.cpf || cliente.cnpj}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {cliente.cidade}/{cliente.estado}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {cliente.fone_res || cliente.fone_com}
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
              Nenhum cliente encontrado
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Clientes;
