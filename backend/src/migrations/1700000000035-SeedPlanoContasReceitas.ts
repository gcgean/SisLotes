import { MigrationInterface, QueryRunner } from "typeorm";
import { CONTAS_RECEITA_PADRAO, GRUPO_RECEITA_PADRAO } from "../config/contas-receita-padrao";

export class SeedPlanoContasReceitas1700000000035 implements MigrationInterface {
  name = "SeedPlanoContasReceitas1700000000035";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
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
      `,
      [GRUPO_RECEITA_PADRAO]
    );

    for (const [indice, nome] of CONTAS_RECEITA_PADRAO.entries()) {
      await queryRunner.query(
        `
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
        `,
        [GRUPO_RECEITA_PADRAO, indice + 1, nome]
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        DELETE FROM plano_de_contas filha
        USING plano_de_contas pai
        WHERE filha.id_pai = pai.id_conta_contabil
          AND filha.tipo = 'receita'
          AND filha.nome = ANY($2::varchar[])
          AND pai.id_pai IS NULL
          AND pai.tipo = 'receita'
          AND pai.nome = $1::varchar
      `,
      [GRUPO_RECEITA_PADRAO, [...CONTAS_RECEITA_PADRAO]]
    );

    await queryRunner.query(
      `
        DELETE FROM plano_de_contas pai
        WHERE pai.id_pai IS NULL
          AND pai.tipo = 'receita'
          AND pai.nome = $1::varchar
          AND NOT EXISTS (
            SELECT 1 FROM plano_de_contas filha
            WHERE filha.id_pai = pai.id_conta_contabil
          )
      `,
      [GRUPO_RECEITA_PADRAO]
    );
  }
}
