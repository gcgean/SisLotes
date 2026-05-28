import {
  LayoutDashboard,
  Users,
  MapPin,
  Grid3X3,
  ShoppingCart,
  CreditCard,
  FileText,
  Wallet,
  Settings,
  Building2,
  Activity,
  ShieldAlert,
  MessageSquare,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLicenseFeatures } from "@/hooks/useLicenseFeatures";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Loteamentos", url: "/loteamentos", icon: MapPin },
  { title: "Lotes", url: "/lotes", icon: Grid3X3 },
  { title: "Vendas", url: "/vendas", icon: ShoppingCart },
  { title: "Pagamentos", url: "/pagamentos", icon: CreditCard },
];

const secondaryItems = [
  { title: "Planos", url: "/planos", icon: Wallet },
  { title: "Relatórios", url: "/relatorios", icon: FileText },
  { title: "Auditoria", url: "/auditoria", icon: Activity },
  { title: "Sugestões", url: "/sugestoes", icon: MessageSquare },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const { setOpenMobile } = useSidebar();
  const { user } = useAuth();
  const { canUseVendas, canUsePagamentos, canUseRelatorios, canUseAuditoria, canUsePlanos } = useLicenseFeatures();
  const isPlatformAdmin = user?.login?.toLowerCase() === "gcgean";
  const filteredMainItems = mainItems.filter((item) => {
    if (item.url === "/vendas") return canUseVendas;
    if (item.url === "/pagamentos") return canUsePagamentos;
    return true;
  });
  const filteredSecondaryItems = secondaryItems.filter((item) => {
    if (item.url === "/planos") return canUsePlanos;
    if (item.url === "/relatorios") return canUseRelatorios;
    if (item.url === "/auditoria") return canUseAuditoria;
    return true;
  });

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Building2 className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-sidebar-accent-foreground tracking-tight">SISLOTE</h1>
            <p className="text-[11px] text-sidebar-foreground">Gestão de Loteamentos</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-sidebar-foreground/50 font-semibold">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md text-base text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      onClick={() => setOpenMobile(false)}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-sidebar-foreground/50 font-semibold">
            Sistema
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredSecondaryItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md text-base text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      onClick={() => setOpenMobile(false)}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isPlatformAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-sidebar-foreground/50 font-semibold">
              Plataforma
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/admin"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md text-base text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      onClick={() => setOpenMobile(false)}
                    >
                      <ShieldAlert className="h-5 w-5 shrink-0" />
                      <span>Administração</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
