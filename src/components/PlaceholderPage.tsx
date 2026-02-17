import { AppLayout } from "@/components/layout/AppLayout";
import { Construction } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
        <div className="p-4 rounded-full bg-muted mb-4">
          <Construction className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-bold mb-1">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </AppLayout>
  );
}
