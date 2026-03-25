import { NavLink } from "@/components/NavLink";
import {
  LayoutDashboard,
  Users,
  MapPin,
  Grid3X3,
  ShoppingCart,
  CreditCard,
} from "lucide-react";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Loteamentos", url: "/loteamentos", icon: MapPin },
  { title: "Lotes", url: "/lotes", icon: Grid3X3 },
  { title: "Vendas", url: "/vendas", icon: ShoppingCart },
  { title: "Pagamentos", url: "/pagamentos", icon: CreditCard },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background border-t border-border safe-bottom">
      <div className="flex items-stretch overflow-x-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === "/"}
            className="flex flex-col items-center justify-center gap-0.5 px-3 py-2 flex-1 min-w-[56px] text-muted-foreground transition-colors hover:text-foreground"
            activeClassName="text-primary"
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span className="text-[10px] font-medium leading-none">{item.title}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
