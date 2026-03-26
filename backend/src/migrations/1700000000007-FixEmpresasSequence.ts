import { MigrationInterface, QueryRunner } from "typeorm";

export class FixEmpresasSequence1700000000007 implements MigrationInterface {
  name = "FixEmpresasSequence1700000000007";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Corrige a sequência da tabela empresas após inserção com ID explícito
    await queryRunner.query(`
      SELECT setval(
        pg_get_serial_sequence('empresas', 'id_empresa'),
        COALESCE((SELECT MAX(id_empresa) FROM empresas), 0) + 1,
        false
      )
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Não aplicável
  }
}
