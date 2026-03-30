export type LicensePlanCode = "TESTE" | "BASICO" | "INTERMEDIARIO";

export const PLAN_FEATURE_MATRIX: Record<LicensePlanCode, Record<string, unknown>> = {
  TESTE: {
    module_planos: true,
    module_relatorios: false,
    module_auditoria: false,
    module_vendas: false,
    module_pagamentos: false,
    export_csv: false,
    export_pdf: false,
    max_users: 1,
  },
  BASICO: {
    module_planos: true,
    module_relatorios: true,
    module_auditoria: false,
    module_vendas: true,
    module_pagamentos: true,
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
    export_csv: true,
    export_pdf: true,
    max_users: 5,
  },
};

export const KNOWN_FEATURES = new Set<string>([
  "module_planos",
  "module_relatorios",
  "module_auditoria",
  "module_vendas",
  "module_pagamentos",
  "export_csv",
  "export_pdf",
  "max_users",
]);

function normalizePlan(plan?: string | null): LicensePlanCode | null {
  const normalized = String(plan || "").trim().toUpperCase();
  if (normalized === "TESTE" || normalized === "BASICO" || normalized === "INTERMEDIARIO") {
    return normalized;
  }
  return null;
}

function isTruthy(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "sim"].includes(normalized)) return true;
    if (["false", "0", "no", "nao", "não"].includes(normalized)) return false;
    return Boolean(normalized);
  }
  return false;
}

export function getEffectiveFeatures(plan?: string | null, rawFeatures?: Record<string, unknown> | null) {
  const planCode = normalizePlan(plan);
  const defaults = planCode ? PLAN_FEATURE_MATRIX[planCode] : {};
  return { ...defaults, ...(rawFeatures ?? {}) };
}

export function isFeatureEnabledForPlan(args: {
  plan?: string | null;
  rawFeatures?: Record<string, unknown> | null;
  feature: string;
}) {
  const env = (import.meta.env.MODE || "development").toLowerCase();
  const effective = getEffectiveFeatures(args.plan, args.rawFeatures);
  const hasValue = Object.prototype.hasOwnProperty.call(effective, args.feature);
  if (!hasValue) {
    if (env === "production" && KNOWN_FEATURES.has(args.feature)) return false;
    return true;
  }
  return isTruthy(effective[args.feature]);
}
