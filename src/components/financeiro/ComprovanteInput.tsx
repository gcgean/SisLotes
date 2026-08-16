import { Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ComprovanteValue {
  anexo_nome: string;
  anexo_base64: string;
}

interface Props {
  value: ComprovanteValue;
  onChange: (value: ComprovanteValue) => void;
  onError: (message: string) => void;
}

const TIPOS = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export function ComprovanteInput({ value, onChange, onError }: Props) {
  function selecionar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!TIPOS.includes(file.type)) return onError("Selecione um comprovante PDF, JPG, PNG ou WEBP.");
    if (file.size > 5 * 1024 * 1024) return onError("O comprovante deve ter no máximo 5 MB.");
    const reader = new FileReader();
    reader.onload = () => onChange({ anexo_nome: file.name.slice(0, 200), anexo_base64: String(reader.result) });
    reader.onerror = () => onError("Não foi possível ler o comprovante.");
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-1.5">
      <Label>Comprovante (opcional)</Label>
      {value.anexo_nome ? (
        <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <Paperclip className="h-4 w-4 shrink-0" />
          <a className="min-w-0 flex-1 truncate underline-offset-2 hover:underline" href={value.anexo_base64} download={value.anexo_nome}>
            {value.anexo_nome}
          </a>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Remover comprovante" onClick={() => onChange({ anexo_nome: "", anexo_base64: "" })}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={selecionar} className="text-sm file:text-xs" />
      )}
      <p className="text-xs text-muted-foreground">PDF ou imagem, até 5 MB.</p>
    </div>
  );
}
