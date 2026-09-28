export interface EstadoLicenca {
  /** Empresa fora do controle de planos: nenhuma cobrança se aplica a ela. */
  semControleDePlano: boolean;
  vencida: boolean;
  venceEmBreve: boolean;
}

/**
 * Decide se cabe falar de vencimento/cobrança para esta empresa.
 *
 * Existe como função única porque o estado vem de três campos que precisam ser
 * lidos juntos — quando cada tela fazia essa conta por conta própria, o
 * `plan_control_disabled` foi esquecido e empresas isentas viam o aviso de
 * plano vencido.
 */
export function avaliarLicenca(args: {
  planControlDisabled?: boolean;
  daysLeft?: number | null;
  expiresAt?: string | null;
  nowMs?: number;
}): EstadoLicenca {
  if (args.planControlDisabled) {
    return { semControleDePlano: true, vencida: false, venceEmBreve: false };
  }

  const nowMs = args.nowMs ?? Date.now();
  const daysLeft = typeof args.daysLeft === "number" ? args.daysLeft : null;

  // A licença é considerada vencida pela data real de expiração, não só pelo
  // daysLeft — os dois podem divergir (ex.: daysLeft zerado enquanto a data já
  // passou), e aí o aviso dizia "vence em breve (expirada há 72 dias)".
  const expiresAtMs = args.expiresAt ? new Date(args.expiresAt).getTime() : null;
  const vencida =
    (daysLeft != null && daysLeft < 0) ||
    (expiresAtMs != null && !Number.isNaN(expiresAtMs) && expiresAtMs < nowMs);

  return {
    semControleDePlano: false,
    vencida,
    venceEmBreve: !vencida && daysLeft != null && daysLeft >= 0 && daysLeft <= 5,
  };
}

export function formatLicenseRemainingTime(args: {
  daysLeft?: number | null;
  expiresAt?: string | null;
  nowMs?: number;
}) {
  const nowMs = args.nowMs ?? Date.now();
  const expiresAtRaw = args.expiresAt;

  if (expiresAtRaw) {
    const expiresMs = new Date(expiresAtRaw).getTime();
    if (!Number.isNaN(expiresMs)) {
      let diffMs = expiresMs - nowMs;
      const expired = diffMs < 0;
      if (expired) diffMs = Math.abs(diffMs);

      const totalMinutes = Math.floor(diffMs / 60_000);
      const days = Math.floor(totalMinutes / (24 * 60));
      const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
      const minutes = totalMinutes % 60;

      const timeLabel = `${days} dia${days === 1 ? "" : "s"} ${hours}h ${minutes}min`;
      return expired ? `Expirada há ${timeLabel}` : `Restam ${timeLabel}`;
    }
  }

  if (typeof args.daysLeft === "number") {
    const days = Math.abs(args.daysLeft);
    return args.daysLeft >= 0
      ? `Restam ${days} dia${days === 1 ? "" : "s"}`
      : `Expirada há ${days} dia${days === 1 ? "" : "s"}`;
  }

  return "Tempo indisponível";
}

