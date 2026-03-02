import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateEmpresasAndMultiTenant1700000000002 implements MigrationInterface {
  name = "CreateEmpresasAndMultiTenant1700000000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS empresas (
        id_empresa SERIAL PRIMARY KEY,
        nome_fantasia VARCHAR(200) NOT NULL,
        razao_social VARCHAR(200),
        cnpj VARCHAR(18),
        ie VARCHAR(20),
        endereco VARCHAR(300),
        cidade VARCHAR(100),
        estado CHAR(2),
        cep VARCHAR(9),
        telefone VARCHAR(20),
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      INSERT INTO empresas (id_empresa, nome_fantasia)
      VALUES (1, 'Empresa Padrão')
      ON CONFLICT (id_empresa) DO NOTHING
    `);

    const tables = ["usuarios", "clientes", "loteamentos", "lotes", "vendas", "pagamentos", "contas"];

    for (const table of tables) {
      await queryRunner.query(`
        ALTER TABLE ${table}
        ADD COLUMN IF NOT EXISTS id_empresa INTEGER NOT NULL DEFAULT 1
      `);

      await queryRunner.query(`
        UPDATE ${table}
        SET id_empresa = 1
        WHERE id_empresa IS NULL
      `);

      await queryRunner.query(`
        ALTER TABLE ${table}
        ADD CONSTRAINT fk_${table}_empresa
        FOREIGN KEY (id_empresa)
        REFERENCES empresas(id_empresa)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = ["usuarios", "clientes", "loteamentos", "lotes", "vendas", "pagamentos", "contas"];

    for (const table of tables) {
      await queryRunner.query(`
        ALTER TABLE ${table}
        DROP CONSTRAINT IF EXISTS fk_${table}_empresa
      `);

      await queryRunner.query(`
        ALTER TABLE ${table}
        DROP COLUMN IF EXISTS id_empresa
      `);
    }

    await queryRunner.query(`
      DROP TABLE IF EXISTS empresas
    `);
  }
}

