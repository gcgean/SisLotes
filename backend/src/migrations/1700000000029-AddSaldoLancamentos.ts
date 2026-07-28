import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSaldoLancamentos1700000000029 implements MigrationInterface {
  name = "AddSaldoLancamentos1700000000029";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE contas ADD COLUMN IF NOT EXISTS tipo VARCHAR(10) NOT NULL DEFAULT 'banco'`);
    await queryRunner.query(`ALTER TABLE contas ADD COLUMN IF NOT EXISTS saldo_inicial DECIMAL(12,2) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE contas ADD COLUMN IF NOT EXISTS data_saldo_inicial DATE`);
    await queryRunner.query(`ALTER TABLE contas ALTER COLUMN agencia DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE contas ALTER COLUMN conta DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE contas ALTER COLUMN titular DROP NOT NULL`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS lancamentos_manuais (
        id_lancamento SERIAL PRIMARY KEY,
        id_empresa INTEGER NOT NULL,
        id_conta INTEGER NOT NULL,
        id_loteamento INTEGER,
        tipo VARCHAR(10) NOT NULL,
        categoria VARCHAR(100),
        descricao VARCHAR(300) NOT NULL,
        valor DECIMAL(12,2) NOT NULL,
        data DATE NOT NULL,
        id_usuario INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_lancamentos_conta ON lancamentos_manuais(id_conta)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_lancamentos_data ON lancamentos_manuais(data)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_lancamentos_tipo ON lancamentos_manuais(tipo)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS lancamentos_manuais`);
    await queryRunner.query(`ALTER TABLE contas DROP COLUMN IF EXISTS tipo`);
    await queryRunner.query(`ALTER TABLE contas DROP COLUMN IF EXISTS saldo_inicial`);
    await queryRunner.query(`ALTER TABLE contas DROP COLUMN IF EXISTS data_saldo_inicial`);
  }
}
