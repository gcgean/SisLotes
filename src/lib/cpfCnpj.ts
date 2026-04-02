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
  if (d.length === 11) return isValidCpf(d);
  if (d.length === 14) return isValidCnpj(d);
  return false;
}

function allDigitsEqual(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

function isValidCpf(digits: string): boolean {
  if (digits.length !== 11) return false;
  if (allDigitsEqual(digits)) return false;

  const nums = digits.split("").map((n) => Number(n));

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += nums[i] * (10 - i);
  let mod = sum % 11;
  const d1 = mod < 2 ? 0 : 11 - mod;
  if (nums[9] !== d1) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += nums[i] * (11 - i);
  mod = sum % 11;
  const d2 = mod < 2 ? 0 : 11 - mod;
  if (nums[10] !== d2) return false;

  return true;
}

function isValidCnpj(digits: string): boolean {
  if (digits.length !== 14) return false;
  if (allDigitsEqual(digits)) return false;

  const nums = digits.split("").map((n) => Number(n));
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) sum += nums[i] * w1[i];
  let mod = sum % 11;
  const d1 = mod < 2 ? 0 : 11 - mod;
  if (nums[12] !== d1) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) sum += nums[i] * w2[i];
  mod = sum % 11;
  const d2 = mod < 2 ? 0 : 11 - mod;
  if (nums[13] !== d2) return false;

  return true;
}
