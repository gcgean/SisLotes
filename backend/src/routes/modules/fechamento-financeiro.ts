import { Router, Response } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { AuthRequest, requireAuth, requireFeature } from "../../middleware/auth";
import { AuditoriaService } from "../../services/AuditoriaService";

export const fechamentoFinanceiroRouter = Router();
fechamentoFinanceiroRouter.use(requireAuth, requireFeature("module_despesas"));

const periodoSchema = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
  .refine(({ from, to }) => from <= to, { message: "A data inicial deve ser anterior ou igual à data final" });
type QueryExecutor = { query: (sql: string, params?: unknown[]) => Promise<unknown[]> };

async function obterResumo(db: QueryExecutor, empresa: number, from: string, to: string) {
  const [r] = await db.query(`WITH saldo_base AS (SELECT COALESCE(SUM(c.saldo_inicial),0)::numeric AS valor FROM contas c WHERE c.id_empresa=$1),
movimentos_anteriores AS (SELECT COALESCE(SUM(CASE WHEN mf.tipo='receita' THEN mf.valor ELSE -mf.valor END),0)::numeric AS valor FROM movimentos_financeiros mf JOIN contas c ON c.id_conta=mf.id_conta AND c.id_empresa=$1 WHERE mf.id_empresa=$1 AND mf.data<$2::date AND mf.data>=COALESCE(c.data_saldo_inicial,'1900-01-01'::date)),
realizado AS (SELECT COALESCE(SUM(mf.valor) FILTER(WHERE mf.tipo='receita'),0)::numeric AS entradas,COALESCE(SUM(mf.valor) FILTER(WHERE mf.tipo='despesa'),0)::numeric AS saidas FROM movimentos_financeiros mf WHERE mf.id_empresa=$1 AND mf.origem IS DISTINCT FROM 'transferencia' AND mf.data BETWEEN $2::date AND $3::date),
receber_pendente AS (SELECT COALESCE(SUM(p.valor),0)::numeric AS valor,COUNT(*)::int AS quantidade FROM pagamentos p JOIN vendas v ON v.id_venda=p.id_venda WHERE p.id_empresa=$1 AND p.situacao='aberto' AND v.status<>'cancelada' AND p.vencimento BETWEEN $2::date AND $3::date),
pagar_pendente AS (SELECT COALESCE(SUM(GREATEST(dp.valor-COALESCE(baixas.liquidado,0),0)),0)::numeric AS valor,COUNT(*)::int AS quantidade FROM despesa_parcelas dp LEFT JOIN LATERAL(SELECT COALESCE(SUM(pp.valor_principal+pp.desconto),0)::numeric AS liquidado FROM despesa_parcela_pagamentos pp WHERE pp.id_despesa_parcela=dp.id_despesa_parcela AND pp.id_empresa=$1)baixas ON true WHERE dp.id_empresa=$1 AND dp.situacao<>'pago' AND dp.vencimento BETWEEN $2::date AND $3::date)
SELECT saldo_base.valor+movimentos_anteriores.valor AS saldo_inicial,realizado.entradas,realizado.saidas,saldo_base.valor+movimentos_anteriores.valor+realizado.entradas-realizado.saidas AS saldo_final,realizado.entradas-realizado.saidas AS variacao_caixa,receber_pendente.valor AS contas_receber_pendentes,receber_pendente.quantidade AS qtd_receber_pendentes,pagar_pendente.valor AS contas_pagar_pendentes,pagar_pendente.quantidade AS qtd_pagar_pendentes,receber_pendente.valor-pagar_pendente.valor AS saldo_nao_consolidado FROM saldo_base,movimentos_anteriores,realizado,receber_pendente,pagar_pendente`, [empresa, from, to]) as Record<string, unknown>[];
  return { periodo: { from, to }, saldoInicial: Number(r.saldo_inicial), entradas: Number(r.entradas), saidas: Number(r.saidas), saldoFinal: Number(r.saldo_final), variacaoCaixa: Number(r.variacao_caixa), contasReceberPendentes: Number(r.contas_receber_pendentes), qtdReceberPendentes: Number(r.qtd_receber_pendentes), contasPagarPendentes: Number(r.contas_pagar_pendentes), qtdPagarPendentes: Number(r.qtd_pagar_pendentes), saldoNaoConsolidado: Number(r.saldo_nao_consolidado) };
}

