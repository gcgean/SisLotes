import { MigrationInterface, QueryRunner } from "typeorm";

export class AddChatAndAnexoToSugestoes1700000000033 implements MigrationInterface {
  name = "AddChatAndAnexoToSugestoes1700000000033";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE sugestoes ADD COLUMN IF NOT EXISTS anexo_nome VARCHAR(200)`);
    await queryRunner.query(`ALTER TABLE sugestoes ADD COLUMN IF NOT EXISTS anexo_base64 TEXT`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sugestao_mensagens (
        id_mensagem SERIAL PRIMARY KEY,
        id_sugestao INTEGER NOT NULL REFERENCES sugestoes(id_sugestao) ON DELETE CASCADE,
        id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario),
        autor_admin BOOLEAN NOT NULL DEFAULT FALSE,
        mensagem TEXT,
        anexo_nome VARCHAR(200),
        anexo_base64 TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sugestao_mensagens_sugestao ON sugestao_mensagens(id_sugestao)`);

    // Migra a antiga "resposta_admin" (resposta única) para a primeira mensagem
    // do chat, para não perder o histórico já registrado.
    await queryRunner.query(`
      INSERT INTO sugestao_mensagens (id_sugestao, id_usuario, autor_admin, mensagem, created_at)
      SELECT s.id_sugestao, COALESCE(
               (SELECT id_usuario FROM usuarios WHERE LOWER(login) = 'gcgean' LIMIT 1),
               s.id_usuario
             ), TRUE, s.resposta_admin, s.updated_at
      FROM sugestoes s
      WHERE s.resposta_admin IS NOT NULL AND TRIM(s.resposta_admin) <> ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS sugestao_mensagens`);
    await queryRunner.query(`ALTER TABLE sugestoes DROP COLUMN IF EXISTS anexo_base64`);
    await queryRunner.query(`ALTER TABLE sugestoes DROP COLUMN IF EXISTS anexo_nome`);
  }
}
