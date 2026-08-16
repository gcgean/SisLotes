import { describe, expect, it } from "vitest";
import { diferencaDiasCivis } from "../../backend/src/utils/date-only";

describe("date-only do backend", () => {
  it("calcula atraso sem depender de horário ou fuso", () => {
    expect(diferencaDiasCivis("2026-08-16", "2026-08-16")).toBe(0);
    expect(diferencaDiasCivis("2026-08-15", "2026-08-16")).toBe(1);
    expect(diferencaDiasCivis("2026-07-29", "2026-08-16")).toBe(18);
  });

  it("atravessa mudança de mês corretamente", () => {
    expect(diferencaDiasCivis("2026-01-31", "2026-02-01")).toBe(1);
  });
});
