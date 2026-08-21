"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KNOWN_FEATURES = exports.PLAN_FEATURE_MATRIX = void 0;
exports.getEffectiveFeatures = getEffectiveFeatures;
exports.isFeatureEnabledForPlan = isFeatureEnabledForPlan;
exports.PLAN_FEATURE_MATRIX = {
    TESTE: {
        module_planos: true,
        module_relatorios: true,
        module_auditoria: true,
        module_vendas: true,
        module_pagamentos: true,
        module_despesas: true,
        export_csv: true,
        export_pdf: true,
        max_users: 5,
    },
    BASICO: {
        module_planos: true,
        module_relatorios: true,
        module_auditoria: false,
        module_vendas: true,
        module_pagamentos: true,
        module_despesas: true,
        export_csv: true,
        export_pdf: true,
        max_users: 1,
    },
    INTERMEDIARIO: {
        module_planos: true,
        module_relatorios: true,
        module_auditoria: true,
        module_vendas: true,
        module_pagamentos: true,
        module_despesas: true,
        export_csv: true,
        export_pdf: true,
        max_users: 5,
    },
};
exports.KNOWN_FEATURES = new Set([
    "module_planos",
    "module_relatorios",
    "module_auditoria",
    "module_vendas",
    "module_pagamentos",
    "module_despesas",
    "export_csv",
    "export_pdf",
    "max_users",
]);
function isTruthy(value) {
    if (typeof value === "boolean")
        return value;
    if (typeof value === "number")
        return value > 0;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["true", "1", "yes", "sim"].includes(normalized))
            return true;
        if (["false", "0", "no", "nao", "não"].includes(normalized))
            return false;
        return Boolean(normalized);
    }
    return false;
}
function normalizePlan(plan) {
    const normalized = String(plan || "").trim().toUpperCase();
    if (normalized === "TESTE" || normalized === "BASICO" || normalized === "INTERMEDIARIO") {
        return normalized;
    }
    // Planos desconhecidos ou nulos recebem features do TESTE
    // para não bloquear módulos em produção durante o período trial
    return "TESTE";
}
function getEffectiveFeatures(plan, rawFeatures) {
    const planCode = normalizePlan(plan);
    const defaults = planCode ? exports.PLAN_FEATURE_MATRIX[planCode] : {};
    const sanitizedRaw = Object.fromEntries(Object.entries(rawFeatures ?? {}).filter(([, value]) => value !== null && value !== undefined));
    return { ...defaults, ...sanitizedRaw };
}
function isFeatureEnabledForPlan(args) {
    const env = (args.environment || process.env.NODE_ENV || "development").toLowerCase();
    const effective = getEffectiveFeatures(args.plan, args.rawFeatures);
    const hasValue = Object.prototype.hasOwnProperty.call(effective, args.feature);
    if (!hasValue) {
        if (env === "production" && exports.KNOWN_FEATURES.has(args.feature))
            return false;
        return true;
    }
    return isTruthy(effective[args.feature]);
}
