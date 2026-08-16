import { MigrationInterface, QueryRunner } from "typeorm";

export class AddComprovantesFinanceiros1700000000045 implements MigrationInterface {
  name = "AddComprovantesFinanceiros1700000000045";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE lancamentos_manuais ADD COLUMN anexo_nome VARCHAR(200), ADD COLUMN anexo_base64 TEXT`);
    await queryRunner.query(`ALTER TABLE despesa_parcela_pagamentos ADD COLUMN anexo_nome VARCHAR(200), ADD COLUMN anexo_base64 TEXT`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE despesa_parcela_pagamentos DROP COLUMN anexo_base64, DROP COLUMN anexo_nome`);
    await queryRunner.query(`ALTER TABLE lancamentos_manuais DROP COLUMN anexo_base64, DROP COLUMN anexo_nome`);
  }
}
