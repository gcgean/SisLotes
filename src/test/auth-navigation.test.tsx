import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AuthProvider } from "@/hooks/useAuth";
import { sanitizeAuthRedirect } from "@/lib/auth-redirect";

function LocationView() {
  const location = useLocation();
  return <span>{location.pathname}{location.search}</span>;
}

describe("navegação autenticada por link direto", () => {
  beforeEach(() => localStorage.clear());

  it("aguarda a hidratação e mantém a rota interna quando há sessão salva", async () => {
    localStorage.setItem("token", "token-teste");
    localStorage.setItem("usuario", JSON.stringify({ id_usuario: 1, login: "teste", user_master: false }));

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/despesas?tab=contas"]}>
          <Routes>
            <Route path="/despesas" element={<RequireAuth><LocationView /></RequireAuth>} />
            <Route path="/login" element={<span>Login</span>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText("/despesas?tab=contas")).toBeInTheDocument());
    expect(screen.queryByText("Login")).not.toBeInTheDocument();
  });

  it("preserva o destino completo ao enviar uma sessão ausente ao login", async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/relatorios?r=contas-pagar"]}>
          <Routes>
            <Route path="/relatorios" element={<RequireAuth><span>Relatório</span></RequireAuth>} />
            <Route path="/login" element={<LocationView />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText("/login?redirect=%2Frelatorios%3Fr%3Dcontas-pagar")).toBeInTheDocument());
  });

  it("rejeita redirecionamento externo", () => {
    expect(sanitizeAuthRedirect("//site-malicioso.example")).toBe("/");
    expect(sanitizeAuthRedirect("https://site-malicioso.example")).toBe("/");
    expect(sanitizeAuthRedirect("/relatorios?r=fluxo-caixa")).toBe("/relatorios?r=fluxo-caixa");
  });
});
