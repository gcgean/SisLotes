import { useState } from "react";
import { usePWA } from "@/hooks/usePWA";
import { Button } from "@/components/ui/button";
import { Download, X, Share } from "lucide-react";

export function PWAInstallBanner() {
  const { installPrompt, isInstalled, isIOS, install } = usePWA();
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled || dismissed) return null;

  // iOS: show "Add to Home Screen" instructions
  if (isIOS && !isInstalled) {
    return (
      <div className="fixed bottom-16 left-4 right-4 md:bottom-4 md:left-auto md:right-4 md:w-80 z-50 bg-background border border-border rounded-xl p-4 shadow-lg animate-fade-in">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <span className="text-primary-foreground font-bold text-sm">SL</span>
            </div>
            <div>
              <p className="text-sm font-semibold">Instalar SISLOTE</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Toque em <Share className="inline h-3 w-3" /> e depois{" "}
                <strong>"Adicionar à Tela Inicial"</strong>
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setDismissed(true)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (!installPrompt) return null;

  return (
    <div className="fixed bottom-16 left-4 right-4 md:bottom-4 md:left-auto md:right-4 md:w-80 z-50 bg-background border border-border rounded-xl p-4 shadow-lg animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-sm">SL</span>
          </div>
          <div>
            <p className="text-sm font-semibold">Instalar SISLOTE</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Acesse mais rápido pelo celular ou desktop
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setDismissed(true)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex gap-2 mt-3">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => setDismissed(true)}>
          Agora não
        </Button>
        <Button size="sm" className="flex-1 gap-2" onClick={install}>
          <Download className="h-4 w-4" />
          Instalar
        </Button>
      </div>
    </div>
  );
}
