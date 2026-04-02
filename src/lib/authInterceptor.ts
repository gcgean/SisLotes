// ─── Interceptor global de autenticação ──────────────────────────────────────
//
// Instalado em main.tsx antes de qualquer render.
// Responsabilidades:
//   1. A cada 5 min verifica se o token expira nos próximos 30 min e renova silenciosamente.
//   2. Se o token já expirou no momento de uma chamada /api/, tenta renovar antes de enviar.
//   3. Se a resposta for 401, tenta renovar e retentar a requisição uma vez.
//   4. Se não conseguir renovar em nenhum cenário, chama onForceLogout().

const API_REFRESH_URL = "/api/auth/refresh";
const LICENSE_REDIRECT_PATH = "/planos";

const LICENSE_BLOCK_REASONS = new Set([
  "not_mapped",
  "hub_mapping_missing",
  "blocked",
  "trial_expired",
  "customer_blocked",
  "no_license",
  "product_not_found",
  "license_suspended",
  "license_expired",
  "license_revoked",
  "license_inactive",
]);

/** Renova quando restar menos de 30 minutos */
const REFRESH_THRESHOLD_MS = 30 * 60 * 1000;

/** Intervalo de verificação proativa */
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Decodifica o campo `exp` do payload JWT (sem verificação de assinatura) */
function getTokenExpMs(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1])) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

// ─── Estado do módulo ─────────────────────────────────────────────────────────

let _originalFetch: typeof window.fetch;
let _refreshInFlight: Promise<string | null> | null = null;
let _onForceLogout: (() => void) | null = null;

function safeJsonParse<T = unknown>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ─── Refresh ─────────────────────────────────────────────────────────────────

async function doRefresh(currentToken: string): Promise<string | null> {
  // Coalescing: se já há um refresh em andamento, reutiliza a mesma promise
  if (_refreshInFlight) return _refreshInFlight;

  _refreshInFlight = (async (): Promise<string | null> => {
    try {
      const res = await _originalFetch(API_REFRESH_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      if (!res.ok) return null;

      const data = (await res.json()) as { token?: string };
      if (data.token) {
        localStorage.setItem("token", data.token);
        // Dispara evento para que useAuth sincronize o estado React
        window.dispatchEvent(new CustomEvent("auth:token-refreshed", { detail: { token: data.token } }));
        return data.token;
      }
      return null;
    } catch {
      return null;
    } finally {
      _refreshInFlight = null;
    }
  })();

  return _refreshInFlight;
}

// ─── Instalação ───────────────────────────────────────────────────────────────

export function installAuthInterceptor(onForceLogout: () => void): void {
  _originalFetch = window.fetch.bind(window);
  _onForceLogout = onForceLogout;

  // ── Verificação proativa a cada 5 minutos ──────────────────────────────────
  setInterval(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const exp = getTokenExpMs(token);
    if (exp === null) return;

    const msLeft = exp - Date.now();

    // Token prestes a expirar (mas ainda válido) → renova em background
    if (msLeft > 0 && msLeft < REFRESH_THRESHOLD_MS) {
      doRefresh(token).catch(() => {});
    }

    // Token já expirado e usuário ainda "logado" → força logout
    if (msLeft <= 0) {
      _onForceLogout?.();
    }
  }, CHECK_INTERVAL_MS);

  // ── Patch de window.fetch ──────────────────────────────────────────────────
  window.fetch = async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;

    // Não intercepta a própria rota de refresh (evita loop infinito)
    // Nem chamadas externas (sem /api/)
    if (!url.includes("/api/") || url.includes(API_REFRESH_URL)) {
      return _originalFetch(input, init);
    }

    let token = localStorage.getItem("token");

    // Se o token já expirou, tenta renovar ANTES de enviar a requisição
    if (token) {
      const exp = getTokenExpMs(token);
      if (exp !== null && exp - Date.now() <= 0) {
        const renewed = await doRefresh(token);
        if (renewed) {
          token = renewed;
        } else {
          _onForceLogout?.();
          return new Response(JSON.stringify({ error: "Sessão expirada. Faça login novamente." }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
    }

    // Faz a requisição normalmente
    // (o getAuthHeaders() de cada página já injeta Authorization, mas se não tiver, injetamos aqui)
    let reqInit = init;
    if (token) {
      const headers = new Headers((init?.headers as HeadersInit | undefined) ?? {});
      if (!headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
        reqInit = { ...init, headers };
      }
    }

    const response = await _originalFetch(input, reqInit);

    // 403 por licença: força ida para /planos
    if (response.status === 403 && token && !url.includes("/api/auth/login")) {
      try {
        const raw = await response.clone().text();
        const payload = safeJsonParse<{ reason?: unknown }>(raw);
        const reason = typeof payload?.reason === "string" ? payload.reason : null;
        if (reason && LICENSE_BLOCK_REASONS.has(reason.toLowerCase())) {
          const currentPath = window.location.pathname;
          if (!currentPath.startsWith(LICENSE_REDIRECT_PATH)) {
            const target = `${LICENSE_REDIRECT_PATH}?reason=${encodeURIComponent(reason)}`;
            window.location.replace(target);
          }
        }
      } catch {
        // ignora falhas de parse
      }
    }

    // Se recebeu 401, tenta renovar o token e retentar UMA vez
    if (response.status === 401 && token) {
      const renewed = await doRefresh(token);
      if (renewed) {
        const retryHeaders = new Headers((init?.headers as HeadersInit | undefined) ?? {});
        retryHeaders.set("Authorization", `Bearer ${renewed}`);
        return _originalFetch(input, { ...init, headers: retryHeaders });
      } else {
        // Não conseguiu renovar → força logout
        _onForceLogout?.();
      }
    }

    return response;
  };
}
