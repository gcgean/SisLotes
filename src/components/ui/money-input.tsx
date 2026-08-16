import * as React from "react";
import { Input } from "@/components/ui/input";

type MoneyInputProps = Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
};

function parseMoney(value: string): number {
  const normalized = value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatMoneyInput(value: string): string {
  if (!value) return "";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(parseMoney(value));
}

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onValueChange, onWheel, onFocus, ...props }, ref) => (
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode="numeric"
      value={formatMoneyInput(value)}
      onFocus={(event) => {
        event.currentTarget.select();
        onFocus?.(event);
      }}
      onWheel={(event) => {
        event.currentTarget.blur();
        onWheel?.(event);
      }}
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, "");
        onValueChange(digits ? (Number(digits) / 100).toFixed(2) : "");
      }}
    />
  ),
);
MoneyInput.displayName = "MoneyInput";
