import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSugestoes1700000000019 implements MigrationInterface {
  name = "CreateSugestoes1700000000019";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sugestoes (
        id_sugestao SERIAL PRIMARY KEY,
        id_empresa INTEGER NOT NULL REFERENCES empresas(id_empresa) ON DELETE CASCADE,
        id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario),
        titulo VARCHAR(200) NOT NULL,
        descricao TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'em_analise', 'concluida')),
        resposta_admin TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sugestoes_empresa ON sugestoes(id_empresa)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sugestoes_status ON sugestoes(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sugestoes_created_at ON sugestoes(created_at)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS sugestoes`);
  }
}
