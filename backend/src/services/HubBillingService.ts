import crypto from "crypto";
import { AppDataSource } from "../db/data-source";
import { Empresa } from "../entities/Empresa";
import { getEffectiveFeatures } from "../config/license-features";

export interface HubAccessResult {
  allowed: boolean;
  reason?: string;
  features?: Record<string, unknown>;
  expiresAt?: string | null;
}

type HubAdminAuthResponse = {
  accessToken: string;
};

type RequestMethod = "GET" | "POST";

const NEGATIVE_LICENSE_REASONS = new Set([
  "customer_blocked",
  "no_license",
  "license_suspended",
  "license_expired",
  "license_revoked",
  "license_inactive",
]);

function getBaseUrl() {
  const raw = process.env.HUB_BILLING_BASE_URL || "";
  return raw.replace(/\/+$/, "");
}

function getApiKey() {
  return process.env.HUB_BILLING_API_KEY || "";
}

function hasHubConfig() {
  return Boolean(getBaseUrl() && getApiKey());
}

let cachedAdminToken: string | null = null;
let cachedAdminTokenUntil = 0;

export class HubBillingService {
  static isConfigured() {
    return hasHubConfig();
  }

  static isLicenseDenied(empresa: Empresa | null | undefined) {
    const status = (empresa?.hub_license_status || "").toLowerCase();
    return NEGATIVE_LICENSE_REASONS.has(status);
  }

  static getLicenseMessage(empresa: Empresa | null | undefined) {
    const reason = empresa?.hub_license_reason || empresa?.hub_license_status || "license_inactive";
    return `Licença indisponível (${reason}). Regularize seu plano para continuar.`;
  }

  static async checkAccess(customerId: string, productCode: string): Promise<HubAccessResult> {
    const response = await this.requestApiKey<HubAccessResult>(
      "GET",
      `/access/customer/${encodeURIComponent(customerId)}/product/${encodeURIComponent(productCode)}`,
    );
    return response;
  }

  static async getEntitlements(customerId: string) {
    return this.requestApiKey<{ products?: Array<Record<string, unknown>> }>(
      "GET",
      `/access/entitlements/${encodeURIComponent(customerId)}`,
    );
  }

  static async createOrder(payload: Record<string, unknown>) {
    return this.requestAdmin<Record<string, unknown>>("POST", "/orders", payload);
  }

  static async createCheckout(orderId: string, payload: Record<string, unknown>) {
    return this.requestAdmin<Record<string, unknown>>("POST", `/orders/${encodeURIComponent(orderId)}/checkout`, payload);
  }

  static async createSubscription(payload: Record<string, unknown>) {
    return this.requestAdmin<Record<string, unknown>>("POST", "/subscriptions", payload);
  }

  static async createSubscriptionCheckout(subscriptionId: string, payload: Record<string, unknown>) {
    return this.requestAdmin<Record<string, unknown>>(
      "POST",
      `/subscriptions/${encodeURIComponent(subscriptionId)}/checkout`,
      payload,
    );
  }

  static async getCharges(originType: "order" | "subscription", originId: string) {
    return this.requestAdmin<Record<string, unknown>>(
      "GET",
      `/payments/charges?originType=${encodeURIComponent(originType)}&originId=${encodeURIComponent(originId)}`,
    );
  }

  static verifyWebhookSignature(rawBody: string, signatureHeader?: string | string[] | null) {
    const secret = process.env.HUB_BILLING_WEBHOOK_SECRET || "";
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    if (!secret || !signature) return false;
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    const received = String(signature).replace("sha256=", "");
    return expected === received;
  }

  static async syncEmpresaLicense(empresa: Empresa) {
    if (!this.isConfigured()) {
      return {
        synced: false,
        allowed: empresa.ativo,
        reason: "hub_not_configured",
        features: empresa.hub_features ?? {},
      };
    }

    if (!empresa.hub_customer_id || !empresa.hub_product_code) {
      empresa.hub_license_status = "not_mapped";
      empresa.hub_license_reason = "hub_mapping_missing";
      empresa.hub_last_sync = new Date();
      empresa.hub_cache_until = new Date(Date.now() + 10_000);
      await AppDataSource.getRepository(Empresa).save(empresa);
      return {
        synced: true,
        allowed: false,
        reason: "hub_mapping_missing",
        features: {},
      };
    }

    const now = Date.now();
    if (empresa.hub_cache_until && empresa.hub_cache_until.getTime() > now) {
      return {
        synced: true,
        allowed: !this.isLicenseDenied(empresa),
        reason: empresa.hub_license_reason || empresa.hub_license_status || undefined,
        features: empresa.hub_features ?? {},
      };
    }

    const access = await this.checkAccess(empresa.hub_customer_id, empresa.hub_product_code);

    empresa.hub_license_status = access.allowed ? "active" : access.reason || "license_inactive";
    empresa.hub_license_reason = access.allowed ? null : access.reason || "license_inactive";
    empresa.hub_features = access.features ?? {};
    empresa.hub_last_sync = new Date();
    empresa.hub_cache_until = new Date(Date.now() + (access.allowed ? 60_000 : 10_000));

    if (access.expiresAt) {
      const parsed = new Date(access.expiresAt);
      if (!Number.isNaN(parsed.getTime())) {
        empresa.hub_expires_at = parsed;
        empresa.data_vencimento = parsed.toISOString().slice(0, 10);
      }
    }

    const featurePlan = access.features?.plan;
    if (typeof featurePlan === "string" && featurePlan.trim()) {
      empresa.plano = featurePlan.trim();
    }

    empresa.hub_features = getEffectiveFeatures(empresa.plano, empresa.hub_features);

    await AppDataSource.getRepository(Empresa).save(empresa);

    return {
      synced: true,
      allowed: access.allowed,
      reason: access.reason,
      features: access.features ?? {},
      expiresAt: access.expiresAt ?? null,
    };
  }

  private static async requestApiKey<T>(method: RequestMethod, endpoint: string) {
    const base = getBaseUrl();
    const apiKey = getApiKey();
    if (!base || !apiKey) {
      throw new Error("Hub Billing não configurado");
    }

    const response = await fetch(`${base}${endpoint}`, {
      method,
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Hub Billing API Key request falhou (${response.status}): ${body}`);
    }

    return response.json() as Promise<T>;
  }

  private static async requestAdmin<T>(method: RequestMethod, endpoint: string, body?: Record<string, unknown>) {
    const base = getBaseUrl();
    if (!base) throw new Error("Hub Billing base URL não configurada");

    const token = await this.getAdminToken();
    const response = await fetch(`${base}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const raw = await response.text();
      throw new Error(`Hub Billing admin request falhou (${response.status}): ${raw}`);
    }

    return response.json() as Promise<T>;
  }

  private static async getAdminToken() {
    if (cachedAdminToken && cachedAdminTokenUntil > Date.now()) {
      return cachedAdminToken;
    }

    const base = getBaseUrl();
    const email = process.env.HUB_BILLING_ADMIN_EMAIL || "";
    const password = process.env.HUB_BILLING_ADMIN_PASSWORD || "";

    if (!base || !email || !password) {
      throw new Error("Credenciais admin do Hub Billing não configuradas");
    }

    const response = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const raw = await response.text();
      throw new Error(`Falha ao autenticar no Hub Billing (${response.status}): ${raw}`);
    }

    const data = (await response.json()) as HubAdminAuthResponse;
    cachedAdminToken = data.accessToken;
    cachedAdminTokenUntil = Date.now() + 7 * 60 * 1000;
    return cachedAdminToken;
  }
}
