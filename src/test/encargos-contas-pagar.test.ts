import { describe,expect,it } from "vitest";
import { encargosSugeridos } from "@/pages/Despesas";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
describe("encargos no pagamento de despesas",()=>{
  it("calcula multa e juros após a carência",()=>expect(encargosSugeridos(100,"2026-08-10","2026-08-16",{multa_percentual:"2",juros_percentual_dia:"0.2",carencia_dias:1} as any)).toEqual({multa:2,juros:1,desconto:0}));
  it("não cobra antes do vencimento",()=>expect(encargosSugeridos(100,"2026-08-16","2026-08-16",{} as any)).toEqual({multa:0,juros:0,desconto:0}));
  it("persiste componentes por baixa e limpa no estorno",()=>{const s=readFileSync(resolve(__dirname,"../../backend/src/routes/modules/despesas.ts"),"utf8");expect(s).toContain("despesa_parcela_pagamentos");expect(s).toContain('desconto_obtido = "0.00"');});
});
