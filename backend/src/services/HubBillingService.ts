import crypto from "crypto";
import { AppDataSource } from "../db/data-source";
import { Empresa } from "../entities/Empresa";
import { getEffectiveFeatures } from "../config/license-features";

export interface HubAccessResult {
  allowed: boolean;
  reason?: string;
  features?: Record<string, unknown>;
  expiresAt?: string | null;
  daysLeft?: number | null;
  banner?: string | null;
  accessStatus?: string | null;
}

type HubAdminAuthResponse = {
  accessToken: string;
};

type RequestMethod = "GET" | "POST" | "PATCH";
type HubFeatureMeta = {
  daysLeft?: number | null;
  expiresAt?: string | null;
  accessStatus?: string | null;
  syncedAt?: string | null;
};

const NEGATIVE_LICENSE_REASONS = new Set([
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

function extractHubErrorMessage(rawBody: string, fallback: string) {
  try {
    const parsed = JSON.parse(rawBody) as {
      code?: unknown;
      message?: unknown;
      details?: unknown;
      correlationId?: unknown;
      path?: unknown;
    };
    const code = typeof parsed.code === "string" ? parsed.code : null;
    const message = typeof parsed.message === "string" ? parsed.message : null;
    const details = Array.isArray(parsed.details) ? parsed.details.join("; ") : null;
    const correlationId = typeof parsed.correlationId === "string" ? parsed.correlationId : null;
    const path = typeof parsed.path === "string" ? parsed.path : null;
    const suffix = [correlationId ? `correlationId=${correlationId}` : null, path ? `path=${path}` : null]
      .filter(Boolean)
      .join(" ");
    const base = [code, message, details].filter(Boolean).join(" - ") || fallback;
    return suffix ? `${base} (${suffix})` : base;
  } catch {
    return rawBody || fallback;
  }
}

let cachedAdminToken: string | null = null;
let cachedAdminTokenUntil = 0;

export class HubBillingService {
  private static readonly HUB_FEATURE_META_KEY = "__hubMeta";

  static isConfigured() {
    return hasHubConfig();
  }

  static getStoredDaysLeft(empresa: Empresa | null | undefined) {
    const features = empresa?.hub_features;
    if (!features || typeof features !== "object" || Array.isArray(features)) return null;
    const meta = (features as Record<string, unknown>)[this.HUB_FEATURE_META_KEY];
    if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
    const value = (meta as Record<string, unknown>).daysLeft;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  private static attachHubMeta(features: Record<string, unknown> | null | undefined, meta: HubFeatureMeta) {
    const base = { ...(features ?? {}) };
    base[this.HUB_FEATURE_META_KEY] = meta;
    return base;
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

  static async resolveAccess(payload: {
    document: string;
    personType: "PF" | "PJ";
    productId: string;
    name: string;
    email: string;
  }): Promise<Record<string, unknown>> {
    return this.requestApiKey<Record<string, unknown>>("POST", "/access/resolve", payload);
  }

  static async getAccessStatus(customerId: string, productId: string): Promise<Record<string, unknown>> {
    const query = new URLSearchParams({
      customerId,
      productId,
    });
    return this.requestApiKey<Record<string, unknown>>("GET", `/access/status?${query.toString()}`);
  }

  static async resolveExternalCustomer(document: string) {
    const clean = document.replace(/\D/g, "");
    return this.requestApiKey<Record<string, unknown>>(
      "GET",
      `/access/customers/resolve?document=${encodeURIComponent(clean)}`,
    );
  }

  static async upsertExternalCustomer(payload: {
    document: string;
    personType: "PF" | "PJ";
    name: string;
    email: string;
    phone?: string;
  }) {
    return this.requestApiKey<Record<string, unknown>>("POST", "/access/customers/upsert", payload);
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

  static async createCustomer(payload: Record<string, unknown>) {
    return this.requestAdmin<Record<string, unknown>>("POST", "/customers", payload);
  }

  static async findCustomerByDocument(document: string) {
    const clean = document.replace(/\D/g, "");
    return this.requestAdmin<{ id?: string; data?: Array<Record<string, unknown>> }>(
      "GET",
      `/customers?search=${encodeURIComponent(clean)}`,
    );
  }

  static async createSubscriptionCheckout(subscriptionId: string, payload: Record<string, unknown>) {
    return this.requestAdmin<Record<string, unknown>>(
      "POST",
      `/subscriptions/${encodeURIComponent(subscriptionId)}/checkout`,
      payload,
    );
  }

  static async changeSubscriptionPlan(subscriptionId: string, payload: Record<string, unknown>) {
    return this.requestAdmin<Record<string, unknown>>(
      "PATCH",
      `/subscriptions/${encodeURIComponent(subscriptionId)}/change-plan`,
      payload,
    );
  }

  static async getCustomerLicenses(customerId: string) {
    return this.requestAdmin<Array<Record<string, unknown>>>(
      "GET",
      `/customers/${encodeURIComponent(customerId)}/licenses`,
    );
  }

  static async getCharges(originType: "order" | "subscription", originId: string) {
    return this.requestAdmin<Record<string, unknown>>(
      "GET",
      `/payments/charges?originType=${encodeURIComponent(originType)}&originId=${encodeURIComponent(originId)}`,
    );
  }

  static async getProductPlans(productId: string) {
    return this.requestAdmin<Array<Record<string, unknown>>>(
      "GET",
      `/products/${encodeURIComponent(productId)}/plans`,
    );
  }

  static async getProduct(productId: string) {
    return this.requestAdmin<Record<string, unknown>>(
      "GET",
      `/products/${encodeURIComponent(productId)}`,
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
        daysLeft: this.getStoredDaysLeft(empresa),
      };
    }

    if (!empresa.hub_customer_id || (!empresa.hub_product_code && !process.env.HUB_BILLING_PRODUCT_ID)) {
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
        daysLeft: null,
      };
    }

    const now = Date.now();
    if (empresa.hub_cache_until && empresa.hub_cache_until.getTime() > now) {
      const cachedDaysLeft = this.getStoredDaysLeft(empresa);
      if (cachedDaysLeft !== null) {
        return {
          synced: true,
          allowed: !this.isLicenseDenied(empresa),
          reason: empresa.hub_license_reason || empresa.hub_license_status || undefined,
          features: empresa.hub_features ?? {},
          daysLeft: cachedDaysLeft,
        };
      }
    }

    const access = await this.resolveEmpresaAccess(empresa);

    empresa.hub_license_status = access.accessStatus || (access.allowed ? "licensed" : access.reason || "license_inactive");
    empresa.hub_license_reason = access.allowed ? null : access.reason || access.accessStatus || "license_inactive";
    empresa.hub_features = this.attachHubMeta(access.features, {
      daysLeft: access.daysLeft ?? null,
      expiresAt: access.expiresAt ?? null,
      accessStatus: access.accessStatus ?? null,
      syncedAt: new Date().toISOString(),
    });
    empresa.hub_last_sync = new Date();
    empresa.hub_cache_until = new Date(Date.now() + (access.allowed ? 60_000 : 10_000));

    if (access.expiresAt) {
      const parsed = new Date(access.expiresAt);
      if (!Number.isNaN(parsed.getTime())) {
        empresa.hub_expires_at = parsed;
        empresa.data_vencimento = parsed.toISOString().slice(0, 10);
      }
    }

    const featurePlan = access.features?.plan ?? (access as unknown as Record<string, unknown>).planCode;
    if (typeof featurePlan === "string" && featurePlan.trim()) {
      empresa.plano = featurePlan.trim();
    }

    empresa.hub_features = getEffectiveFeatures(empresa.plano, empresa.hub_features);

    await AppDataSource.getRepository(Empresa).save(empresa);

    return {
      synced: true,
      allowed: access.allowed,
      reason: access.reason || access.accessStatus,
      features: access.features ?? {},
      expiresAt: access.expiresAt ?? null,
      daysLeft: access.daysLeft ?? null,
      banner: access.banner ?? null,
      accessStatus: access.accessStatus ?? null,
    };
  }

  private static async resolveEmpresaAccess(empresa: Empresa): Promise<HubAccessResult> {
    const productId = process.env.HUB_BILLING_PRODUCT_ID || "";
    if (productId) {
      const statusData = await this.getAccessStatus(empresa.hub_customer_id!, productId);
      const canAccess = Boolean((statusData as { canAccess?: unknown }).canAccess);
      const accessStatus =
        typeof (statusData as { accessStatus?: unknown }).accessStatus === "string"
          ? String((statusData as { accessStatus?: string }).accessStatus)
          : null;
      const reasonRaw = (statusData as { reason?: unknown }).reason;
      const reason = typeof reasonRaw === "string" ? reasonRaw : accessStatus || "license_inactive";
      const daysLeftRaw = (statusData as { daysLeft?: unknown }).daysLeft;
      const daysLeft = typeof daysLeftRaw === "number" ? daysLeftRaw : null;
      const bannerRaw = (statusData as { banner?: unknown }).banner;
      const banner = typeof bannerRaw === "string" ? bannerRaw : null;
      const trialEndAtRaw = (statusData as { trialEndAt?: unknown }).trialEndAt;
      const licenseEndAtRaw = (statusData as { licenseEndAt?: unknown }).licenseEndAt;
      const expiresAtRaw =
        typeof trialEndAtRaw === "string"
          ? trialEndAtRaw
          : typeof licenseEndAtRaw === "string"
            ? licenseEndAtRaw
            : null;
      const featuresRaw = (statusData as { features?: unknown }).features;
      const features =
        featuresRaw && typeof featuresRaw === "object" && !Array.isArray(featuresRaw)
          ? (featuresRaw as Record<string, unknown>)
          : undefined;

      return {
        allowed: canAccess,
        reason: canAccess ? reason : reason,
        features,
        expiresAt: expiresAtRaw,
        daysLeft,
        banner,
        accessStatus,
      };
    }

    return this.checkAccess(empresa.hub_customer_id!, empresa.hub_product_code || "");
  }

  private static async requestApiKey<T>(method: RequestMethod, endpoint: string, body?: Record<string, unknown>) {
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
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 429) {
      throw new Error("Hub Billing rate limit atingido. Tente novamente em alguns segundos.");
    }

    if (!response.ok) {
      const raw = await response.text();
      const parsedMessage = extractHubErrorMessage(raw, "Erro não detalhado");
      if (response.status === 401) {
        throw new Error(`Hub Billing API key inválida ou revogada (${response.status}): ${parsedMessage}`);
      }
      throw new Error(`Hub Billing API Key request falhou (${response.status}): ${parsedMessage}`);
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

    if (response.status === 429) {
      throw new Error("Hub Billing rate limit atingido. Tente novamente em alguns segundos.");
    }

    if (!response.ok) {
      const raw = await response.text();
      const parsedMessage = extractHubErrorMessage(raw, "Erro não detalhado");
      throw new Error(`Hub Billing admin request falhou (${response.status}): ${parsedMessage}`);
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
