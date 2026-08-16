import { MigrationInterface, QueryRunner } from "typeorm";
export class CreateOrcamentosLoteamento1700000000042 implements MigrationInterface {
  name="CreateOrcamentosLoteamento1700000000042";
  async up(q:QueryRunner){await q.query(`CREATE TABLE orcamentos_loteamento(id_orcamento SERIAL PRIMARY KEY,id_empresa integer NOT NULL,id_loteamento integer NOT NULL REFERENCES loteamentos(id_loteamento),id_conta_contabil integer NOT NULL REFERENCES plano_de_contas(id_conta_contabil),mes date NOT NULL CHECK(EXTRACT(DAY FROM mes)=1),valor numeric(14,2) NOT NULL CHECK(valor>=0),id_usuario integer NOT NULL REFERENCES usuarios(id_usuario),created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now(),CONSTRAINT uq_orcamento_lote_conta_mes UNIQUE(id_empresa,id_loteamento,id_conta_contabil,mes))`);await q.query(`CREATE INDEX idx_orcamentos_empresa_mes ON orcamentos_loteamento(id_empresa,mes)`);}
  async down(q:QueryRunner){await q.query(`DROP TABLE orcamentos_loteamento`);}
}
