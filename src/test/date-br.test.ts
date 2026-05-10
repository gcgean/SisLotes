import { describe, expect, it } from "vitest";
import { formatDateBR, parseBrDate, toIsoDateFromBR } from "@/lib/date-br";

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
});

