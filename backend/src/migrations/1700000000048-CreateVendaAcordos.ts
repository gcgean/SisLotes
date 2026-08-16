import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateVendaAcordos1700000000048 implements MigrationInterface {
  name = "CreateVendaAcordos1700000000048";
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE venda_acordos (id_acordo SERIAL PRIMARY KEY,id_empresa integer NOT NULL,id_venda integer NOT NULL REFERENCES vendas(id_venda),tipo varchar(20) NOT NULL CHECK(tipo IN('distrato','renegociacao')),motivo text NOT NULL,snapshot_antes jsonb NOT NULL,snapshot_depois jsonb NOT NULL,id_usuario integer NOT NULL REFERENCES usuarios(id_usuario),created_at timestamp NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE INDEX idx_venda_acordos_venda ON venda_acordos(id_venda)`);
  }
  async down(queryRunner: QueryRunner): Promise<void> { await queryRunner.query(`DROP TABLE venda_acordos`); }
}
