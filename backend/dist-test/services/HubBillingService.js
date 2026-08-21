"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HubBillingService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const data_source_1 = require("../db/data-source");
const Empresa_1 = require("../entities/Empresa");
const license_features_1 = require("../config/license-features");
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
function extractHubErrorMessage(rawBody, fallback) {
    try {
        const parsed = JSON.parse(rawBody);
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
    }
    catch {
        return rawBody || fallback;
    }
}
let cachedAdminToken = null;
let cachedAdminTokenUntil = 0;
class HubBillingService {
    static isPlanControlDisabled(empresa) {
        return Boolean(empresa?.ignorar_controle_planos);
    }
    static isConfigured() {
        return hasHubConfig();
    }
    static getStoredDaysLeft(empresa) {
        const features = empresa?.hub_features;
        if (!features || typeof features !== "object" || Array.isArray(features))
            return null;
        const meta = features[this.HUB_FEATURE_META_KEY];
        if (!meta || typeof meta !== "object" || Array.isArray(meta))
            return null;
        const value = meta.daysLeft;
        return typeof value === "number" && Number.isFinite(value) ? value : null;
    }
    static getStoredQuantity(empresa) {
        const features = empresa?.hub_features;
        if (!features || typeof features !== "object" || Array.isArray(features))
            return null;
        const meta = features[this.HUB_FEATURE_META_KEY];
        if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
            const direct = features.quantity;
            return typeof direct === "number" && Number.isFinite(direct) ? direct : null;
        }
        const value = meta.quantity;
        return typeof value === "number" && Number.isFinite(value) ? value : null;
    }
    static withHubMeta(features, meta) {
        const base = { ...(features ?? {}) };
        base[this.HUB_FEATURE_META_KEY] = meta;
        return base;
    }
    static isLicenseDenied(empresa) {
        if (this.isPlanControlDisabled(empresa))
            return false;
        const status = (empresa?.hub_license_status || "").toLowerCase();
        return NEGATIVE_LICENSE_REASONS.has(status);
    }
    static getLicenseMessage(empresa) {
        const reason = empresa?.hub_license_reason || empresa?.hub_license_status || "license_inactive";
        return `Licença indisponível (${reason}). Regularize seu plano para continuar.`;
    }
    static async checkAccess(customerId, productCode) {
        const response = await this.requestApiKey("GET", `/access/customer/${encodeURIComponent(customerId)}/product/${encodeURIComponent(productCode)}`);
        return response;
    }
    static async resolveAccess(payload) {
        return this.requestApiKey("POST", "/access/resolve", payload);
    }
    static async getAccessStatus(customerId, productId) {
        const query = new URLSearchParams({
            customerId,
            productId,
        });
        return this.requestApiKey("GET", `/access/status?${query.toString()}`);
    }
    static async resolveExternalCustomer(document) {
        const clean = document.replace(/\D/g, "");
        return this.requestApiKey("GET", `/access/customers/resolve?document=${encodeURIComponent(clean)}`);
    }
    static async upsertExternalCustomer(payload) {
        return this.requestApiKey("POST", "/access/customers/upsert", payload);
    }
    static async getEntitlements(customerId) {
        return this.requestApiKey("GET", `/access/entitlements/${encodeURIComponent(customerId)}`);
    }
    static async createOrder(payload) {
        return this.requestAdmin("POST", "/orders", payload);
    }
    static async createCheckout(orderId, payload) {
        return this.requestAdmin("POST", `/orders/${encodeURIComponent(orderId)}/checkout`, payload);
    }
    static async createSubscription(payload) {
        return this.requestAdmin("POST", "/subscriptions", payload);
    }
    static async createCustomer(payload) {
        return this.requestAdmin("POST", "/customers", payload);
    }
    static async findCustomerByDocument(document) {
        const clean = document.replace(/\D/g, "");
        return this.requestAdmin("GET", `/customers?search=${encodeURIComponent(clean)}`);
    }
    static async createSubscriptionCheckout(subscriptionId, payload) {
        return this.requestAdmin("POST", `/subscriptions/${encodeURIComponent(subscriptionId)}/checkout`, payload);
    }
    /**
     * Checkout de cartão com recorrência nativa do gateway (Stripe Subscriptions):
     * o cliente cadastra o cartão uma vez e o gateway cobra sozinho todo ciclo,
     * sem precisar gerar um novo link a cada vencimento.
     */
    static async createRecurringCheckout(subscriptionId, payload = {}) {
        return this.requestAdmin("POST", `/subscriptions/${encodeURIComponent(subscriptionId)}/recurring-checkout`, payload);
    }
    static async cancelSubscription(subscriptionId, payload) {
        return this.requestAdmin("PATCH", `/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, { immediate: false, ...payload });
    }
    static async changeSubscriptionPlan(subscriptionId, payload) {
        return this.requestAdmin("PATCH", `/subscriptions/${encodeURIComponent(subscriptionId)}/change-plan`, payload);
    }
    static async getCustomerLicenses(customerId) {
        return this.requestAdmin("GET", `/customers/${encodeURIComponent(customerId)}/licenses`);
    }
    static async getCharges(originType, originId) {
        return this.requestAdmin("GET", `/payments/charges?originType=${encodeURIComponent(originType)}&originId=${encodeURIComponent(originId)}`);
    }
    static async getProductPlans(productId) {
        try {
            return await this.requestApiKey("GET", `/access/products/${encodeURIComponent(productId)}/plans`);
        }
        catch {
            return this.requestAdmin("GET", `/products/${encodeURIComponent(productId)}/plans`);
        }
    }
    static async getProduct(productId) {
        return this.requestAdmin("GET", `/products/${encodeURIComponent(productId)}`);
    }
    static verifyWebhookSignature(rawBody, signatureHeader) {
        const secret = process.env.HUB_BILLING_WEBHOOK_SECRET || "";
        const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
        if (!secret || !signature)
            return false;
        const expected = crypto_1.default.createHmac("sha256", secret).update(rawBody).digest("hex");
        const received = String(signature).replace("sha256=", "");
        return expected === received;
    }
    static async syncEmpresaLicense(empresa) {
        if (this.isPlanControlDisabled(empresa)) {
            return {
                synced: false,
                allowed: true,
                reason: "plan_control_disabled",
                features: empresa.hub_features ?? {},
                daysLeft: null,
                expiresAt: null,
            };
        }
        if (!this.isConfigured()) {
            const storedDaysLeft = this.getStoredDaysLeft(empresa);
            // Fallback: calcular dias restantes a partir de hub_expires_at ou data_vencimento
            const effectiveDaysLeft = storedDaysLeft ?? (() => {
                const expiry = empresa.hub_expires_at
                    ?? (empresa.data_vencimento ? new Date(empresa.data_vencimento + "T23:59:59") : null);
                if (!expiry)
                    return null;
                const msLeft = expiry.getTime() - Date.now();
                return msLeft > 0 ? Math.ceil(msLeft / (1000 * 60 * 60 * 24)) : 0;
            })();
            const effectiveExpiresAt = empresa.hub_expires_at?.toISOString()
                ?? (empresa.data_vencimento ? new Date(empresa.data_vencimento + "T23:59:59").toISOString() : null);
            return {
                synced: false,
                allowed: empresa.ativo,
                reason: "hub_not_configured",
                features: empresa.hub_features ?? {},
                quantity: this.getStoredQuantity(empresa),
                planCode: empresa.plano ?? null,
                planName: null,
                daysLeft: effectiveDaysLeft,
                expiresAt: effectiveExpiresAt,
            };
        }
        if (!empresa.hub_customer_id || (!empresa.hub_product_code && !process.env.HUB_BILLING_PRODUCT_ID)) {
            empresa.hub_license_status = "not_mapped";
            empresa.hub_license_reason = "hub_mapping_missing";
            empresa.hub_last_sync = new Date();
            empresa.hub_cache_until = new Date(Date.now() + 10000);
            await data_source_1.AppDataSource.getRepository(Empresa_1.Empresa).save(empresa);
            return {
                synced: true,
                allowed: false,
                reason: "hub_mapping_missing",
                features: {},
                quantity: null,
                planCode: null,
                planName: null,
                daysLeft: null,
            };
        }
        const now = Date.now();
        if (empresa.hub_cache_until && empresa.hub_cache_until.getTime() > now) {
            const cachedDaysLeft = this.getStoredDaysLeft(empresa);
            const cachedQuantity = this.getStoredQuantity(empresa);
            if (cachedQuantity !== null) {
                return {
                    synced: true,
                    allowed: !this.isLicenseDenied(empresa),
                    reason: empresa.hub_license_reason || empresa.hub_license_status || undefined,
                    features: empresa.hub_features ?? {},
                    quantity: cachedQuantity,
                    planCode: empresa.plano ?? null,
                    planName: null,
                    daysLeft: cachedDaysLeft,
                };
            }
            if (cachedDaysLeft !== null) {
                try {
                    const access = await this.resolveEmpresaAccess(empresa);
                    empresa.hub_license_status =
                        access.accessStatus || (access.allowed ? "licensed" : access.reason || "license_inactive");
                    empresa.hub_license_reason = access.allowed ? null : access.reason || access.accessStatus || "license_inactive";
                    empresa.hub_features = this.withHubMeta(access.features, {
                        daysLeft: access.daysLeft ?? cachedDaysLeft,
                        expiresAt: access.expiresAt ?? null,
                        accessStatus: access.accessStatus ?? null,
                        quantity: access.quantity ?? null,
                        planCode: access.planCode ?? null,
                        planName: access.planName ?? null,
                        syncedAt: new Date().toISOString(),
                    });
                    empresa.hub_last_sync = new Date();
                    empresa.hub_cache_until = new Date(Date.now() + (access.allowed ? 60000 : 10000));
                    await data_source_1.AppDataSource.getRepository(Empresa_1.Empresa).save(empresa);
                    return {
                        synced: true,
                        allowed: !this.isLicenseDenied(empresa),
                        reason: empresa.hub_license_reason || empresa.hub_license_status || undefined,
                        features: empresa.hub_features ?? {},
                        quantity: this.getStoredQuantity(empresa),
                        planCode: empresa.plano ?? null,
                        planName: null,
                        daysLeft: this.getStoredDaysLeft(empresa),
                    };
                }
                catch {
                    return {
                        synced: true,
                        allowed: !this.isLicenseDenied(empresa),
                        reason: empresa.hub_license_reason || empresa.hub_license_status || undefined,
                        features: empresa.hub_features ?? {},
                        quantity: null,
                        planCode: empresa.plano ?? null,
                        planName: null,
                        daysLeft: cachedDaysLeft,
                    };
                }
            }
        }
        const access = await this.resolveEmpresaAccess(empresa);
        empresa.hub_license_status = access.accessStatus || (access.allowed ? "licensed" : access.reason || "license_inactive");
        empresa.hub_license_reason = access.allowed ? null : access.reason || access.accessStatus || "license_inactive";
        empresa.hub_features = this.withHubMeta(access.features, {
            daysLeft: access.daysLeft ?? null,
            expiresAt: access.expiresAt ?? null,
            accessStatus: access.accessStatus ?? null,
            quantity: access.quantity ?? null,
            planCode: access.planCode ?? null,
            planName: access.planName ?? null,
            syncedAt: new Date().toISOString(),
        });
        empresa.hub_last_sync = new Date();
        empresa.hub_cache_until = new Date(Date.now() + (access.allowed ? 60000 : 10000));
        if (access.expiresAt) {
            const parsed = new Date(access.expiresAt);
            if (!Number.isNaN(parsed.getTime())) {
                empresa.hub_expires_at = parsed;
                empresa.data_vencimento = parsed.toISOString().slice(0, 10);
            }
        }
        // Fallback: quando Hub não retorna datas de trial/licença mas a empresa
        // já tem hub_expires_at (definido localmente no cadastro), usar esse valor
        const effectiveExpiresAt = access.expiresAt ?? (empresa.hub_expires_at ? empresa.hub_expires_at.toISOString() : null);
        const effectiveDaysLeft = access.daysLeft ?? (() => {
            if (!effectiveExpiresAt)
                return null;
            const msLeft = new Date(effectiveExpiresAt).getTime() - Date.now();
            return msLeft > 0 ? Math.ceil(msLeft / (1000 * 60 * 60 * 24)) : 0;
        })();
        // Reescreve hub_features com daysLeft/expiresAt efetivos
        empresa.hub_features = this.withHubMeta(access.features, {
            daysLeft: effectiveDaysLeft,
            expiresAt: effectiveExpiresAt,
            accessStatus: access.accessStatus ?? null,
            quantity: access.quantity ?? null,
            planCode: access.planCode ?? null,
            planName: access.planName ?? null,
            syncedAt: new Date().toISOString(),
        });
        // Só atualiza empresa.plano com valores canônicos (TESTE/BASICO/INTERMEDIARIO).
        // Nomes do Hub (ex: "PLANO PRO") são ignorados para não quebrar o feature matrix local.
        const CANONICAL_PLANS = new Set(["TESTE", "BASICO", "INTERMEDIARIO"]);
        const featurePlan = access.features?.plan ?? access.planCode;
        if (typeof featurePlan === "string") {
            const upper = featurePlan.trim().toUpperCase();
            if (CANONICAL_PLANS.has(upper))
                empresa.plano = upper;
        }
        empresa.hub_features = (0, license_features_1.getEffectiveFeatures)(empresa.plano, empresa.hub_features);
        await data_source_1.AppDataSource.getRepository(Empresa_1.Empresa).save(empresa);
        return {
            synced: true,
            allowed: access.allowed,
            reason: access.reason || access.accessStatus,
            features: access.features ?? {},
            expiresAt: effectiveExpiresAt,
            daysLeft: effectiveDaysLeft,
            banner: access.banner ?? null,
            accessStatus: access.accessStatus ?? null,
        };
    }
    static async resolveEmpresaAccess(empresa) {
        const productId = process.env.HUB_BILLING_PRODUCT_ID || "";
        if (productId) {
            const statusData = await this.getAccessStatus(empresa.hub_customer_id, productId);
            const canAccess = Boolean(statusData.canAccess);
            const accessStatus = typeof statusData.accessStatus === "string"
                ? String(statusData.accessStatus)
                : null;
            const reasonRaw = statusData.reason;
            const reason = typeof reasonRaw === "string" ? reasonRaw : accessStatus || "license_inactive";
            const daysLeftRaw = statusData.daysLeft;
            const daysLeft = typeof daysLeftRaw === "number" ? daysLeftRaw : null;
            const bannerRaw = statusData.banner;
            const banner = typeof bannerRaw === "string" ? bannerRaw : null;
            const quantityRaw = statusData.quantity;
            const quantityParsed = typeof quantityRaw === "number" && Number.isFinite(quantityRaw)
                ? quantityRaw
                : typeof quantityRaw === "string" && quantityRaw.trim() && !Number.isNaN(Number(quantityRaw))
                    ? Number(quantityRaw)
                    : null;
            let quantity = quantityParsed != null && Number.isFinite(quantityParsed) ? quantityParsed : null;
            const planCodeRaw = statusData.planCode;
            const planCode = typeof planCodeRaw === "string" ? planCodeRaw : null;
            const planNameRaw = statusData.planName;
            const planName = typeof planNameRaw === "string" ? planNameRaw : null;
            // Fallback: /access/status não retorna quantity em trial — busca nos planos do produto
            if (quantity === null && productId) {
                try {
                    const plans = await this.getProductPlans(productId);
                    const planCodeUpper = planCode?.toUpperCase();
                    const match = planCodeUpper
                        ? plans.find((p) => typeof p.code === "string" && p.code.toUpperCase() === planCodeUpper)
                        : plans.find((p) => p.isActive === true || String(p.status ?? "").toLowerCase() === "active");
                    if (match) {
                        const raw = match.quantity;
                        const parsed = typeof raw === "number" && Number.isFinite(raw)
                            ? raw
                            : typeof raw === "string" && raw.trim() && !Number.isNaN(Number(raw))
                                ? Number(raw)
                                : null;
                        if (parsed !== null && Number.isFinite(parsed))
                            quantity = parsed;
                    }
                }
                catch {
                    // ignora — fallback opcional
                }
            }
            const trialEndAtRaw = statusData.trialEndAt;
            const licenseEndAtRaw = statusData.licenseEndAt;
            const expiresAtRaw = typeof trialEndAtRaw === "string"
                ? trialEndAtRaw
                : typeof licenseEndAtRaw === "string"
                    ? licenseEndAtRaw
                    : null;
            const featuresRaw = statusData.features;
            const features = featuresRaw && typeof featuresRaw === "object" && !Array.isArray(featuresRaw)
                ? featuresRaw
                : undefined;
            return {
                allowed: canAccess,
                reason: canAccess ? reason : reason,
                features,
                quantity,
                planCode,
                planName,
                expiresAt: expiresAtRaw,
                daysLeft,
                banner,
                accessStatus,
            };
        }
        return this.checkAccess(empresa.hub_customer_id, empresa.hub_product_code || "");
    }
    static async requestApiKey(method, endpoint, body) {
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
        return response.json();
    }
    static async requestAdmin(method, endpoint, body) {
        const base = getBaseUrl();
        if (!base)
            throw new Error("Hub Billing base URL não configurada");
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
        return response.json();
    }
    static async getAdminToken() {
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
        const data = (await response.json());
        cachedAdminToken = data.accessToken;
        cachedAdminTokenUntil = Date.now() + 7 * 60 * 1000;
        return cachedAdminToken;
    }
}
exports.HubBillingService = HubBillingService;
HubBillingService.HUB_FEATURE_META_KEY = "__hubMeta";
