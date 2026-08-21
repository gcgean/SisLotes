import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  MapPin,
  Grid3X3,
  ShoppingCart,
  CreditCard,
  Wallet,
  ReceiptText,
  ScrollText,
  FileText,
} from "lucide-react";

interface SubItem {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
}

interface NavItem {
  title: string;
  icon: typeof LayoutDashboard;
  url?: string;
  submenu?: SubItem[];
}

// Financeiro tem muitas telas — no mobile só as mais usadas aparecem no
// submenu flutuante; o resto continua acessível pela tela de Financeiro em si.
const navItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Loteamentos", url: "/loteamentos", icon: MapPin },
  { title: "Lotes", url: "/lotes", icon: Grid3X3 },
  { title: "Vendas", url: "/vendas", icon: ShoppingCart },
  {
    title: "Financeiro",
    icon: Wallet,
    submenu: [
      { title: "Fluxo de Caixa", url: "/despesas?tab=visao-geral", icon: LayoutDashboard },
      { title: "Contas a Receber", url: "/pagamentos", icon: CreditCard },
      { title: "Contas a Pagar", url: "/despesas?tab=despesas", icon: ReceiptText },
      { title: "Extrato / Lançamento", url: "/despesas?tab=lancamentos", icon: ScrollText },
    ],
  },
  { title: "Relatórios", url: "/relatorios", icon: FileText },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState<string | null>(null);

  const financeiroAtivo = location.pathname === "/despesas" || location.pathname === "/pagamentos";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background border-t border-border safe-bottom">
      <div className="flex items-stretch overflow-x-auto">
        {navItems.map((item) => {
          if (item.submenu) {
            return (
              <Popover
                key={item.title}
                open={aberto === item.title}
                onOpenChange={(open) => setAberto(open ? item.title : null)}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex flex-col items-center justify-center gap-0.5 px-3 py-2 flex-1 min-w-[56px] text-muted-foreground transition-colors hover:text-foreground",
                      financeiroAtivo && "text-primary",
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="text-[10px] font-medium leading-none">{item.title}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="top"
                  align="center"
                  sideOffset={10}
                  className="w-56 p-1.5"
                >
                  <div className="flex flex-col">
                    {item.submenu.map((sub) => (
                      <button
                        key={sub.url}
                        type="button"
                        onClick={() => {
                          setAberto(null);
                          navigate(sub.url);
                        }}
                        className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        <sub.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        {sub.title}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            );
          }

          return (
            <NavLink
              key={item.url}
              to={item.url!}
              end={item.url === "/"}
              className="flex flex-col items-center justify-center gap-0.5 px-3 py-2 flex-1 min-w-[56px] text-muted-foreground transition-colors hover:text-foreground"
              activeClassName="text-primary"
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="text-[10px] font-medium leading-none">{item.title}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
