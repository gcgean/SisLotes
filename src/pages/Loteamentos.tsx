import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, MapPin, Grid3X3 } from "lucide-react";

const mockLoteamentos = [
  { id: 1, nome: "Residencial Primavera", cidade: "São Paulo", estado: "SP", totalLotes: 120, vendidos: 87, prop_nome: "José Carlos" },
  { id: 2, nome: "Jardim das Flores", cidade: "Campinas", estado: "SP", totalLotes: 80, vendidos: 45, prop_nome: "Maria Fernanda" },
  { id: 3, nome: "Vila Verde", cidade: "Ribeirão Preto", estado: "SP", totalLotes: 200, vendidos: 156, prop_nome: "Construtora XYZ" },
  { id: 4, nome: "Parque do Sol", cidade: "Belo Horizonte", estado: "MG", totalLotes: 150, vendidos: 98, prop_nome: "Carlos Eduardo" },
  { id: 5, nome: "Portal da Serra", cidade: "Curitiba", estado: "PR", totalLotes: 60, vendidos: 22, prop_nome: "Ana Silva" },
  { id: 6, nome: "Recanto Azul", cidade: "Goiânia", estado: "GO", totalLotes: 95, vendidos: 71, prop_nome: "Pedro Martins" },
];

const Loteamentos = () => {
  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Loteamentos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mockLoteamentos.length} loteamentos cadastrados
            </p>
          </div>
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Loteamento
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {mockLoteamentos.map((lot, i) => {
            const percent = Math.round((lot.vendidos / lot.totalLotes) * 100);
            return (
              <div
                key={lot.id}
                className="glass-card rounded-lg p-5 space-y-4 hover:border-primary/30 transition-colors cursor-pointer animate-fade-in"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{lot.nome}</h3>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <MapPin className="h-3 w-3" />
                      {lot.cidade}/{lot.estado}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {percent}% vendido
                  </Badge>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>{lot.vendidos} vendidos</span>
                    <span>{lot.totalLotes - lot.vendidos} disponíveis</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-700"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Grid3X3 className="h-3 w-3" />
                    {lot.totalLotes} lotes
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Prop: {lot.prop_nome}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default Loteamentos;
