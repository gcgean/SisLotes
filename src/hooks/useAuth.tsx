import { createContext, ReactNode, useContext, useEffect, useState } from "react";

interface AuthUser {
  id_usuario: number;
  login: string;
  user_master: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (params: { token: string; usuario: AuthUser }) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "token";
const USER_KEY = "usuario";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(TOKEN_KEY);
    const storedUser = window.localStorage.getItem(USER_KEY);

    setToken(storedToken);

    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser) as AuthUser;
        setUser(parsed);
      } catch {
        setUser(null);
      }
    }
  }, []);

  function handleLogin(params: { token: string; usuario: AuthUser }) {
    setToken(params.token);
    setUser(params.usuario);

    window.localStorage.setItem(TOKEN_KEY, params.token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(params.usuario));
  }

  function handleLogout() {
    setToken(null);
    setUser(null);

    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);

    fetch("/api/auth/logout", {
      method: "POST",
    }).catch(() => {
      // Ignorar erros de logout
    });
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login: handleLogin,
        logout: handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }

  return ctx;
}

