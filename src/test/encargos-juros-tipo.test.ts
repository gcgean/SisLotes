import { describe, expect, it } from "vitest";
import {
  calcularEncargos,
  calcularJuros,
  descreverJuros,
  diasCobraveis,
  type ConfigEncargos,
} from "@/lib/encargos";

// O juros por atraso pode ser percentual sobre a parcela ou um valor fixo em R$
// por dia. Nos dois casos é proporcional aos dias — o que muda é a unidade.
// Esta regra precisa bater com o cálculo do backend em routes/modules/pagamentos.ts,
// que é quem grava o valor efetivamente cobrado.

const PERCENTUAL: ConfigEncargos = {
  multa_percentual: 2,
  juros_tipo: "percentual",
  juros_percentual_dia: 0.2,
  carencia_dias: 0,
};

const VALOR: ConfigEncargos = {
  multa_percentual: 2,
  juros_tipo: "valor",
  juros_valor_dia: 1.5,
  carencia_dias: 0,
};

describe("juros em percentual", () => {
  it("cobra percentual da parcela por dia de atraso", () => {
    // 1000 × 0,2% × 10 dias = 20
    expect(calcularJuros(1000, 10, PERCENTUAL)).toBeCloseTo(20, 2);
  });

  it("escala com o valor da parcela", () => {
    expect(calcularJuros(2000, 10, PERCENTUAL)).toBeCloseTo(40, 2);
  });
});

describe("juros em valor fixo por dia", () => {
  it("cobra o valor por dia de atraso, não um valor único", () => {
    // R$ 1,50 × 10 dias = 15
    expect(calcularJuros(1000, 10, VALOR)).toBeCloseTo(15, 2);
  });

  it("não muda com o valor da parcela — é o ponto do modo valor", () => {
    expect(calcularJuros(1000, 10, VALOR)).toBeCloseTo(calcularJuros(50_000, 10, VALOR), 2);
  });

  it("ignora o percentual configurado quando o tipo é valor", () => {
    const comOsDois: ConfigEncargos = { ...VALOR, juros_percentual_dia: 5 };
    expect(calcularJuros(1000, 10, comOsDois)).toBeCloseTo(15, 2);
  });
});

describe("carência e ausência de atraso", () => {
  it("desconta a carência dos dias cobráveis", () => {
    expect(diasCobraveis(10, { carencia_dias: 3 })).toBe(7);
  });

  it("não cobra nada dentro da carência, nos dois modos", () => {
    const comCarencia = { carencia_dias: 5 };
    expect(calcularEncargos(1000, 5, { ...PERCENTUAL, ...comCarencia })).toEqual({ multa: 0, juros: 0 });
    expect(calcularEncargos(1000, 5, { ...VALOR, ...comCarencia })).toEqual({ multa: 0, juros: 0 });
  });

  it("sem atraso não há multa nem juros", () => {
    expect(calcularEncargos(1000, 0, PERCENTUAL)).toEqual({ multa: 0, juros: 0 });
    expect(calcularEncargos(1000, 0, VALOR)).toEqual({ multa: 0, juros: 0 });
  });
});

describe("multa", () => {
  it("continua percentual e cobrada uma vez, independente dos dias", () => {
    const dez = calcularEncargos(1000, 10, PERCENTUAL);
    const cem = calcularEncargos(1000, 100, PERCENTUAL);
    expect(dez.multa).toBeCloseTo(20, 2);
    expect(cem.multa).toBeCloseTo(20, 2);
  });

  it("não é afetada pelo modo do juros", () => {
    expect(calcularEncargos(1000, 10, VALOR).multa).toBeCloseTo(20, 2);
  });
});

describe("tolerância a dados vindos do banco", () => {
  it("aceita decimais como string, do jeito que o TypeORM devolve", () => {
    const comoVemDoBanco: ConfigEncargos = {
      multa_percentual: "2.00",
      juros_tipo: "valor",
      juros_valor_dia: "1.50",
      carencia_dias: "0",
    };
    expect(calcularEncargos(1000, 10, comoVemDoBanco)).toEqual({ multa: 20, juros: 15 });
  });

  it("trata config ausente como sem encargos, em vez de quebrar", () => {
    expect(calcularEncargos(1000, 10, undefined)).toEqual({ multa: 0, juros: 0 });
    expect(calcularEncargos(1000, 10, null)).toEqual({ multa: 0, juros: 0 });
  });

  it("assume percentual quando o tipo não vem definido", () => {
    const semTipo: ConfigEncargos = { juros_percentual_dia: 0.2 };
    expect(calcularJuros(1000, 10, semTipo)).toBeCloseTo(20, 2);
  });

  it("arredonda em centavos", () => {
    // 333,33 × 0,2% × 3 = 1,99998 → 2,00
    expect(calcularEncargos(333.33, 3, PERCENTUAL).juros).toBe(2);
  });
});

describe("descreverJuros", () => {
  it("descreve percentual ao dia", () => {
    expect(descreverJuros(PERCENTUAL)).toBe("0.2%/dia");
  });

  it("descreve valor em reais ao dia", () => {
    expect(descreverJuros(VALOR)).toContain("1,50");
    expect(descreverJuros(VALOR)).toContain("/dia");
  });
});
