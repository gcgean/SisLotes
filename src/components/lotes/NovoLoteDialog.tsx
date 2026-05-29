import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoteamentoCombobox } from "@/components/ui/loteamento-combobox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface Loteamento {
  id_loteamento: number;
  nome: string;
  cidade?: string;
  estado?: string;
}

const loteFormSchema = z.object({
  id_loteamento: z.string().min(1, "Loteamento é obrigatório"),
  lote: z.string().min(1, "Lote é obrigatório"),
  quadra: z.string().min(1, "Quadra é obrigatória"),
  area: z.string().optional(),
  frente: z.string().optional(),
  fundo: z.string().optional(),
  esquerdo: z.string().optional(),
  direito: z.string().optional(),
});

type LoteFormValues = z.infer<typeof loteFormSchema>;

interface NovoLoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultLoteamentoId?: number | null;
  onSuccess?: (lote: { id_lote: number; lote: string; quadra: string; area?: string; frente?: string; id_loteamento: number }) => void;
}

function getAuthHeaders() {
  const token = window.localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

export function NovoLoteDialog({ open, onOpenChange, defaultLoteamentoId, onSuccess }: NovoLoteDialogProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: loteamentos = [] } = useQuery<Loteamento[]>({
    queryKey: ["loteamentos"],
    queryFn: async () => {
      const r = await fetch("/api/loteamentos", { headers: getAuthHeaders() });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60_000,
  });

  const form = useForm<LoteFormValues>({
    resolver: zodResolver(loteFormSchema),
    defaultValues: {
      id_loteamento: defaultLoteamentoId ? String(defaultLoteamentoId) : "",
      lote: "",
      quadra: "",
      area: "",
      frente: "",
      fundo: "",
      esquerdo: "",
      direito: "",
    },
  });

  // Atualiza o loteamento padrão quando o dialog abre
  const handleOpenChange = (o: boolean) => {
    if (o) {
      form.reset({
        id_loteamento: defaultLoteamentoId ? String(defaultLoteamentoId) : "",
        lote: "",
        quadra: "",
        area: "",
        frente: "",
        fundo: "",
        esquerdo: "",
        direito: "",
      });
    }
    onOpenChange(o);
  };

  async function onSubmit(values: LoteFormValues) {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/lotes", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...values, id_loteamento: Number(values.id_loteamento) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Erro ao cadastrar lote");
      }
      const novoLote = await res.json();
      await queryClient.invalidateQueries({ queryKey: ["lotes"] });
      toast({ title: "Lote cadastrado", description: `Lote ${values.lote} — Quadra ${values.quadra} criado com sucesso.` });
      onSuccess?.(novoLote);
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Erro", description: err instanceof Error ? err.message : "Erro ao cadastrar lote", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Cadastrar Lote</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="id_loteamento"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Loteamento</FormLabel>
                    <FormControl>
                      <LoteamentoCombobox
                        loteamentos={loteamentos}
                        value={field.value}
                        onValueChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quadra"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quadra</FormLabel>
                    <FormControl><Input {...field} placeholder="Ex: 01" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lote"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lote</FormLabel>
                    <FormControl><Input {...field} placeholder="Ex: 12" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="area"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Área (m²)</FormLabel>
                    <FormControl><Input {...field} placeholder="Ex: 360" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="frente"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frente (m)</FormLabel>
                    <FormControl><Input {...field} placeholder="Ex: 12" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fundo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fundo (m)</FormLabel>
                    <FormControl><Input {...field} placeholder="Ex: 12" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="esquerdo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Esquerdo (m)</FormLabel>
                    <FormControl><Input {...field} placeholder="Ex: 30" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="direito"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Direito (m)</FormLabel>
                    <FormControl><Input {...field} placeholder="Ex: 30" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Cadastrando..." : "Cadastrar Lote"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
