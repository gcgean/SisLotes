import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { ShieldAlert } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Navigate } from "react-router-dom";
import { OverviewTab } from "@/components/admin/dashboard/OverviewTab";
import { JornadaTab } from "@/components/admin/dashboard/JornadaTab";
import { UsoTab } from "@/components/admin/dashboard/UsoTab";
import { GeografiaTab } from "@/components/admin/dashboard/GeografiaTab";

export default function Admin() {
  const { user } = useAuth();
  const isPlatformAdmin = user?.login?.toLowerCase() === "gcgean";

  if (!isPlatformAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-emerald-600" />
          <h1 className="text-xl font-bold">Área Administrativa</h1>
        </div>

        <Tabs defaultValue="visao-geral">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
            <TabsTrigger value="jornada">Jornada &amp; Funil</TabsTrigger>
            <TabsTrigger value="uso">Uso &amp; Engajamento</TabsTrigger>
            <TabsTrigger value="geografia">Geografia</TabsTrigger>
          </TabsList>

          <TabsContent value="visao-geral" className="mt-4">
            <OverviewTab />
          </TabsContent>
          <TabsContent value="jornada" className="mt-4">
            <JornadaTab />
          </TabsContent>
          <TabsContent value="uso" className="mt-4">
            <UsoTab />
          </TabsContent>
          <TabsContent value="geografia" className="mt-4">
            <GeografiaTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
