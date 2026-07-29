import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox, ComboboxOption } from "@/components/ui/combobox";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RateioLinha {
  id_loteamento: string; // string para casar com o value do Combobox
  percentual: string;
}

interface Loteamento {
  id_loteamento: number;
  nome: string;
}

interface Props {
  loteamentos: Loteamento[];
  value: RateioLinha[];
  onChange: (v: RateioLinha[]) => void;
}

export function RateioLoteamentoEditor({ loteamentos, value, onChange }: Props) {
  const total = value.reduce((s, l) => s + (Number(l.percentual.replace(",", ".")) || 0), 0);
  const totalOk = Math.abs(total - 100) < 0.5;

  const options: ComboboxOption[] = loteamentos.map((l) => ({ value: String(l.id_loteamento), label: l.nome }));

  function addLinha() {
    onChange([...value, { id_loteamento: "", percentual: "" }]);
  }
  function updateLinha(i: number, patch: Partial<RateioLinha>) {
    onChange(value.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function removeLinha(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      {value.map((linha, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex-1">
            <Combobox
              options={options}
              value={linha.id_loteamento}
              onValueChange={(v) => updateLinha(i, { id_loteamento: v })}
              placeholder="Selecione o loteamento..."
              searchPlaceholder="Buscar loteamento..."
              emptyText="Nenhum loteamento encontrado."
            />
          </div>
          <div className="w-24 relative">
            <Input
              inputMode="decimal"
              value={linha.percentual}
              onChange={(e) => updateLinha(i, { percentual: e.target.value })}
              placeholder="0"
              className="pr-6 text-right"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive shrink-0" onClick={() => removeLinha(i)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={addLinha} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Adicionar loteamento
        </Button>
        <span className={cn("text-xs font-medium", totalOk ? "text-emerald-600" : "text-amber-600")}>
          Total: {total.toFixed(0)}% {totalOk ? "✓" : "(deve somar 100%)"}
        </span>
      </div>
    </div>
  );
}
