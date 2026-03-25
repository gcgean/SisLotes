import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProprietarioFieldsToLoteamento1700000000004 implements MigrationInterface {
  name = "AddProprietarioFieldsToLoteamento1700000000004";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE loteamentos 
      ADD COLUMN rg VARCHAR(20),
      ADD COLUMN estado_civil VARCHAR(50),
      ADD COLUMN conjuge VARCHAR(200),
      ADD COLUMN profissao VARCHAR(100)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE loteamentos 
      DROP COLUMN rg,
      DROP COLUMN estado_civil,
      DROP COLUMN conjuge,
      DROP COLUMN profissao
    `);
  }
}
