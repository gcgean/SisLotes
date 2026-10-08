// ─── Encargos por atraso: multa e juros ──────────────────────────────────────
// A mesma regra vale para contas a receber (parcelas de venda) e contas a pagar
// (parcelas de despesa), e precisa bater com o cálculo do backend em
// routes/modules/pagamentos.ts — é ele que grava o valor cobrado de verdade.
// Qualquer mudança aqui tem que ser espelhada lá.

/** Como o juros diário é expresso: percentual sobre a parcela ou valor fixo. */
export type JurosTipo = "percentual" | "valor";

export interface ConfigEncargos {
  /** Percentual único sobre o valor da parcela (ex: 2 = 2%). */
  multa_percentual?: number | string | null;
  /** "percentual" (padrão) ou "valor". */
  juros_tipo?: JurosTipo | string | null;
  /** Usado quando juros_tipo = "percentual" (ex: 0.2 = 0,2% ao dia). */
  juros_percentual_dia?: number | string | null;
  /** Usado quando juros_tipo = "valor" (ex: 1.5 = R$ 1,50 ao dia). */
  juros_valor_dia?: number | string | null;
  /** Dias após o vencimento sem cobrança de encargos. */
  carencia_dias?: number | string | null;
}

export interface Encargos {
  multa: number;
  juros: number;
}

/** Lê um número que pode vir como string do banco (decimal do TypeORM). */
function num(valor: number | string | null | undefined, padrao: number): number {
  if (valor === null || valor === undefined || valor === "") return padrao;
  const n = Number(valor);
  return Number.isFinite(n) ? n : padrao;
}

/** Dias de atraso que realmente geram cobrança, já descontada a carência. */
export function diasCobraveis(diasAtraso: number, config?: ConfigEncargos | null): number {
  return Math.max(0, diasAtraso - num(config?.carencia_dias, 0));
}

/**
 * Juros do período.
 *
 * - "percentual": valor da parcela × taxa diária × dias
 * - "valor": R$ fixo por dia × dias
 *
 * Nos dois casos o juros é proporcional aos dias de atraso; o que muda é a
 * unidade. Sem dias cobráveis, não há juros.
 */
export function calcularJuros(
  valorParcela: number,
  dias: number,
  config?: ConfigEncargos | null,
): number {
  if (dias <= 0) return 0;

  if (config?.juros_tipo === "valor") {
    return num(config?.juros_valor_dia, 0) * dias;
  }

  const taxaDia = num(config?.juros_percentual_dia, 0) / 100;
  return valorParcela * taxaDia * dias;
}

/** Multa do período — percentual único sobre a parcela, cobrado uma vez. */
export function calcularMulta(
  valorParcela: number,
  dias: number,
  config?: ConfigEncargos | null,
): number {
  if (dias <= 0) return 0;
  return valorParcela * (num(config?.multa_percentual, 0) / 100);
}

/** Multa + juros já arredondados em centavos, prontos para gravar/exibir. */
export function calcularEncargos(
  valorParcela: number,
  diasAtraso: number,
  config?: ConfigEncargos | null,
): Encargos {
  const dias = diasCobraveis(diasAtraso, config);
  return {
    multa: Number(calcularMulta(valorParcela, dias, config).toFixed(2)),
    juros: Number(calcularJuros(valorParcela, dias, config).toFixed(2)),
  };
}

/** Rótulo curto do juros configurado, para telas e avisos. */
export function descreverJuros(config?: ConfigEncargos | null): string {
  if (config?.juros_tipo === "valor") {
    const valor = num(config?.juros_valor_dia, 0);
    return `${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor)}/dia`;
  }
  return `${num(config?.juros_percentual_dia, 0)}%/dia`;
}
