import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Shield, Building2 } from "lucide-react";

const mockContas = [
  { id: 1, apelido: "BB Principal", titular: "Empresa ABC", agencia: "1234-5", conta: "12345-6", convenio: "123456" },
  { id: 2, apelido: "Caixa", titular: "Empresa ABC", agencia: "5678-9", conta: "67890-1", convenio: "654321" },
  { id: 3, apelido: "Itaú Emp.", titular: "Empresa ABC", agencia: "9012-3", conta: "34567-8", convenio: "" },
];

const mockUsuarios = [
  {
    id: 1, login: "admin", user_master: true,
    clientes_cadastrar: true, clientes_alterar: true, clientes_excluir: true,
    loteamentos_cadastrar: true, loteamentos_alterar: true, loteamentos_excluir: true,
    vendas_cadastrar: true, vendas_alterar: true, vendas_excluir: true,
  },
  {
    id: 2, login: "operador1", user_master: false,
    clientes_cadastrar: true, clientes_alterar: true, clientes_excluir: false,
    loteamentos_cadastrar: false, loteamentos_alterar: false, loteamentos_excluir: false,
    vendas_cadastrar: true, vendas_alterar: false, vendas_excluir: false,
  },
  {
    id: 3, login: "financeiro", user_master: false,
    clientes_cadastrar: false, clientes_alterar: false, clientes_excluir: false,
    loteamentos_cadastrar: false, loteamentos_alterar: false, loteamentos_excluir: false,
    vendas_cadastrar: false, vendas_alterar: false, vendas_excluir: false,
  },
];

const permissaoLabels: Record<string, string> = {
  clientes_cadastrar: "Cadastrar",
  clientes_alterar: "Alterar",
  clientes_excluir: "Excluir",
  loteamentos_cadastrar: "Cadastrar",
  loteamentos_alterar: "Alterar",
  loteamentos_excluir: "Excluir",
  vendas_cadastrar: "Cadastrar",
  vendas_alterar: "Alterar",
  vendas_excluir: "Excluir",
};

const Configuracoes = () => {
  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-sm text-muted-foreground mt-1">Contas bancárias, usuários e permissões</p>
        </div>

        <Tabs defaultValue="contas" className="space-y-4">
          <TabsList>
            <TabsTrigger value="contas" className="gap-2">
              <Building2 className="h-4 w-4" />
              Contas Bancárias
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="gap-2">
              <Shield className="h-4 w-4" />
              Usuários & Permissões
            </TabsTrigger>
          </TabsList>

          {/* CONTAS BANCÁRIAS */}
          <TabsContent value="contas" className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Conta
              </Button>
            </div>

            <div className="glass-card rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-5 py-3 font-medium text-muted-foreground">Apelido</th>
                      <th className="text-left px-5 py-3 font-medium text-muted-foreground">Titular</th>
                      <th className="text-left px-5 py-3 font-medium text-muted-foreground">Agência</th>
                      <th className="text-left px-5 py-3 font-medium text-muted-foreground">Conta</th>
                      <th className="text-left px-5 py-3 font-medium text-muted-foreground">Convênio</th>
                      <th className="text-right px-5 py-3 font-medium text-muted-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {mockContas.map((conta) => (
                      <tr key={conta.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3 font-medium">{conta.apelido}</td>
                        <td className="px-5 py-3 text-muted-foreground">{conta.titular}</td>
                        <td className="px-5 py-3 text-muted-foreground font-mono text-xs">{conta.agencia}</td>
                        <td className="px-5 py-3 text-muted-foreground font-mono text-xs">{conta.conta}</td>
                        <td className="px-5 py-3 text-muted-foreground font-mono text-xs">{conta.convenio || "—"}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
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
            </div>
          </TabsContent>

          {/* USUÁRIOS & PERMISSÕES */}
          <TabsContent value="usuarios" className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Usuário
              </Button>
            </div>

            <div className="space-y-4">
              {mockUsuarios.map((user) => (
                <div key={user.id} className="glass-card rounded-lg p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-bold uppercase">
                        {user.login.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{user.login}</p>
                        {user.user_master && (
                          <Badge className="mt-0.5 text-[10px]">Master</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {!user.user_master && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-border">
                      {(["clientes", "loteamentos", "vendas"] as const).map((modulo) => (
                        <div key={modulo} className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider capitalize">{modulo}</p>
                          {(["cadastrar", "alterar", "excluir"] as const).map((acao) => {
                            const key = `${modulo}_${acao}` as keyof typeof user;
                            return (
                              <div key={acao} className="flex items-center justify-between">
                                <Label className="text-xs capitalize">{acao}</Label>
                                <Switch checked={user[key] as boolean} disabled className="scale-75" />
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                  {user.user_master && (
                    <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                      Usuário master possui acesso total ao sistema
                    </p>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Configuracoes;
