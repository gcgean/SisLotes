import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRelatoriosFechamento1700000000049 implements MigrationInterface {
  name = "CreateRelatoriosFechamento1700000000049";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE relatorios_fechamento_financeiro (
        id_relatorio bigserial PRIMARY KEY,
        id_empresa integer NOT NULL REFERENCES empresas(id_empresa) ON DELETE CASCADE,
        periodo_inicio date NOT NULL,
        periodo_fim date NOT NULL,
        fechado_por integer NOT NULL REFERENCES usuarios(id_usuario),
        desfeito_por integer REFERENCES usuarios(id_usuario),
        status varchar(20) NOT NULL DEFAULT 'fechado' CHECK (status IN ('fechado','desfeito')),
        resumo jsonb NOT NULL,
        lancamentos jsonb NOT NULL DEFAULT '[]'::jsonb,
        fechado_em timestamp NOT NULL DEFAULT now(),
        desfeito_em timestamp,
        CONSTRAINT ck_relatorio_fechamento_periodo CHECK (periodo_inicio <= periodo_fim)
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_relatorio_fechamento_empresa_data ON relatorios_fechamento_financeiro(id_empresa, periodo_fim DESC)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE relatorios_fechamento_financeiro`);
  }
}
