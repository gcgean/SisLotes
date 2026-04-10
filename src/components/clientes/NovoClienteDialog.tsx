import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Phone, User, UserPlus } from "lucide-react";
import { formatCpfCnpj } from "@/lib/cpfCnpj";

export type ClienteTipo = "f" | "j";
export type NovoClienteTab = "dados" | "endereco" | "contato";

export interface NovoClienteFormValues {
  tipo: ClienteTipo;
  nome: string;
  razao_social: string;
  cpf: string;
  cnpj: string;
  rg: string;
  estado_civil: string;
  conjuge: string;
  profissao: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  complemento: string;
  fone_res: string;
  fone_com: string;
}

const defaultNovoClienteValues: NovoClienteFormValues = {
  tipo: "f",
  nome: "",
  razao_social: "",
  cpf: "",
  cnpj: "",
  rg: "",
  estado_civil: "",
  conjuge: "",
  profissao: "",
  endereco: "",
  bairro: "",
  cidade: "",
  estado: "",
  cep: "",
  complemento: "",
  fone_res: "",
  fone_com: "",
};

const ESTADO_CIVIL_LIST = [
  "Solteiro(a)",
  "Casado(a)",
  "Separado(a)",
  "Divorciado(a)",
  "Viúvo(a)",
  "União estável",
];

interface NovoClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: NovoClienteFormValues) => Promise<void> | void;
  isSubmitting?: boolean;
  title?: string;
  description?: string;
  submitLabel?: string;
}

