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

