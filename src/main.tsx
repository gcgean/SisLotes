import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installAuthInterceptor } from "./lib/authInterceptor";

// Instala o interceptor ANTES de qualquer componente ser renderizado.
// Se o token expirar e não conseguir renovar, limpa a sessão e redireciona para login.
installAuthInterceptor(() => {
  localStorage.removeItem("token");
  localStorage.removeItem("usuario");
  window.location.replace("/login");
});

createRoot(document.getElementById("root")!).render(<App />);
