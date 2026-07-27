import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { ShieldAlert, Send, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Navigate } from "react-router-dom";
import { OverviewTab } from "@/components/admin/dashboard/OverviewTab";
import { JornadaTab } from "@/components/admin/dashboard/JornadaTab";
import { UsoTab } from "@/components/admin/dashboard/UsoTab";
import { GeografiaTab } from "@/components/admin/dashboard/GeografiaTab";
import { TelegramConfigDialog } from "@/components/admin/TelegramConfigDialog";
import { LpAnalyticsDialog } from "@/components/admin/LpAnalyticsDialog";

export default function Admin() {
  const { user, token } = useAuth();
  const isPlatformAdmin = user?.login?.toLowerCase() === "gcgean";
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [lpAnalyticsOpen, setLpAnalyticsOpen] = useState(false);

  if (!isPlatformAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-emerald-600" />
            <h1 className="text-xl font-bold">Área Administrativa</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setLpAnalyticsOpen(true)} className="gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-600" />
              Analytics da Landing
            </Button>
            <Button variant="outline" onClick={() => setTelegramOpen(true)} className="gap-2">
              <Send className="h-4 w-4 text-sky-500" />
              Notificações Telegram
            </Button>
          </div>
        </div>

        <TelegramConfigDialog open={telegramOpen} onClose={() => setTelegramOpen(false)} token={token} />
        <LpAnalyticsDialog open={lpAnalyticsOpen} onClose={() => setLpAnalyticsOpen(false)} token={token} />

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