export function NovoClienteDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  title = "Novo Cliente",
  description = "Preencha os dados do cliente. Campos não obrigatórios podem ficar em branco.",
  submitLabel = "Cadastrar cliente",
}: NovoClienteDialogProps) {
  const [tab, setTab] = useState<NovoClienteTab>("dados");
  const [form, setForm] = useState<NovoClienteFormValues>(defaultNovoClienteValues);

  useEffect(() => {
    if (open) {
      setTab("dados");
      setForm(defaultNovoClienteValues);
    }
  }, [open]);

  const isValid = form.nome.trim().length > 0;

  async function handleSubmit() {
    if (!isValid || isSubmitting) return;
    await onSubmit({
      ...form,
      nome: form.nome.trim(),
      razao_social: form.razao_social.trim(),
      cpf: form.cpf.trim(),
      cnpj: form.cnpj.trim(),
      rg: form.rg.trim(),
      estado_civil: form.estado_civil.trim(),
      conjuge: form.conjuge.trim(),
      profissao: form.profissao.trim(),
      endereco: form.endereco.trim(),
      bairro: form.bairro.trim(),
      cidade: form.cidade.trim(),
      estado: form.estado.trim(),
      cep: form.cep.trim(),
      complemento: form.complemento.trim(),
      fone_res: form.fone_res.trim(),
      fone_com: form.fone_com.trim(),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="novo_cliente_tipo">Tipo de cliente</Label>
            <Select
              value={form.tipo}
              onValueChange={(value) => setForm((prev) => ({ ...prev, tipo: value as ClienteTipo }))}
            >
              <SelectTrigger id="novo_cliente_tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="f">Pessoa Física</SelectItem>
                <SelectItem value="j">Pessoa Jurídica</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Tabs value={tab} onValueChange={(value) => setTab(value as NovoClienteTab)} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="dados" className="gap-1.5">
                <User className="h-3.5 w-3.5" />
                {form.tipo === "j" ? "Dados da Empresa" : "Dados Pessoais"}
              </TabsTrigger>
              <TabsTrigger value="endereco" className="gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                Endereço
              </TabsTrigger>
              <TabsTrigger value="contato" className="gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                Contato
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="pt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nc_nome">{form.tipo === "j" ? "Nome do responsável *" : "Nome completo *"}</Label>
                <Input
                  id="nc_nome"
                  value={form.nome}
                  onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
                  placeholder="Digite o nome completo"
                  autoFocus
                />
              </div>

              {form.tipo === "f" ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nc_cpf">CPF</Label>
                      <Input
                        id="nc_cpf"
                        value={form.cpf}
                        onChange={(e) => setForm((prev) => ({ ...prev, cpf: formatCpfCnpj(e.target.value) }))}
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nc_rg">RG</Label>
                      <Input
                        id="nc_rg"
                        value={form.rg}
                        onChange={(e) => setForm((prev) => ({ ...prev, rg: e.target.value }))}
                        placeholder="0000000"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nc_estado_civil">Estado civil</Label>
                      <Select
                        value={form.estado_civil || "nao-informado"}
                        onValueChange={(value) =>
                          setForm((prev) => ({
                            ...prev,
                            estado_civil: value === "nao-informado" ? "" : value,
                          }))
                        }
                      >
                        <SelectTrigger id="nc_estado_civil">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nao-informado">— Não informado —</SelectItem>
                          {ESTADO_CIVIL_LIST.map((estadoCivil) => (
                            <SelectItem key={estadoCivil} value={estadoCivil}>
                              {estadoCivil}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nc_conjuge">Cônjuge / Companheiro(a)</Label>
                      <Input
                        id="nc_conjuge"
                        value={form.conjuge}
                        onChange={(e) => setForm((prev) => ({ ...prev, conjuge: e.target.value }))}
                        placeholder="Nome do cônjuge"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nc_profissao">Profissão</Label>
                    <Input
                      id="nc_profissao"
                      value={form.profissao}
                      onChange={(e) => setForm((prev) => ({ ...prev, profissao: e.target.value }))}
                      placeholder="Ex: Engenheiro, Professor..."
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nc_cnpj">CNPJ</Label>
                      <Input
                        id="nc_cnpj"
                        value={form.cnpj}
                        onChange={(e) => setForm((prev) => ({ ...prev, cnpj: formatCpfCnpj(e.target.value) }))}
                        placeholder="00.000.000/0000-00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nc_razao">Razão social</Label>
                      <Input
                        id="nc_razao"
                        value={form.razao_social}
                        onChange={(e) => setForm((prev) => ({ ...prev, razao_social: e.target.value }))}
                        placeholder="Razão social da empresa"
                      />
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="endereco" className="pt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nc_endereco">Endereço</Label>
                <Input
                  id="nc_endereco"
                  value={form.endereco}
                  onChange={(e) => setForm((prev) => ({ ...prev, endereco: e.target.value }))}
                  placeholder="Rua, Av., número..."
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nc_bairro">Bairro</Label>
                  <Input
                    id="nc_bairro"
                    value={form.bairro}
                    onChange={(e) => setForm((prev) => ({ ...prev, bairro: e.target.value }))}
                    placeholder="Bairro"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nc_complemento">Complemento</Label>
                  <Input
                    id="nc_complemento"
                    value={form.complemento}
                    onChange={(e) => setForm((prev) => ({ ...prev, complemento: e.target.value }))}
                    placeholder="Apto, bloco, casa..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="nc_cidade">Cidade</Label>
                  <Input
                    id="nc_cidade"
                    value={form.cidade}
                    onChange={(e) => setForm((prev) => ({ ...prev, cidade: e.target.value }))}
                    placeholder="Cidade"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nc_estado">UF</Label>
                  <Input
                    id="nc_estado"
                    value={form.estado}
                    onChange={(e) => setForm((prev) => ({ ...prev, estado: e.target.value.toUpperCase().slice(0, 2) }))}
                    placeholder="CE"
                    maxLength={2}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nc_cep">CEP</Label>
                <Input
                  id="nc_cep"
                  value={form.cep}
                  onChange={(e) => setForm((prev) => ({ ...prev, cep: e.target.value }))}
                  placeholder="00000-000"
                  maxLength={9}
                />
              </div>
            </TabsContent>

            <TabsContent value="contato" className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nc_fone_res">Telefone residencial</Label>
                  <Input
                    id="nc_fone_res"
                    value={form.fone_res}
                    onChange={(e) => setForm((prev) => ({ ...prev, fone_res: e.target.value }))}
                    placeholder="(00) 0000-0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nc_fone_com">
                    {form.tipo === "j" ? "Telefone comercial / Celular" : "Telefone comercial"}
                  </Label>
                  <Input
                    id="nc_fone_com"
                    value={form.fone_com}
                    onChange={(e) => setForm((prev) => ({ ...prev, fone_com: e.target.value }))}
                    placeholder="(00) 0 0000-0000"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isSubmitting}>
            {isSubmitting ? "Salvando..." : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
