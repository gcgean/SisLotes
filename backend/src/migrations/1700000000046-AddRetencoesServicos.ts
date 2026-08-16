import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRetencoesServicos1700000000046 implements MigrationInterface {
  name = "AddRetencoesServicos1700000000046";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE despesa_parcela_pagamentos ADD COLUMN iss_retido numeric(12,2) NOT NULL DEFAULT 0, ADD COLUMN irrf_retido numeric(12,2) NOT NULL DEFAULT 0, ADD COLUMN inss_retido numeric(12,2) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE despesa_parcelas ADD COLUMN iss_retido numeric(12,2) NOT NULL DEFAULT 0, ADD COLUMN irrf_retido numeric(12,2) NOT NULL DEFAULT 0, ADD COLUMN inss_retido numeric(12,2) NOT NULL DEFAULT 0`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE despesa_parcelas DROP COLUMN inss_retido, DROP COLUMN irrf_retido, DROP COLUMN iss_retido`);
    await queryRunner.query(`ALTER TABLE despesa_parcela_pagamentos DROP COLUMN inss_retido, DROP COLUMN irrf_retido, DROP COLUMN iss_retido`);
  }
}
