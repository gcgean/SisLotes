import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  MapPin,
  Grid3X3,
  ShoppingCart,
  CreditCard,
  FileText,
  Wallet,
  Receipt,
  ReceiptText,
  ListTree,
  Truck,
  Landmark,
  ScrollText,
  Settings,
  Building2,
  Activity,
  ShieldAlert,
  MessageSquare,
  HeadphonesIcon,
  ChevronDown,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLicenseFeatures } from "@/hooks/useLicenseFeatures";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
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

const financeiroSubItems = [
  { title: "Dashboard de Fluxo de Caixa", tab: "visao-geral", icon: LayoutDashboard },
  { title: "Contas a Pagar", tab: "despesas", icon: ReceiptText },
  { title: "Plano de Contas", tab: "categorias", icon: ListTree },
  { title: "Fornecedores", tab: "fornecedores", icon: Truck },
  { title: "Contas", tab: "contas", icon: Landmark },
  { title: "Extrato / Lançamento", tab: "lancamentos", icon: ScrollText },
];

const secondaryItems = [
  { title: "Planos", url: "/planos", icon: Wallet },
  { title: "Relatórios", url: "/relatorios", icon: FileText },
  { title: "Auditoria", url: "/auditoria", icon: Activity },
  { title: "Sugestões", url: "/sugestoes", icon: MessageSquare },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

const WHATSAPP_SUPPORT_URL =
  "https://wa.me/5585991152749?text=Ol%C3%A1!%20Preciso%20de%20suporte%20com%20o%20SISLOTE.";

export function AppSidebar() {
  const location = useLocation();
  const { setOpenMobile } = useSidebar();
  const { user } = useAuth();
  const { canUseVendas, canUsePagamentos, canUseDespesas, canUseRelatorios, canUseAuditoria, canUsePlanos } = useLicenseFeatures();
  const isPlatformAdmin = user?.login?.toLowerCase() === "gcgean";
  const filteredMainItems = mainItems.filter((item) => {
    if (item.url === "/vendas") return canUseVendas;
    if (item.url === "/pagamentos") return canUsePagamentos;
    return true;
  });

  const isFinanceiroAtivo = location.pathname === "/despesas";
  const abaFinanceiroAtiva = new URLSearchParams(location.search).get("tab") || "visao-geral";
  const [financeiroAberto, setFinanceiroAberto] = useState(isFinanceiroAtivo);
  useEffect(() => {
    if (isFinanceiroAtivo) setFinanceiroAberto(true);
  }, [isFinanceiroAtivo]);
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

              {canUseDespesas && (
                <SidebarMenuItem>
                  <Collapsible open={financeiroAberto} onOpenChange={setFinanceiroAberto}>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-md text-base text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent transition-colors cursor-pointer",
                          isFinanceiroAtivo && "bg-sidebar-accent text-sidebar-primary font-medium"
                        )}
                      >
                        <Receipt className="h-5 w-5 shrink-0" />
                        <span>Financeiro</span>
                        <ChevronDown className={cn("ml-auto h-4 w-4 shrink-0 transition-transform", financeiroAberto && "rotate-180")} />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {financeiroSubItems.map((sub) => {
                          const ativo = isFinanceiroAtivo && abaFinanceiroAtiva === sub.tab;
                          return (
                            <SidebarMenuSubItem key={sub.tab}>
                              <SidebarMenuSubButton asChild isActive={ativo}>
                                <NavLink
                                  to={`/despesas${sub.tab === "visao-geral" ? "" : `?tab=${sub.tab}`}`}
                                  onClick={() => setOpenMobile(false)}
                                >
                                  <sub.icon className="h-4 w-4 shrink-0" />
                                  <span>{sub.title}</span>
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </Collapsible>
                </SidebarMenuItem>
              )}
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
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a
                    href={WHATSAPP_SUPPORT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-base text-[#25D366] hover:text-[#1ebe5d] hover:bg-sidebar-accent transition-colors"
                    onClick={() => setOpenMobile(false)}
                  >
                    <HeadphonesIcon className="h-5 w-5 shrink-0" />
                    <span>Suporte</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
