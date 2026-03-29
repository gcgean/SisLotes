import { useQuery } from "@tanstack/react-query";
import { getEffectiveFeatures, isFeatureEnabledForPlan } from "@/config/licenseFeatures";

function getAuthHeaders() {
  const token = window.localStorage.getItem("token");
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

interface LicenseStatusResponse {
  plano?: string | null;
  hub_features?: Record<string, unknown>;
  hub_configured?: boolean;
  hub_license_status?: string | null;
}

export function useLicenseFeatures() {
  const { data } = useQuery<LicenseStatusResponse>({
    queryKey: ["hub-billing", "license-status"],
    queryFn: async () => {
      const response = await fetch("/api/hub-billing/license-status", {
        headers: {
          ...getAuthHeaders(),
        },
      });
      if (!response.ok) {
        throw new Error("Erro ao carregar licença");
      }
      return response.json();
    },
    retry: 0,
  });

  const features = data?.hub_features ?? {};
  const effectiveFeatures = getEffectiveFeatures(data?.plano, features);
  const configured = Boolean(data?.hub_configured);
  const licenseStatus = data?.hub_license_status ?? null;

  function featureEnabled(key: string) {
    return isFeatureEnabledForPlan({
      plan: data?.plano,
      rawFeatures: features,
      feature: key,
    });
  }

  const canExportCsv = configured ? featureEnabled("export_csv") : true;
  const canExportPdf = configured ? featureEnabled("export_pdf") : true;
  const canUseRelatorios = configured ? featureEnabled("module_relatorios") : true;
  const canUseAuditoria = configured ? featureEnabled("module_auditoria") : true;
  const canUseVendas = configured ? featureEnabled("module_vendas") : true;
  const canUsePagamentos = configured ? featureEnabled("module_pagamentos") : true;
  const canUsePlanos = configured ? featureEnabled("module_planos") : true;

  return {
    plano: data?.plano ?? null,
    licenseStatus,
    features: effectiveFeatures,
    hubConfigured: configured,
    canExportCsv,
    canExportPdf,
    canUseRelatorios,
    canUseAuditoria,
    canUseVendas,
    canUsePagamentos,
    canUsePlanos,
    featureEnabled,
  };
}
