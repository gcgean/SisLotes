import "dotenv/config";
import { Client } from "pg";

async function main() {
  const client = new Client({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 5433),
    user: process.env.DB_USER || "sislote",
    password: process.env.DB_PASSWORD || "sislote",
    database: process.env.DB_NAME || "sislote",
  });
  await client.connect();
  try {
    const divergencias = await client.query(`
      WITH fonte AS (
        SELECT p.id_empresa, 'receita'::text tipo, COALESCE(SUM(COALESCE(p.valor_pago, p.valor)), 0) total
        FROM pagamentos p JOIN vendas v ON v.id_venda = p.id_venda
        WHERE p.situacao = 'pago' AND p.id_conta IS NOT NULL AND v.status <> 'cancelada' GROUP BY p.id_empresa
        UNION ALL
        SELECT id_empresa, 'despesa', COALESCE(SUM(valor_pago), 0)
        FROM despesa_parcelas WHERE situacao = 'pago' AND id_conta IS NOT NULL GROUP BY id_empresa
        UNION ALL
        SELECT id_empresa, tipo, COALESCE(SUM(valor), 0)
        FROM lancamentos_manuais GROUP BY id_empresa, tipo
      ), esperado AS (
        SELECT id_empresa, tipo, SUM(total) total FROM fonte GROUP BY id_empresa, tipo
      ), livro AS (
        SELECT id_empresa, tipo, SUM(valor) total FROM movimentos_financeiros GROUP BY id_empresa, tipo
      )
      SELECT COALESCE(e.id_empresa, l.id_empresa) id_empresa, COALESCE(e.tipo, l.tipo) tipo,
             COALESCE(e.total, 0)::numeric(12,2) esperado, COALESCE(l.total, 0)::numeric(12,2) livro
      FROM esperado e FULL JOIN livro l ON l.id_empresa = e.id_empresa AND l.tipo = e.tipo
      WHERE COALESCE(e.total, 0) <> COALESCE(l.total, 0)`);
    if (divergencias.rowCount) {
      console.error(JSON.stringify(divergencias.rows, null, 2));
      throw new Error(`${divergencias.rowCount} divergência(s) entre as fontes e o livro financeiro.`);
    }
    const semConta = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM pagamentos WHERE situacao = 'pago' AND id_conta IS NULL) recebimentos_sem_conta,
        (SELECT COUNT(*)::int FROM despesa_parcelas WHERE situacao = 'pago' AND id_conta IS NULL) despesas_sem_conta`);
    console.log(JSON.stringify({ livroFinanceiro: "consistente", historicosPendentes: semConta.rows[0] }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((erro) => {
  console.error(`Validação falhou: ${erro instanceof Error ? erro.message : String(erro)}`);
  process.exitCode = 1;
});
