const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function partes(value: string): [number, number, number] {
  if (!DATE_ONLY_RE.test(value)) throw new Error(`Data civil inválida: ${value}`);
  const [ano, mes, dia] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(ano, mes - 1, dia));
  if (utc.getUTCFullYear() !== ano || utc.getUTCMonth() !== mes - 1 || utc.getUTCDate() !== dia) {
    throw new Error(`Data civil inválida: ${value}`);
  }
  return [ano, mes, dia];
}

export function diferencaDiasCivis(inicio: string, fim: string): number {
  const [anoInicio, mesInicio, diaInicio] = partes(inicio);
  const [anoFim, mesFim, diaFim] = partes(fim);
  const inicioUtc = Date.UTC(anoInicio, mesInicio - 1, diaInicio);
  const fimUtc = Date.UTC(anoFim, mesFim - 1, diaFim);
  return Math.round((fimUtc - inicioUtc) / 86_400_000);
}
