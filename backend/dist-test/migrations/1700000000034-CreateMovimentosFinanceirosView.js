"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateMovimentosFinanceirosView1700000000034 = void 0;
class CreateMovimentosFinanceirosView1700000000034 {
    constructor() {
        this.name = "CreateMovimentosFinanceirosView1700000000034";
    }
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE OR REPLACE VIEW movimentos_financeiros AS
      SELECT
        p.id_empresa,
        p.id_conta,
        p.pago_data AS data,
        'receita'::varchar(10) AS tipo,
        COALESCE(p.valor_pago, p.valor)::numeric(12,2) AS valor,
        'recebimento'::varchar(20) AS origem,
        p.id_pagamento AS id_origem,
        l.id_loteamento,
        NULL::integer AS id_conta_contabil,
        CONCAT('Recebimento venda #', v.id_venda, ' — parcela ', p.numero_parcela) AS descricao
      FROM pagamentos p
      JOIN vendas v ON v.id_venda = p.id_venda
      JOIN lotes l ON l.id_lote = v.id_lote
      WHERE p.situacao = 'pago' AND p.id_conta IS NOT NULL AND v.status <> 'cancelada'

      UNION ALL

      SELECT
        dp.id_empresa,
        dp.id_conta,
        dp.pago_data AS data,
        'despesa'::varchar(10) AS tipo,
        dp.valor_pago::numeric(12,2) AS valor,
        'pagamento'::varchar(20) AS origem,
        dp.id_despesa_parcela AS id_origem,
        d.id_loteamento,
        d.id_categoria AS id_conta_contabil,
        d.descricao
      FROM despesa_parcelas dp
      JOIN despesas d ON d.id_despesa = dp.id_despesa
      WHERE dp.situacao = 'pago' AND dp.id_conta IS NOT NULL

      UNION ALL

      SELECT
        lm.id_empresa,
        lm.id_conta,
        lm.data,
        lm.tipo,
        lm.valor::numeric(12,2),
        'manual'::varchar(20) AS origem,
        lm.id_lancamento AS id_origem,
        lm.id_loteamento,
        lm.id_conta_contabil,
        lm.descricao
      FROM lancamentos_manuais lm
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP VIEW IF EXISTS movimentos_financeiros`);
    }
}
exports.CreateMovimentosFinanceirosView1700000000034 = CreateMovimentosFinanceirosView1700000000034;
