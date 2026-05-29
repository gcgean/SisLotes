import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface LoteamentoOption {
  id_loteamento: number;
  nome: string;
  cidade?: string | null;
  estado?: string | null;
}

interface LoteamentoComboboxProps {
  loteamentos: LoteamentoOption[];
  value: string; // id_loteamento como string, ou "" para nenhum, ou "all" para todos
  onValueChange: (value: string) => void;
  placeholder?: string;
  allOptionLabel?: string; // ex: "Todos os loteamentos" — se passado, exibe a opção "todos"
  disabled?: boolean;
  className?: string;
}

export const LoteamentoCombobox = React.forwardRef<HTMLButtonElement, LoteamentoComboboxProps>(
  ({ loteamentos, value, onValueChange, placeholder = "Selecione um loteamento", allOptionLabel, disabled, className }, ref) => {
    const [open, setOpen] = React.useState(false);

    const selectedLabel = React.useMemo(() => {
      if (value === "all" && allOptionLabel) return allOptionLabel;
      const found = loteamentos.find((l) => String(l.id_loteamento) === value);
      if (!found) return null;
      const parts = [found.nome];
      if (found.cidade) parts.push(found.cidade);
      if (found.estado) parts[parts.length - 1] += `/${found.estado}`;
      return parts.join(" — ");
    }, [value, loteamentos, allOptionLabel]);

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal",
              !selectedLabel && "text-muted-foreground",
              className,
            )}
          >
            <span className="truncate">{selectedLabel ?? placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar loteamento..." />
            <CommandList>
              <CommandEmpty>Nenhum loteamento encontrado.</CommandEmpty>
              <CommandGroup>
                {allOptionLabel && (
                  <CommandItem
                    value="all"
                    onSelect={() => {
                      onValueChange("all");
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === "all" ? "opacity-100" : "opacity-0")} />
                    {allOptionLabel}
                  </CommandItem>
                )}
                {loteamentos.map((l) => {
                  const itemValue = String(l.id_loteamento);
                  const label = l.cidade
                    ? `${l.nome} — ${l.cidade}${l.estado ? `/${l.estado}` : ""}`
                    : l.nome;
                  return (
                    <CommandItem
                      key={l.id_loteamento}
                      // value é o que o Command usa para filtrar — inclui nome + cidade
                      value={`${l.nome} ${l.cidade ?? ""} ${l.estado ?? ""}`.trim()}
                      onSelect={() => {
                        onValueChange(itemValue);
                        setOpen(false);
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", value === itemValue ? "opacity-100" : "opacity-0")} />
                      {label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  },
);

LoteamentoCombobox.displayName = "LoteamentoCombobox";
