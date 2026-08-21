import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUsuarioLoginHistorico1700000000051 implements MigrationInterface {
  name = "CreateUsuarioLoginHistorico1700000000051";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS usuario_login_historico (
        id SERIAL PRIMARY KEY,
        id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
        id_empresa INTEGER NOT NULL REFERENCES empresas(id_empresa) ON DELETE CASCADE,
        ip_address VARCHAR(50),
        user_agent TEXT,
        dispositivo VARCHAR(20),
        navegador VARCHAR(40),
        sistema_operacional VARCHAR(40),
        data_hora TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_login_historico_data ON usuario_login_historico (data_hora DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_login_historico_usuario ON usuario_login_historico (id_usuario)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS usuario_login_historico`);
  }
}
