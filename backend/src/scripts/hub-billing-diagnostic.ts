import "dotenv/config";

type StepResult = {
  name: string;
  ok: boolean;
  status?: number;
  detail?: string;
  durationMs: number;
};

function now() {
  return Date.now();
}

function mask(value: string) {
  if (!value) return "";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

async function parseJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function run() {
  const baseUrl = (process.env.HUB_BILLING_BASE_URL || "").replace(/\/+$/, "");
  const email = process.env.HUB_BILLING_ADMIN_EMAIL || "";
  const password = process.env.HUB_BILLING_ADMIN_PASSWORD || "";
  const apiKey = process.env.HUB_BILLING_API_KEY || "";
  const testCustomerId = process.env.HUB_BILLING_TEST_CUSTOMER_ID || "00000000-0000-0000-0000-000000000001";

  if (!baseUrl) {
    console.error("HUB_BILLING_BASE_URL não configurado");
    process.exit(2);
  }

  const steps: StepResult[] = [];

  const tHealth = now();
  const healthResp = await fetch(`${baseUrl}/health`, { method: "GET" });
  const healthBody = await parseJson(healthResp);
  steps.push({
    name: "health",
    ok: healthResp.ok,
    status: healthResp.status,
    detail: healthBody ? JSON.stringify(healthBody) : "",
    durationMs: now() - tHealth,
  });

  const tLogin = now();
  let loginOk = false;
  let accessToken: string | null = null;
  if (email && password) {
    const loginResp = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const loginBody = await parseJson(loginResp);
    const token = loginBody && typeof loginBody === "object" ? (loginBody as Record<string, unknown>).accessToken : null;
    if (typeof token === "string" && token.length > 10) {
      accessToken = token;
      loginOk = true;
    }
    steps.push({
      name: "login",
      ok: loginResp.ok && loginOk,
      status: loginResp.status,
      detail: loginBody ? JSON.stringify(loginBody) : "",
      durationMs: now() - tLogin,
    });
  } else {
    steps.push({
      name: "login",
      ok: false,
      detail: "Credenciais admin ausentes no .env",
      durationMs: now() - tLogin,
    });
  }

  const tAccess = now();
  if (apiKey) {
    const accessResp = await fetch(`${baseUrl}/access/entitlements/${encodeURIComponent(testCustomerId)}`, {
      method: "GET",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
    });
    const accessBody = await parseJson(accessResp);
    const accepted = accessResp.status !== 401 && accessResp.status !== 403;
    steps.push({
      name: "access_api_key",
      ok: accepted,
      status: accessResp.status,
      detail: accessBody ? JSON.stringify(accessBody) : "",
      durationMs: now() - tAccess,
    });
  } else {
    steps.push({
      name: "access_api_key",
      ok: false,
      detail: "HUB_BILLING_API_KEY ausente no .env",
      durationMs: now() - tAccess,
    });
  }

  const summary = {
    baseUrl,
    credentials: {
      adminEmail: email,
      adminPassword: password ? "********" : "",
      apiKey: mask(apiKey),
      hasTokenFromLogin: Boolean(accessToken),
    },
    steps,
    success: steps.every((s) => s.ok),
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.success ? 0 : 1);
}

run().catch((error) => {
  console.error("Falha no diagnóstico do Hub Billing");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

