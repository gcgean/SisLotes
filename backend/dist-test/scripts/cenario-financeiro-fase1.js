"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const pg_1 = require("pg");
function assertEqual(nome, atual, esperado) {
    if (Math.abs(atual - esperado) > 0.001)
        throw new Error(`${nome}: esperado ${esperado}, obtido ${atual}`);
}
async function main() {
    const client = new pg_1.Client({
        host: process.env.DB_HOST || "127.0.0.1",
        port: Number(process.env.DB_PORT || 5433),
        user: process.env.DB_USER || "sislote",
        password: process.env.DB_PASSWORD || "sislote",
        database: process.env.DB_NAME || "sislote",
    });
    await client.connect();
    await client.query("BEGIN");
    try {
        const base = await client.query(`
      SELECT e.id_empresa,
        (SELECT id_usuario FROM usuarios u WHERE u.id_empresa = e.id_empresa ORDER BY id_usuario LIMIT 1) id_usuario,
        (SELECT v.id_venda FROM vendas v WHERE v.id_empresa = e.id_empresa AND v.status <> 'cancelada' ORDER BY v.id_venda LIMIT 1) id_venda,
        (SELECT pc.id_conta_contabil FROM plano_de_contas pc WHERE pc.id_empresa = e.id_empresa
          AND NOT EXISTS (SELECT 1 FROM plano_de_contas f WHERE f.id_pai = pc.id_conta_contabil)
          ORDER BY pc.id_conta_contabil LIMIT 1) id_categoria
      FROM empresas e
      WHERE EXISTS (SELECT 1 FROM usuarios u WHERE u.id_empresa = e.id_empresa)
        AND EXISTS (SELECT 1 FROM vendas v WHERE v.id_empresa = e.id_empresa AND v.status <> 'cancelada')
        AND EXISTS (SELECT 1 FROM plano_de_contas pc WHERE pc.id_empresa = e.id_empresa)
      ORDER BY e.id_empresa LIMIT 1`);
        if (!base.rowCount || !base.rows[0].id_usuario || !base.rows[0].id_venda || !base.rows[0].id_categoria) {
            throw new Error("A base local não possui empresa, usuário, venda e conta analítica suficientes para o cenário isolado.");
        }
        const { id_empresa, id_usuario, id_venda, id_categoria } = base.rows[0];
        const conta = await client.query(`INSERT INTO contas (id_empresa, apelido, tipo, saldo_inicial, data_saldo_inicial, ativo)
       VALUES ($1, 'TESTE', 'caixa', 1000, CURRENT_DATE, true) RETURNING id_conta`, [id_empresa]);
        const idConta = conta.rows[0].id_conta;
        const despesa = await client.query(`INSERT INTO despesas (id_empresa, id_categoria, descricao, valor_total, numero_parcelas, recorrente, recorrencia_ativa)
       VALUES ($1, $2, 'Cenário Fase 1', 300, 3, false, false) RETURNING id_despesa`, [id_empresa, id_categoria]);
        const idDespesa = despesa.rows[0].id_despesa;
        const parcelas = await client.query(`INSERT INTO despesa_parcelas (id_empresa, id_despesa, numero_parcela, vencimento, valor, situacao)
       VALUES ($1,$2,1,CURRENT_DATE,100,'aberto'),
              ($1,$2,2,(CURRENT_DATE + INTERVAL '1 month')::date,100,'aberto'),
              ($1,$2,3,(CURRENT_DATE + INTERVAL '2 month')::date,100,'aberto')
       RETURNING id_despesa_parcela, numero_parcela, TO_CHAR(vencimento, 'DD/MM/YYYY') vencimento`, [id_empresa, idDespesa]);
        const parcela1 = parcelas.rows.find((p) => p.numero_parcela === 1);
        const parcela2 = parcelas.rows.find((p) => p.numero_parcela === 2);
        await client.query(`UPDATE despesa_parcelas SET situacao='pago', pago_data=CURRENT_DATE, valor_pago=100, id_conta=$2, id_usuario=$3
       WHERE id_despesa_parcela=$1`, [parcela1.id_despesa_parcela, idConta, id_usuario]);
        const proxima = await client.query(`SELECT COALESCE(MAX(numero_parcela), 0) + 1000 numero FROM pagamentos WHERE id_venda=$1`, [id_venda]);
        const recebimento = await client.query(`INSERT INTO pagamentos (id_empresa,id_venda,id_conta,id_usuario,numero_parcela,tipo,situacao,vencimento,valor,pago_data,valor_pago,multa,juros,reajustado)
       VALUES ($1,$2,$3,$4,$5,'carne','pago',CURRENT_DATE,200,CURRENT_DATE,200,0,0,false) RETURNING id_pagamento`, [id_empresa, id_venda, idConta, id_usuario, proxima.rows[0].numero]);
        await client.query(`INSERT INTO lancamentos_manuais (id_empresa,id_conta,tipo,id_conta_contabil,descricao,valor,data,id_usuario)
       VALUES ($1,$2,'despesa',$3,'Débito manual cenário',50,CURRENT_DATE,$4)`, [id_empresa, idConta, id_categoria, id_usuario]);
        const totais = await client.query(`SELECT COALESCE(SUM(valor) FILTER (WHERE tipo='receita'),0) receita,
              COALESCE(SUM(valor) FILTER (WHERE tipo='despesa'),0) despesa
       FROM movimentos_financeiros WHERE id_conta=$1`, [idConta]);
        const receita = Number(totais.rows[0].receita);
        const saida = Number(totais.rows[0].despesa);
        assertEqual("receita", receita, 200);
        assertEqual("despesa", saida, 150);
        assertEqual("resultado", receita - saida, 50);
        assertEqual("saldo após movimentos", 1000 + receita - saida, 1050);
        await client.query(`UPDATE despesa_parcelas SET vencimento=CURRENT_DATE-1 WHERE id_despesa_parcela=$1`, [parcela2.id_despesa_parcela]);
        const atrasadas = await client.query(`SELECT COUNT(*)::int qtd FROM despesa_parcelas WHERE id_despesa=$1 AND situacao='aberto' AND vencimento<CURRENT_DATE`, [idDespesa]);
        assertEqual("card atrasadas", Number(atrasadas.rows[0].qtd), 1);
        await client.query(`UPDATE despesa_parcelas SET situacao='aberto', pago_data=NULL, valor_pago=NULL, id_conta=NULL WHERE id_despesa_parcela=$1`, [parcela1.id_despesa_parcela]);
        const saldoAposEstorno = await client.query(`SELECT 1000 + COALESCE(SUM(CASE WHEN tipo='receita' THEN valor ELSE -valor END),0) saldo
       FROM movimentos_financeiros WHERE id_conta=$1`, [idConta]);
        assertEqual("saldo após estorno", Number(saldoAposEstorno.rows[0].saldo), 1150);
        console.log(JSON.stringify({
            modo: "transação isolada com rollback",
            vencimentoExibido: parcela1.vencimento,
            saldoAposPagamento: 900,
            saldoAposRecebimento: 1100,
            saldoAposDebitoManual: 1050,
            totais: { receita, despesa: saida, resultado: receita - saida },
            atrasadas: Number(atrasadas.rows[0].qtd),
            saldoAposEstorno: Number(saldoAposEstorno.rows[0].saldo),
        }, null, 2));
        void recebimento;
    }
    finally {
        await client.query("ROLLBACK");
        await client.end();
    }
}
main().catch((erro) => {
    console.error(`Cenário falhou: ${erro instanceof Error ? erro.message : String(erro)}`);
    process.exitCode = 1;
});
