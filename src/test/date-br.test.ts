import { describe, expect, it } from "vitest";
import { classificarVencimento, compareDateOnly, formatDateBR, parseBrDate, toIsoDateFromBR } from "@/lib/date-br";

describe("date-br", () => {
  it("formata data BR com e sem zero à esquerda", () => {
    expect(formatDateBR("02/05/2026")).toBe("02/05/2026");
    expect(formatDateBR("2/5/2026")).toBe("02/05/2026");
  });

  it("converte BR para ISO", () => {
    expect(toIsoDateFromBR("2/5/2026")).toBe("2026-05-02");
  });

  it("rejeita data BR inválida", () => {
    const d = parseBrDate("32/13/2026");
    expect(Number.isNaN(d.getTime())).toBe(true);
  });

  it("formata DATE sem aplicar fuso horário", () => {
    expect(formatDateBR("2026-08-16")).toBe("16/08/2026");
  });

  it("compara e classifica vencimentos como datas civis", () => {
    expect(compareDateOnly("2026-08-15", "2026-08-16")).toBeLessThan(0);
    expect(compareDateOnly("16/08/2026", "2026-08-16")).toBe(0);
    expect(classificarVencimento("2026-08-15", "2026-08-16")).toBe("atrasada");
    expect(classificarVencimento("2026-08-16", "2026-08-16")).toBe("hoje");
    expect(classificarVencimento("2026-08-17", "2026-08-16")).toBe("futura");
  });
});

