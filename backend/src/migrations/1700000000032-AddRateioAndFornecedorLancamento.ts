import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRateioAndFornecedorLancamento1700000000032 implements MigrationInterface {
  name = "AddRateioAndFornecedorLancamento1700000000032";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE lancamentos_manuais ADD COLUMN IF NOT EXISTS id_fornecedor INTEGER`
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS despesa_rateio (
        id SERIAL PRIMARY KEY,
        id_empresa INTEGER NOT NULL,
        id_despesa INTEGER NOT NULL REFERENCES despesas(id_despesa) ON DELETE CASCADE,
        id_loteamento INTEGER NOT NULL,
        percentual NUMERIC(5,2) NOT NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_despesa_rateio_despesa ON despesa_rateio(id_despesa)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS lancamento_rateio (
        id SERIAL PRIMARY KEY,
        id_empresa INTEGER NOT NULL,
        id_lancamento INTEGER NOT NULL REFERENCES lancamentos_manuais(id_lancamento) ON DELETE CASCADE,
        id_loteamento INTEGER NOT NULL,
        percentual NUMERIC(5,2) NOT NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_lancamento_rateio_lancamento ON lancamento_rateio(id_lancamento)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS lancamento_rateio`);
    await queryRunner.query(`DROP TABLE IF EXISTS despesa_rateio`);
    await queryRunner.query(`ALTER TABLE lancamentos_manuais DROP COLUMN IF EXISTS id_fornecedor`);
  }
}
