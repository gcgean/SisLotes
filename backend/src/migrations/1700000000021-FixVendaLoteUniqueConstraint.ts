import { MigrationInterface, QueryRunner } from "typeorm";

export class FixVendaLoteUniqueConstraint1700000000021 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove a unique constraint global (bloqueia reutilização de lote após cancelamento)
    await queryRunner.query(`ALTER TABLE vendas DROP CONSTRAINT IF EXISTS "vendas_id_lote_key"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "vendas_id_lote_key"`);

    // Cria índice parcial: só impede duplicata para vendas NÃO canceladas
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_vendas_lote_ativa"
      ON vendas (id_lote)
      WHERE status != 'cancelada'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_vendas_lote_ativa"`);
    await queryRunner.query(`ALTER TABLE vendas ADD CONSTRAINT "vendas_id_lote_key" UNIQUE (id_lote)`);
  }
}
