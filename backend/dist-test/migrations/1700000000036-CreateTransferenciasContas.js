"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateTransferenciasContas1700000000036 = void 0;
const movimentosBase = `
  SELECT p.id_empresa, p.id_conta, p.pago_data AS data,
         'receita'::varchar(10) AS tipo, COALESCE(p.valor_pago, p.valor)::numeric(12,2) AS valor,
         'recebimento'::varchar(20) AS origem, p.id_pagamento AS id_origem,
         NULL::integer AS id_transferencia, l.id_loteamento, NULL::integer AS id_conta_contabil,
         CONCAT('Recebimento venda #', v.id_venda, ' — parcela ', p.numero_parcela) AS descricao
  FROM pagamentos p
  JOIN vendas v ON v.id_venda = p.id_venda
  JOIN lotes l ON l.id_lote = v.id_lote
  WHERE p.situacao = 'pago' AND p.id_conta IS NOT NULL AND v.status <> 'cancelada'

  UNION ALL

  SELECT dp.id_empresa, dp.id_conta, dp.pago_data AS data,
         'despesa'::varchar(10) AS tipo, dp.valor_pago::numeric(12,2) AS valor,
         'pagamento'::varchar(20) AS origem, dp.id_despesa_parcela AS id_origem,
         NULL::integer AS id_transferencia, d.id_loteamento, d.id_categoria AS id_conta_contabil,
         d.descricao
  FROM despesa_parcelas dp
  JOIN despesas d ON d.id_despesa = dp.id_despesa
  WHERE dp.situacao = 'pago' AND dp.id_conta IS NOT NULL

  UNION ALL

  SELECT lm.id_empresa, lm.id_conta, lm.data, lm.tipo, lm.valor::numeric(12,2),
         'manual'::varchar(20) AS origem, lm.id_lancamento AS id_origem,
         NULL::integer AS id_transferencia, lm.id_loteamento, lm.id_conta_contabil, lm.descricao
  FROM lancamentos_manuais lm
`;
class CreateTransferenciasContas1700000000036 {
    constructor() {
        this.name = "CreateTransferenciasContas1700000000036";
    }
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE transferencias_contas (
        id_transferencia SERIAL PRIMARY KEY,
        id_empresa INTEGER NOT NULL,
        id_conta_origem INTEGER NOT NULL REFERENCES contas(id_conta),
        id_conta_destino INTEGER NOT NULL REFERENCES contas(id_conta),
        descricao VARCHAR(300) NOT NULL,
        valor NUMERIC(12,2) NOT NULL CHECK (valor > 0),
        data DATE NOT NULL,
        id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_transferencia_contas_distintas CHECK (id_conta_origem <> id_conta_destino)
      )
    `);
        await queryRunner.query(`CREATE INDEX idx_transferencias_empresa_data ON transferencias_contas(id_empresa, data)`);
        await queryRunner.query(`CREATE INDEX idx_transferencias_origem ON transferencias_contas(id_conta_origem)`);
        await queryRunner.query(`CREATE INDEX idx_transferencias_destino ON transferencias_contas(id_conta_destino)`);
        await queryRunner.query(`DROP VIEW movimentos_financeiros`);
        await queryRunner.query(`
      CREATE VIEW movimentos_financeiros AS
      ${movimentosBase}

      UNION ALL

      SELECT t.id_empresa, t.id_conta_origem AS id_conta, t.data,
             'despesa'::varchar(10) AS tipo, t.valor::numeric(12,2),
             'transferencia'::varchar(20) AS origem, t.id_transferencia AS id_origem,
             t.id_transferencia, NULL::integer AS id_loteamento, NULL::integer AS id_conta_contabil,
             t.descricao
      FROM transferencias_contas t

      UNION ALL

      SELECT t.id_empresa, t.id_conta_destino AS id_conta, t.data,
             'receita'::varchar(10) AS tipo, t.valor::numeric(12,2),
             'transferencia'::varchar(20) AS origem, t.id_transferencia AS id_origem,
             t.id_transferencia, NULL::integer AS id_loteamento, NULL::integer AS id_conta_contabil,
             t.descricao
      FROM transferencias_contas t
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP VIEW movimentos_financeiros`);
        await queryRunner.query(`DROP TABLE transferencias_contas`);
        await queryRunner.query(`
      CREATE VIEW movimentos_financeiros AS
      SELECT id_empresa, id_conta, data, tipo, valor, origem, id_origem,
             id_loteamento, id_conta_contabil, descricao
      FROM (
        ${movimentosBase}
      ) movimentos
    `);
    }
}
exports.CreateTransferenciasContas1700000000036 = CreateTransferenciasContas1700000000036;
