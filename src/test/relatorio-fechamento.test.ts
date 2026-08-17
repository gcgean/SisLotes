import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
const root=path.resolve(__dirname,"../..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

describe("relatório e filtros do fechamento",()=>{
  it("persiste snapshot e lançamentos por empresa",()=>{const migration=read("backend/src/migrations/1700000000049-CreateRelatoriosFechamento.ts");const route=read("backend/src/routes/modules/fechamento-financeiro.ts");expect(migration).toContain("resumo jsonb NOT NULL");expect(migration).toContain("lancamentos jsonb NOT NULL");expect(route).toContain("WHERE rf.id_relatorio=$1 AND rf.id_empresa=$2")});
  it("desfaz somente o fechamento mais recente da conta e preserva o relatório",()=>{const route=read("backend/src/routes/modules/fechamento-financeiro.ts");expect(route).toContain("Somente o fechamento mais recente desta conta pode ser desfeito");expect(route).toContain("SET status='desfeito'");expect(route).not.toContain("DELETE FROM relatorios_fechamento_financeiro")});
  it("oferece consulta, reimpressão e filtro pelos cards",()=>{const fechamento=read("src/components/financeiro/FechamentoPeriodoTab.tsx");const despesas=read("src/pages/Despesas.tsx");for(const text of["Histórico de fechamentos","Visualizar","Reimprimir","Desfazer fechamento"])expect(fechamento).toContain(text);expect(despesas).toContain("filtroAlerta");expect(despesas).toContain("aria-pressed")});
  it("suporta fechamento global e por conta em todos os movimentos",()=>{const migration=read("backend/src/migrations/1700000000050-AddContaFechamentoFinanceiro.ts");const service=read("backend/src/services/PeriodoFinanceiroService.ts");const lancamentos=read("backend/src/routes/modules/lancamentos.ts");expect(migration).toContain("COALESCE(id_conta,0)");expect(service).toContain("f.id_conta IS NULL OR f.id_conta=$2");expect(lancamentos).toContain("verificarPeriodoFinanceiroContas");for(const file of["backend/src/routes/modules/pagamentos.ts","backend/src/routes/modules/despesas.ts"])expect(read(file)).toMatch(/verificarPeriodoFinanceiro\([^\n]+id_conta/)});
});
