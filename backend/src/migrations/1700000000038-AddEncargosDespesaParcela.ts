import { MigrationInterface, QueryRunner } from "typeorm";
export class AddEncargosDespesaParcela1700000000038 implements MigrationInterface {
  name="AddEncargosDespesaParcela1700000000038";
  async up(q:QueryRunner){await q.query(`ALTER TABLE despesa_parcelas ADD COLUMN multa_paga numeric(12,2) NOT NULL DEFAULT 0, ADD COLUMN juros_pagos numeric(12,2) NOT NULL DEFAULT 0, ADD COLUMN desconto_obtido numeric(12,2) NOT NULL DEFAULT 0`);}
  async down(q:QueryRunner){await q.query(`ALTER TABLE despesa_parcelas DROP COLUMN desconto_obtido, DROP COLUMN juros_pagos, DROP COLUMN multa_paga`);}
}
