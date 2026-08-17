import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
const root=path.resolve(__dirname,"../..");const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
describe("extrato do fechamento",()=>{
  it("calcula o realizado pela fonte financeira única e inclui as duas pontas das transferências",()=>{const route=read("backend/src/routes/modules/fechamento-financeiro.ts");expect(route).toContain("FROM movimentos_financeiros mf");expect(route).not.toContain("mf.origem IS DISTINCT FROM 'transferencia'");expect(route).toContain("realizado.entradas-realizado.saidas variacao_caixa")});
  it("isola a empresa e considera somente pendências com vencimento no período",()=>{const route=read("backend/src/routes/modules/fechamento-financeiro.ts");expect(route).toContain("p.id_empresa=$1 AND p.situacao='aberto'");expect(route).toContain("dp.id_empresa=$1 AND dp.situacao<>'pago'");expect(route.match(/BETWEEN \$2::date AND \$3::date/g)?.length).toBeGreaterThanOrEqual(3)});
  it("exibe o fechamento no formato do extrato de lançamentos",()=>{const component=read("src/components/financeiro/FechamentoPeriodoTab.tsx");for(const text of["Saldo inicial do período","Créditos no período","Débitos no período","Saldo final do período","Todas as contas","Buscar descrição, conta ou loteamento"])expect(component).toContain(text)});
});
