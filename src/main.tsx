import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installAuthInterceptor } from "./lib/authInterceptor";

// ── Tema: garante que o padrão é sempre CLARO ────────────────────────────────
(function initTheme() {
  const THEME_KEY = "sislote-theme";
  const stored = localStorage.getItem(THEME_KEY);
  // Normaliza: se não houver valor ou for "system", força light
  const theme = (stored === "dark") ? "dark" : "light";
  if (!stored || stored === "system") {
    localStorage.setItem(THEME_KEY, "light");
  }
  // Aplica IMEDIATAMENTE a classe correta no <html> antes do React renderizar
  // Isso elimina o flash de tela preta (FOUC)
  const html = document.documentElement;
  html.classList.remove("dark", "light");
  html.classList.add(theme);
})();

// ── Interceptor de autenticação ───────────────────────────────────────────────
// Se o token expirar e não conseguir renovar, limpa a sessão e redireciona para login.
installAuthInterceptor(() => {
  localStorage.removeItem("token");
  localStorage.removeItem("usuario");
  window.location.replace("/login");
});

// ── Dev hardening: evita tela branca por cache de SW antigo no localhost ────
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister().catch(() => undefined);
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
