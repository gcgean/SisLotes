import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateClientes1700000000000 implements MigrationInterface {
  name = "CreateClientes1700000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS clientes (
        id_cliente    SERIAL PRIMARY KEY,
        tipo          CHAR(1) NOT NULL CHECK (tipo IN ('f', 'j')),
        nome          VARCHAR(200) NOT NULL,
        razao_social  VARCHAR(200),
        cpf           VARCHAR(14) UNIQUE,
        cnpj          VARCHAR(18) UNIQUE,
        rg            VARCHAR(20),
        estado_civil  VARCHAR(30),
        conjuge       VARCHAR(200),
        profissao     VARCHAR(100),
        endereco      VARCHAR(300),
        bairro        VARCHAR(100),
        cidade        VARCHAR(100),
        estado        CHAR(2),
        cep           VARCHAR(9),
        complemento   VARCHAR(200),
        fone_res      VARCHAR(20),
        fone_com      VARCHAR(20),
        created_at    TIMESTAMP DEFAULT NOW(),
        updated_at    TIMESTAMP DEFAULT NOW()
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes(nome);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_clientes_cpf ON clientes(cpf);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_clientes_cnpj ON clientes(cnpj);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS clientes;`);
  }
}

