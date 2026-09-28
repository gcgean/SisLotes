import { describe, it, expect } from "vitest";
import { avaliarLicenca } from "@/lib/license-time";

// Uma empresa marcada como "controle de planos desativado" no admin não é
// cobrada. O backend já zerava days_left e banner, mas continuava mandando
// hub_expires_at — e as telas, que calculavam o vencimento por conta própria,
// mostravam "plano vencido há 150 dias" para quem não devia nada.

const AGORA = new Date("2026-09-28T12:00:00Z").getTime();
const VENCIDA_HA_MESES = "2026-05-01T23:59:59Z";

describe("empresa fora do controle de planos", () => {
  it("não fica vencida mesmo com data de expiração no passado", () => {
    const estado = avaliarLicenca({
      planControlDisabled: true,
      daysLeft: null,
      expiresAt: VENCIDA_HA_MESES,
      nowMs: AGORA,
    });

    expect(estado.semControleDePlano).toBe(true);
    expect(estado.vencida).toBe(false);
    expect(estado.venceEmBreve).toBe(false);
  });

  it("não fica vencida nem quando o days_left vem negativo", () => {
    const estado = avaliarLicenca({
      planControlDisabled: true,
      daysLeft: -150,
      expiresAt: VENCIDA_HA_MESES,
      nowMs: AGORA,
    });

    expect(estado.vencida).toBe(false);
  });
});

describe("empresa dentro do controle de planos", () => {
  it("fica vencida pela data de expiração, mesmo sem days_left", () => {
    const estado = avaliarLicenca({
      planControlDisabled: false,
      daysLeft: null,
      expiresAt: VENCIDA_HA_MESES,
      nowMs: AGORA,
    });

    expect(estado.semControleDePlano).toBe(false);
    expect(estado.vencida).toBe(true);
    expect(estado.venceEmBreve).toBe(false);
  });

  it("avisa que vence em breve quando faltam 5 dias ou menos", () => {
    const estado = avaliarLicenca({
      planControlDisabled: false,
      daysLeft: 3,
      expiresAt: "2026-10-01T23:59:59Z",
      nowMs: AGORA,
    });

    expect(estado.vencida).toBe(false);
    expect(estado.venceEmBreve).toBe(true);
  });

  it("não avisa nada quando ainda falta bastante tempo", () => {
    const estado = avaliarLicenca({
      planControlDisabled: false,
      daysLeft: 40,
      expiresAt: "2026-12-01T23:59:59Z",
      nowMs: AGORA,
    });

    expect(estado.vencida).toBe(false);
    expect(estado.venceEmBreve).toBe(false);
  });

  it("trata vencida e vence em breve como estados mutuamente exclusivos", () => {
    // days_left zerado enquanto a data já passou: não pode dizer "vence em breve"
    const estado = avaliarLicenca({
      planControlDisabled: false,
      daysLeft: 0,
      expiresAt: VENCIDA_HA_MESES,
      nowMs: AGORA,
    });

    expect(estado.vencida).toBe(true);
    expect(estado.venceEmBreve).toBe(false);
  });

  it("ignora data de expiração inválida sem quebrar", () => {
    const estado = avaliarLicenca({
      planControlDisabled: false,
      daysLeft: null,
      expiresAt: "data-invalida",
      nowMs: AGORA,
    });

    expect(estado.vencida).toBe(false);
  });
});
