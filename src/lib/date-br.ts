import { format, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const BR_DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{4}$/;

export function isBrDate(value: string): boolean {
  return BR_DATE_RE.test(value);
}

export function parseBrDate(value: string): Date {
  const [d, m, y] = value.split("/").map(Number);
  const dt = new Date(y, m - 1, d);
  if (!isValid(dt)) return new Date(NaN);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return new Date(NaN);
  return dt;
}

function parseAnyDate(value: string | Date): Date | null {
  if (value instanceof Date) {
    return isValid(value) ? value : null;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (BR_DATE_RE.test(trimmed)) {
    const parsed = parseBrDate(trimmed);
    return isValid(parsed) ? parsed : null;
  }

  const isoParsed = parseISO(trimmed);
  if (isValid(isoParsed)) return isoParsed;

  const nativeParsed = new Date(trimmed);
  return isValid(nativeParsed) ? nativeParsed : null;
}

export function formatDateBR(value?: string | Date | null, fallback = "—"): string {
  if (!value) return fallback;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (BR_DATE_RE.test(trimmed)) {
      const parsed = parseBrDate(trimmed);
      if (isValid(parsed)) return format(parsed, "dd/MM/yyyy", { locale: ptBR });
    }
  }
  const parsed = parseAnyDate(value);
  if (!parsed) return typeof value === "string" ? value : fallback;
  return format(parsed, "dd/MM/yyyy", { locale: ptBR });
}

export function formatDateTimeBR(value?: string | Date | null, fallback = "—"): string {
  if (!value) return fallback;
  const parsed = parseAnyDate(value);
  if (!parsed) return typeof value === "string" ? value : fallback;
  return format(parsed, "dd/MM/yyyy HH:mm", { locale: ptBR });
}

export function toIsoDateFromBR(value: string): string {
  const parsed = parseAnyDate(value);
  if (!parsed) return "";
  return format(parsed, "yyyy-MM-dd");
}

