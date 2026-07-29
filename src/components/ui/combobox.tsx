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

export interface ComboboxOption {
  value: string;
  label: string;
  /** Texto usado para a busca digitada, se diferente do label exibido. */
  searchValue?: string;
  /** Nível de indentação visual (ex: hierarquia de plano de contas). */
  indent?: number;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

// Select pesquisável (digite para filtrar), reutilizável em qualquer combo do sistema.
export const Combobox = React.forwardRef<HTMLButtonElement, ComboboxProps>(
  (
    {
      options,
      value,
      onValueChange,
      placeholder = "Selecione...",
      searchPlaceholder = "Buscar...",
      emptyText = "Nenhum resultado encontrado.",
      disabled,
      className,
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const selected = options.find((o) => o.value === value);

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
              !selected && "text-muted-foreground",
              className,
            )}
          >
            <span className="truncate">{selected ? selected.label : placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.searchValue ?? opt.label}
                    onSelect={() => {
                      onValueChange(opt.value);
                      setOpen(false);
                    }}
                    style={opt.indent ? { paddingLeft: `${12 + opt.indent * 16}px` } : undefined}
                  >
                    <Check className={cn("mr-2 h-4 w-4 shrink-0", value === opt.value ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{opt.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  },
);

Combobox.displayName = "Combobox";
