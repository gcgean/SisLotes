import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface LoteamentoMultiOption {
  id_loteamento: number;
  nome: string;
  cidade?: string | null;
  estado?: string | null;
}

export function localDoLoteamento(l: { cidade?: string | null; estado?: string | null }) {
  return [l.cidade, l.estado].filter(Boolean).join("/");
}

interface Props {
  loteamentos: LoteamentoMultiOption[];
  /** ids selecionados; vazio = todos */
  value: number[];
  onValueChange: (ids: number[]) => void;
  allLabel?: string;
  isLoading?: boolean;
  className?: string;
}

/**
 * Seleção de um ou vários loteamentos, com busca por nome ou cidade.
 * Lista vazia = "todos", que é como as telas tratam a ausência de filtro.
 */
export function LoteamentoMultiCombobox({
  loteamentos,
  value,
  onValueChange,
  allLabel = "Todos os loteamentos",
  isLoading = false,
  className,
}: Props) {
  const [busca, setBusca] = React.useState("");

  const termo = busca.trim().toLowerCase();
  const opcoes = termo
    ? loteamentos.filter(
        (l) =>
          l.nome.toLowerCase().includes(termo) ||
          localDoLoteamento(l).toLowerCase().includes(termo),
      )
    : loteamentos;

  function toggle(id: number) {
    onValueChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  }

  const rotulo =
    value.length === 0
      ? allLabel
      : value.length === 1
        ? loteamentos.find((l) => l.id_loteamento === value[0])?.nome ?? "1 loteamento"
        : `${value.length} loteamentos`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("gap-2 justify-between font-normal", className)}>
          <span className="truncate">{rotulo}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-2" align="start">
        <Input
          placeholder="Buscar por loteamento ou cidade..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="h-8 mb-2 text-sm"
        />
        <div className="max-h-[300px] overflow-y-auto space-y-1">
          {opcoes.length === 0 && (
            <div className="px-2 py-3 text-xs text-muted-foreground text-center">
              {isLoading ? "Carregando…" : "Nenhum loteamento encontrado."}
            </div>
          )}
          {/* A linha é um div (não <label> nem <button>): com <label> o clique
              chegava duas vezes e se anulava, e um <button> aninharia o button
              que o Checkbox renderiza. O Checkbox fica só como indicador. */}
          {opcoes.map((l) => {
            const local = localDoLoteamento(l);
            const marcado = value.includes(l.id_loteamento);
            return (
              <div
                key={l.id_loteamento}
                role="option"
                aria-selected={marcado}
                tabIndex={0}
                onClick={() => toggle(l.id_loteamento)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle(l.id_loteamento);
                  }
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted focus:bg-muted focus:outline-none cursor-pointer text-sm text-left"
              >
                <Checkbox
                  checked={marcado}
                  className="pointer-events-none shrink-0"
                  tabIndex={-1}
                  aria-hidden="true"
                />
                <span className="truncate flex-1 min-w-0">
                  {l.nome}
                  {local && <span className="text-xs text-muted-foreground"> — {local}</span>}
                </span>
              </div>
            );
          })}
        </div>
        {value.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 h-8 text-xs"
            onClick={() => onValueChange([])}
          >
            Limpar seleção
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
