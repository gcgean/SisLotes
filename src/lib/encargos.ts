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

// ─── Negociação de encargos ──────────────────────────────────────────────────

export interface ParcelaParaNegociar {
  id: number;
  /** Principal da parcela, sem encargos. */
  valor: number;
  multa: number;
  juros: number;
}

export interface ParcelaNegociada extends ParcelaParaNegociar {
  /** valor + multa + juros, já com o abatimento aplicado. */
  total: number;
}

export interface ResultadoNegociacao {
  parcelas: ParcelaNegociada[];
  /** Soma de valor + multa + juros antes de negociar. */
  totalOriginal: number;
  /** Piso: só o principal. Abaixo disso seria perdoar a dívida, não o encargo. */
  minimo: number;
  /** Quanto de encargo foi abatido. */
  abatimento: number;
  /** Total efetivamente cobrado (pode diferir do pedido se saiu da faixa). */
  totalNegociado: number;
}

const emCentavos = (v: number) => Math.round(v * 100);
const deCentavos = (c: number) => c / 100;

/**
 * Distribui um abatimento entre as parcelas selecionadas para chegar a um
 * total negociado.
 *
 * O abatimento sai **só dos encargos**, proporcionalmente ao encargo de cada
 * parcela, e nunca do principal — perdoar principal é distrato/renegociação de
 * contrato, outra operação. Por isso `valorNegociado` é limitado entre o
 * principal (mínimo) e o total com encargos (máximo).
 *
 * A conta é feita em centavos inteiros e a sobra do arredondamento vai para a
 * última parcela, de modo que a soma final bate exatamente com o negociado —
 * mesma técnica usada no rateio de parcelas de venda.
 */
export function distribuirAbatimento(
  parcelas: ParcelaParaNegociar[],
  valorNegociado: number,
): ResultadoNegociacao {
  const principalC = parcelas.reduce((a, p) => a + emCentavos(p.valor), 0);
  const encargosC = parcelas.reduce((a, p) => a + emCentavos(p.multa) + emCentavos(p.juros), 0);
  const totalC = principalC + encargosC;

  const alvoC = Math.min(Math.max(emCentavos(valorNegociado), principalC), totalC);
  const abatimentoC = totalC - alvoC;

  // Sem encargo não há o que abater: devolve as parcelas como estão.
  if (encargosC === 0 || abatimentoC === 0) {
    return {
      parcelas: parcelas.map((p) => ({ ...p, total: p.valor + p.multa + p.juros })),
      totalOriginal: deCentavos(totalC),
      minimo: deCentavos(principalC),
      abatimento: deCentavos(abatimentoC),
      totalNegociado: deCentavos(alvoC),
    };
  }

  let abatidoAcumuladoC = 0;
  const resultado: ParcelaNegociada[] = parcelas.map((p, i) => {
    const encargoPC = emCentavos(p.multa) + emCentavos(p.juros);

    // A última absorve a sobra, para a soma fechar no centavo.
    const abaterC =
      i === parcelas.length - 1
        ? abatimentoC - abatidoAcumuladoC
        : Math.min(encargoPC, Math.round((abatimentoC * encargoPC) / encargosC));
    abatidoAcumuladoC += abaterC;

    // Abate primeiro dos juros, depois da multa.
    const jurosC = emCentavos(p.juros);
    const jurosFinalC = Math.max(0, jurosC - abaterC);
    const restanteC = abaterC - (jurosC - jurosFinalC);
    const multaFinalC = Math.max(0, emCentavos(p.multa) - restanteC);

    return {
      id: p.id,
      valor: p.valor,
      multa: deCentavos(multaFinalC),
      juros: deCentavos(jurosFinalC),
      total: deCentavos(emCentavos(p.valor) + multaFinalC + jurosFinalC),
    };
  });

  return {
    parcelas: resultado,
    totalOriginal: deCentavos(totalC),
    minimo: deCentavos(principalC),
    abatimento: deCentavos(abatimentoC),
    totalNegociado: deCentavos(alvoC),
  };
}

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/** 2 → "2", 0.2 → "0,2", 0.25 → "0,25" (sem zeros à toa). */
function pct(v: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(v);
}

/**
 * Frase que descreve os encargos cobrados, para documentos entregues ao
 * cliente (carnê). É montada a partir da configuração real da empresa — o
 * texto impresso precisa bater com o que o sistema de fato cobra.
 *
 * Devolve string vazia quando não há encargo configurado: melhor não imprimir
 * nada do que imprimir uma condição que não é cobrada.
 */
export function descreverEncargos(config?: ConfigEncargos | null): string {
  const multa = num(config?.multa_percentual, 0);
  const carencia = num(config?.carencia_dias, 0);

  const partes: string[] = [];
  if (multa > 0) partes.push(`multa de ${pct(multa)}% sobre o valor da parcela`);

  if (config?.juros_tipo === "valor") {
    const valorDia = num(config?.juros_valor_dia, 0);
    if (valorDia > 0) partes.push(`juros de ${brl(valorDia)} por dia de atraso`);
  } else {
    const percDia = num(config?.juros_percentual_dia, 0);
    if (percDia > 0) partes.push(`juros de ${pct(percDia)}% ao dia`);
  }

  if (partes.length === 0) return "";

  const inicio =
    carencia > 0
      ? `Após ${carencia} ${carencia === 1 ? "dia" : "dias"} do vencimento`
      : "Após o vencimento";

  return `${inicio}: ${partes.join(" e ")}.`;
}

/** Rótulo curto do juros configurado, para telas e avisos. */
export function descreverJuros(config?: ConfigEncargos | null): string {
  if (config?.juros_tipo === "valor") {
    const valor = num(config?.juros_valor_dia, 0);
    return `${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor)}/dia`;
  }
  return `${num(config?.juros_percentual_dia, 0)}%/dia`;
}