fechamentoFinanceiroRouter.get("/", async (req: AuthRequest, res: Response) => {
  const [r] = await AppDataSource.query(`SELECT TO_CHAR(f.fechado_ate,'YYYY-MM-DD') fechado_ate,f.updated_at,(SELECT rf.id_relatorio::int FROM relatorios_fechamento_financeiro rf WHERE rf.id_empresa=f.id_empresa AND rf.status='fechado' ORDER BY rf.periodo_fim DESC,rf.id_relatorio DESC LIMIT 1) id_relatorio FROM fechamentos_financeiros f WHERE f.id_empresa=$1`, [req.user!.id_empresa]);
  return res.json(r ?? { fechado_ate: null, id_relatorio: null });
});
fechamentoFinanceiroRouter.get("/extrato", async (req: AuthRequest, res: Response) => {
  const p = periodoSchema.safeParse(req.query); if (!p.success) return res.status(400).json({ error: "Período inválido", issues: p.error.issues });
  return res.json(await obterResumo(AppDataSource, req.user!.id_empresa, p.data.from, p.data.to));
});
fechamentoFinanceiroRouter.get("/relatorios", async (req: AuthRequest, res: Response) => {
  return res.json(await AppDataSource.query(`SELECT rf.id_relatorio::int id_relatorio,TO_CHAR(rf.periodo_inicio,'YYYY-MM-DD') periodo_inicio,TO_CHAR(rf.periodo_fim,'YYYY-MM-DD') periodo_fim,rf.status,rf.resumo,rf.fechado_em,rf.desfeito_em,u.login fechado_por_login,ud.login desfeito_por_login,jsonb_array_length(rf.lancamentos) qtd_lancamentos FROM relatorios_fechamento_financeiro rf JOIN usuarios u ON u.id_usuario=rf.fechado_por LEFT JOIN usuarios ud ON ud.id_usuario=rf.desfeito_por WHERE rf.id_empresa=$1 ORDER BY rf.periodo_fim DESC,rf.id_relatorio DESC`, [req.user!.id_empresa]));
});
fechamentoFinanceiroRouter.get("/relatorios/:id", async (req: AuthRequest, res: Response) => {
  const [row] = await AppDataSource.query(`SELECT rf.*,TO_CHAR(rf.periodo_inicio,'YYYY-MM-DD') periodo_inicio,TO_CHAR(rf.periodo_fim,'YYYY-MM-DD') periodo_fim,u.login fechado_por_login,ud.login desfeito_por_login,e.nome_fantasia empresa_nome FROM relatorios_fechamento_financeiro rf JOIN usuarios u ON u.id_usuario=rf.fechado_por JOIN empresas e ON e.id_empresa=rf.id_empresa LEFT JOIN usuarios ud ON ud.id_usuario=rf.desfeito_por WHERE rf.id_relatorio=$1 AND rf.id_empresa=$2`, [Number(req.params.id), req.user!.id_empresa]);
  return row ? res.json(row) : res.status(404).json({ error: "Relatório de fechamento não encontrado" });
});

