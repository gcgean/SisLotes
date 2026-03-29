/**
 * Utilitários para CPF e CNPJ
 * Aceita tanto CPF (11 dígitos) quanto CNPJ (14 dígitos)
 */

/** Remove tudo que não for dígito */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Aplica máscara automática:
 *  – CPF:  000.000.000-00 (11 dígitos)
 *  – CNPJ: 00.000.000/0000-00 (14 dígitos)
 * Detecta pelo comprimento dos dígitos (≤11 → CPF, >11 → CNPJ)
 */
export function formatCpfCnpj(value: string): string {
  const d = onlyDigits(value).slice(0, 14); // máx 14 dígitos

  if (d.length <= 11) {
    // CPF: 000.000.000-00
    // Formato: (3).(3).(3)-(2)
    return (
      d.substring(0, 3) +
      (d.length > 3 ? "." + d.substring(3, 6) : "") +
      (d.length > 6 ? "." + d.substring(6, 9) : "") +
      (d.length > 9 ? "-" + d.substring(9, 11) : "")
    );
  }

  // CNPJ: 00.000.000/0000-00
  // Formato: (2).(3).(3)/(4)-(2)
  return (
    d.substring(0, 2) +
    (d.length > 2 ? "." + d.substring(2, 5) : "") +
    (d.length > 5 ? "." + d.substring(5, 8) : "") +
    (d.length > 8 ? "/" + d.substring(8, 12) : "") +
    (d.length > 12 ? "-" + d.substring(12, 14) : "")
  );
}

/**
 * Verifica se o valor tem o comprimento correto de um CPF (11) ou CNPJ (14).
 * Aceita tanto o valor com máscara quanto só dígitos.
 */
export function isValidCpfCnpj(value: string): boolean {
  const d = onlyDigits(value);
  return d.length === 11 || d.length === 14;
}
