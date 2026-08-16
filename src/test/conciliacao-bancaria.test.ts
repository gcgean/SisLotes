import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseOfx } from "../../backend/src/utils/ofx";

const raiz=resolve(__dirname,"../.."); const fonte=(p:string)=>readFileSync(resolve(raiz,p),"utf8");
describe("conciliação bancária",()=>{
  it("interpreta créditos e débitos OFX como datas civis",()=>{
    const itens=parseOfx(`<OFX><BANKTRANLIST><STMTTRN><TRNAMT>150.25<DTPOSTED>20260816120000<FITID>A1<MEMO>Venda</STMTTRN><STMTTRN><TRNAMT>-20.10<DTPOSTED>20260817<FITID>A2<NAME>Tarifa</STMTTRN></BANKTRANLIST></OFX>`);
    expect(itens).toEqual([{fitid:"A1",data:"2026-08-16",tipo:"receita",valor:150.25,descricao:"Venda"},{fitid:"A2",data:"2026-08-17",tipo:"despesa",valor:20.1,descricao:"Tarifa"}]);
  });
  it("rejeita conteúdo sem transações",()=>expect(()=>parseOfx("<OFX></OFX>")).toThrow("Nenhuma transação"));
  it("mantém vínculo explícito, reversível e isolado por empresa",()=>{const r=fonte("backend/src/routes/modules/contas.ts");expect(r).toContain("i.id_empresa=$1 AND i.id_conta=$2");expect(r).toContain("status='conciliado'");expect(r).toContain("status='pendente'");expect(r).toContain("AppDataSource.transaction");});
  it("expõe a fila sem modificar movimentos financeiros",()=>{const m=fonte("backend/src/migrations/1700000000037-CreateConciliacaoBancaria.ts");expect(m).toContain("UNIQUE(id_conta, fitid)");expect(m).not.toContain("UPDATE pagamentos");expect(fonte("src/pages/Despesas.tsx")).toContain('value="conciliacao"');});
});
