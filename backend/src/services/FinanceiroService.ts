import { AppDataSource } from "../db/data-source";

export interface ResumoFinanceiro {
  receita: number;
  despesa: number;
  resultado: number;
}

export interface FluxoFinanceiroMes extends ResumoFinanceiro {
  mes: string;
}

export async function resumoFinanceiroPeriodo(
  idEmpresa: number,
  from?: string,
  to?: string,
): Promise<ResumoFinanceiro> {
  const rows = await AppDataSource.query(
    `SELECT
       COALESCE(SUM(valor) FILTER (WHERE tipo = 'receita'), 0) AS receita,
       COALESCE(SUM(valor) FILTER (WHERE tipo = 'despesa'), 0) AS despesa
     FROM movimentos_financeiros
     WHERE id_empresa = $1
       AND ($2::date IS NULL OR data >= $2::date)
       AND ($3::date IS NULL OR data <= $3::date)`,
    [idEmpresa, from ?? null, to ?? null],
  );
  const receita = Number(rows[0]?.receita ?? 0);
  const despesa = Number(rows[0]?.despesa ?? 0);
  return { receita, despesa, resultado: receita - despesa };
}

export async function resumoFinanceiroMesAtual(idEmpresa: number): Promise<ResumoFinanceiro> {
  const rows = await AppDataSource.query(
    `SELECT
       COALESCE(SUM(valor) FILTER (WHERE tipo = 'receita'), 0) AS receita,
       COALESCE(SUM(valor) FILTER (WHERE tipo = 'despesa'), 0) AS despesa
     FROM movimentos_financeiros
     WHERE id_empresa = $1
       AND data >= date_trunc('month', CURRENT_DATE)::date
       AND data < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date`,
    [idEmpresa],
  );
  const receita = Number(rows[0]?.receita ?? 0);
  const despesa = Number(rows[0]?.despesa ?? 0);
  return { receita, despesa, resultado: receita - despesa };
}

export async function fluxoFinanceiroMensal(
  idEmpresa: number,
  from: string,
  to: string,
): Promise<FluxoFinanceiroMes[]> {
  const rows = await AppDataSource.query(
    `SELECT TO_CHAR(data, 'YYYY-MM') AS mes,
       COALESCE(SUM(valor) FILTER (WHERE tipo = 'receita'), 0) AS receita,
       COALESCE(SUM(valor) FILTER (WHERE tipo = 'despesa'), 0) AS despesa
     FROM movimentos_financeiros
     WHERE id_empresa = $1 AND data >= $2 AND data <= $3
     GROUP BY TO_CHAR(data, 'YYYY-MM')
     ORDER BY mes`,
    [idEmpresa, from, to],
  );
  return rows.map((row: { mes: string; receita: string | number; despesa: string | number }) => {
    const receita = Number(row.receita ?? 0);
    const despesa = Number(row.despesa ?? 0);
    return { mes: row.mes, receita, despesa, resultado: receita - despesa };
  });
}
