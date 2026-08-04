import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mensagem padrão de carregamento, usada enquanto os dados de uma
 * listagem/painel ainda não chegaram — evita mostrar "nenhum registro"
 * (ou um bloco vazio) antes da resposta da API.
 */
export function LoadingState({
  message = "Carregando…",
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground", className)}>
      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/** Mesma mensagem, porém como linha de tabela (ocupando todas as colunas). */
export function LoadingRow({ colSpan, message = "Carregando…" }: { colSpan: number; message?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8">
        <LoadingState message={message} className="py-0" />
      </td>
    </tr>
  );
}
