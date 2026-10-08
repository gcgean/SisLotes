import { describe, expect, it } from "vitest";
import {
  calcularEncargos,
  calcularJuros,
  descreverEncargos,
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

// A frase vai impressa no carnê entregue ao cliente. Antes era fixa
// ("juros de 1% ao mês e multa de 2%") e não tinha relação com o que o
// sistema cobra — 0,2% ao dia dá ~6% ao mês, seis vezes o que estava escrito.
describe("descreverEncargos — texto do carnê", () => {
  it("descreve multa e juros percentuais ao dia", () => {
    expect(descreverEncargos(PERCENTUAL)).toBe(
      "Após o vencimento: multa de 2% sobre o valor da parcela e juros de 0,2% ao dia.",
    );
  });

  it("descreve juros em reais por dia", () => {
    const texto = descreverEncargos(VALOR);
    expect(texto).toContain("multa de 2% sobre o valor da parcela");
    expect(texto).toContain("por dia de atraso");
    expect(texto).toContain("1,50");
    expect(texto).not.toContain("ao dia.");
  });

  it("menciona a carência quando houver", () => {
    expect(descreverEncargos({ ...PERCENTUAL, carencia_dias: 5 })).toContain("Após 5 dias do vencimento");
    expect(descreverEncargos({ ...PERCENTUAL, carencia_dias: 1 })).toContain("Após 1 dia do vencimento");
  });

  it("omite a multa quando ela é zero", () => {
    const texto = descreverEncargos({ ...PERCENTUAL, multa_percentual: 0 });
    expect(texto).not.toContain("multa");
    expect(texto).toContain("juros de 0,2% ao dia");
  });

  it("devolve vazio quando não há encargo — melhor nada que condição falsa", () => {
    expect(descreverEncargos({ multa_percentual: 0, juros_percentual_dia: 0 })).toBe("");
    expect(descreverEncargos(null)).toBe("");
    expect(descreverEncargos(undefined)).toBe("");
  });
});