fechamentoFinanceiroRouter.put("/", async (req: AuthRequest, res: Response) => {
  const parsed = z.object({ fechado_ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: "Data inválida" });
  const empresa = req.user!.id_empresa, usuario = req.user!.id_usuario, fim = parsed.data.fechado_ate;
  const runner = AppDataSource.createQueryRunner(); await runner.connect(); await runner.startTransaction();
  try {
    const [atual] = await runner.query(`SELECT TO_CHAR(fechado_ate,'YYYY-MM-DD') fechado_ate FROM fechamentos_financeiros WHERE id_empresa=$1 FOR UPDATE`, [empresa]);
    if (atual?.fechado_ate && fim <= atual.fechado_ate) { await runner.rollbackTransaction(); return res.status(409).json({ error: `O novo fechamento deve ser posterior a ${atual.fechado_ate}. Para reabrir, use Desfazer fechamento.` }); }
    const [inicioRow] = atual?.fechado_ate ? await runner.query(`SELECT TO_CHAR(($1::date+INTERVAL '1 day')::date,'YYYY-MM-DD') inicio`, [atual.fechado_ate]) : await runner.query(`SELECT COALESCE(TO_CHAR(MIN(data),'YYYY-MM-DD'),$2) inicio FROM movimentos_financeiros WHERE id_empresa=$1 AND data<=$2::date`, [empresa, fim]);
    const inicio = inicioRow.inicio as string, resumo = await obterResumo(runner, empresa, inicio, fim);
    const movimentos = await runner.query(`SELECT TO_CHAR(mf.data,'YYYY-MM-DD') data,mf.tipo,mf.descricao,c.apelido conta,mf.origem,mf.id_origem,COALESCE(l.nome,'Administrativa') loteamento,mf.valor::numeric valor FROM movimentos_financeiros mf JOIN contas c ON c.id_conta=mf.id_conta LEFT JOIN loteamentos l ON l.id_loteamento=mf.id_loteamento AND l.id_empresa=$1 WHERE mf.id_empresa=$1 AND mf.origem IS DISTINCT FROM 'transferencia' AND mf.data BETWEEN $2::date AND $3::date ORDER BY mf.data,mf.tipo,mf.id_origem`, [empresa, inicio, fim]);
    const [relatorio] = await runner.query(`INSERT INTO relatorios_fechamento_financeiro(id_empresa,periodo_inicio,periodo_fim,fechado_por,resumo,lancamentos) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb) RETURNING id_relatorio`, [empresa, inicio, fim, usuario, JSON.stringify(resumo), JSON.stringify(movimentos)]);
    const [salvo] = await runner.query(`INSERT INTO fechamentos_financeiros(id_empresa,fechado_ate,id_usuario) VALUES($1,$2,$3) ON CONFLICT(id_empresa) DO UPDATE SET fechado_ate=EXCLUDED.fechado_ate,id_usuario=EXCLUDED.id_usuario,updated_at=now() RETURNING *`, [empresa, fim, usuario]);
    await runner.commitTransaction(); await AuditoriaService.registrar(req, "fechamentos_financeiros", atual ? "UPDATE" : "CREATE", empresa, atual, salvo, `Período ${inicio} a ${fim} fechado — relatório #${relatorio.id_relatorio}`);
    return res.json({ ...salvo, id_relatorio: relatorio.id_relatorio });
  } catch (error) { await runner.rollbackTransaction(); throw error; } finally { await runner.release(); }
});

fechamentoFinanceiroRouter.post("/relatorios/:id/desfazer", async (req: AuthRequest, res: Response) => {
  const empresa = req.user!.id_empresa, usuario = req.user!.id_usuario, id = Number(req.params.id);
  const runner = AppDataSource.createQueryRunner(); await runner.connect(); await runner.startTransaction();
  try {
    const [relatorio] = await runner.query(`SELECT *,TO_CHAR(periodo_fim,'YYYY-MM-DD') periodo_fim FROM relatorios_fechamento_financeiro WHERE id_relatorio=$1 AND id_empresa=$2 FOR UPDATE`, [id, empresa]);
    if (!relatorio) { await runner.rollbackTransaction(); return res.status(404).json({ error: "Relatório de fechamento não encontrado" }); }
    if (relatorio.status === "desfeito") { await runner.rollbackTransaction(); return res.status(409).json({ error: "Este fechamento já foi desfeito" }); }
    const [atual] = await runner.query(`SELECT TO_CHAR(fechado_ate,'YYYY-MM-DD') fechado_ate FROM fechamentos_financeiros WHERE id_empresa=$1 FOR UPDATE`, [empresa]);
    if (atual?.fechado_ate !== relatorio.periodo_fim) { await runner.rollbackTransaction(); return res.status(409).json({ error: "Somente o fechamento mais recente pode ser desfeito" }); }
    await runner.query(`UPDATE relatorios_fechamento_financeiro SET status='desfeito',desfeito_por=$2,desfeito_em=now() WHERE id_relatorio=$1`, [id, usuario]);
    const [anterior] = await runner.query(`SELECT TO_CHAR(periodo_fim,'YYYY-MM-DD') periodo_fim FROM relatorios_fechamento_financeiro WHERE id_empresa=$1 AND status='fechado' AND id_relatorio<>$2 ORDER BY periodo_fim DESC,id_relatorio DESC LIMIT 1`, [empresa, id]);
    await runner.query(`UPDATE fechamentos_financeiros SET fechado_ate=$2,id_usuario=$3,updated_at=now() WHERE id_empresa=$1`, [empresa, anterior?.periodo_fim ?? null, usuario]);
    await runner.commitTransaction(); await AuditoriaService.registrar(req, "relatorios_fechamento_financeiro", "UPDATE", id, relatorio, { status: "desfeito", fechado_ate: anterior?.periodo_fim ?? null }, `Fechamento #${id} desfeito`);
    return res.json({ fechado_ate: anterior?.periodo_fim ?? null });
  } catch (error) { await runner.rollbackTransaction(); throw error; } finally { await runner.release(); }
});
