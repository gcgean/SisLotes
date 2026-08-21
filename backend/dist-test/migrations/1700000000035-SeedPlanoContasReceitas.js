"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeedPlanoContasReceitas1700000000035 = void 0;
const contas_receita_padrao_1 = require("../config/contas-receita-padrao");
class SeedPlanoContasReceitas1700000000035 {
    constructor() {
        this.name = "SeedPlanoContasReceitas1700000000035";
    }
    async up(queryRunner) {
        await queryRunner.query(`
        INSERT INTO plano_de_contas (id_empresa, id_pai, tipo, codigo, nome, ativo)
        SELECT e.id_empresa, NULL, 'receita',
               (COALESCE(MAX(
                 CASE WHEN raiz.codigo ~ '^[0-9]+$' THEN raiz.codigo::integer END
               ), 0) + 1)::text,
               $1::varchar, true
        FROM empresas e
        LEFT JOIN plano_de_contas raiz
          ON raiz.id_empresa = e.id_empresa
         AND raiz.id_pai IS NULL
        WHERE NOT EXISTS (
          SELECT 1
          FROM plano_de_contas existente
          WHERE existente.id_empresa = e.id_empresa
            AND existente.id_pai IS NULL
            AND existente.tipo = 'receita'
            AND existente.nome = $1::varchar
        )
        GROUP BY e.id_empresa
      `, [contas_receita_padrao_1.GRUPO_RECEITA_PADRAO]);
        for (const [indice, nome] of contas_receita_padrao_1.CONTAS_RECEITA_PADRAO.entries()) {
            await queryRunner.query(`
          INSERT INTO plano_de_contas (id_empresa, id_pai, tipo, codigo, nome, ativo)
          SELECT pai.id_empresa, pai.id_conta_contabil, 'receita',
                 pai.codigo || '.' || $2::text, $3::varchar, true
          FROM plano_de_contas pai
          WHERE pai.id_pai IS NULL
            AND pai.tipo = 'receita'
            AND pai.nome = $1::varchar
            AND NOT EXISTS (
              SELECT 1
              FROM plano_de_contas existente
              WHERE existente.id_empresa = pai.id_empresa
                AND existente.id_pai = pai.id_conta_contabil
                AND existente.tipo = 'receita'
                AND existente.nome = $3::varchar
            )
        `, [contas_receita_padrao_1.GRUPO_RECEITA_PADRAO, indice + 1, nome]);
        }
    }
    async down(queryRunner) {
        await queryRunner.query(`
        DELETE FROM plano_de_contas filha
        USING plano_de_contas pai
        WHERE filha.id_pai = pai.id_conta_contabil
          AND filha.tipo = 'receita'
          AND filha.nome = ANY($2::varchar[])
          AND pai.id_pai IS NULL
          AND pai.tipo = 'receita'
          AND pai.nome = $1::varchar
      `, [contas_receita_padrao_1.GRUPO_RECEITA_PADRAO, [...contas_receita_padrao_1.CONTAS_RECEITA_PADRAO]]);
        await queryRunner.query(`
        DELETE FROM plano_de_contas pai
        WHERE pai.id_pai IS NULL
          AND pai.tipo = 'receita'
          AND pai.nome = $1::varchar
          AND NOT EXISTS (
            SELECT 1 FROM plano_de_contas filha
            WHERE filha.id_pai = pai.id_conta_contabil
          )
      `, [contas_receita_padrao_1.GRUPO_RECEITA_PADRAO]);
    }
}
exports.SeedPlanoContasReceitas1700000000035 = SeedPlanoContasReceitas1700000000035;
