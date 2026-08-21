"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddContaFechamentoFinanceiro1700000000050 = void 0;
class AddContaFechamentoFinanceiro1700000000050 {
    constructor() {
        this.name = "AddContaFechamentoFinanceiro1700000000050";
    }
    async up(q) {
        await q.query(`ALTER TABLE fechamentos_financeiros RENAME TO fechamentos_financeiros_legado`);
        await q.query(`CREATE TABLE fechamentos_financeiros(id_fechamento bigserial PRIMARY KEY,id_empresa integer NOT NULL,id_conta integer REFERENCES contas(id_conta),fechado_ate date,id_usuario integer NOT NULL REFERENCES usuarios(id_usuario),created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now())`);
        await q.query(`INSERT INTO fechamentos_financeiros(id_empresa,id_conta,fechado_ate,id_usuario,created_at,updated_at) SELECT id_empresa,NULL,fechado_ate,id_usuario,created_at,updated_at FROM fechamentos_financeiros_legado`);
        await q.query(`DROP TABLE fechamentos_financeiros_legado`);
        await q.query(`CREATE UNIQUE INDEX uq_fechamento_empresa_escopo ON fechamentos_financeiros(id_empresa,COALESCE(id_conta,0))`);
        await q.query(`CREATE INDEX idx_fechamento_conta_data ON fechamentos_financeiros(id_empresa,id_conta,fechado_ate)`);
        await q.query(`ALTER TABLE relatorios_fechamento_financeiro ADD COLUMN id_conta integer REFERENCES contas(id_conta),ADD COLUMN conta_nome varchar(200)`);
        await q.query(`CREATE INDEX idx_relatorio_fechamento_conta ON relatorios_fechamento_financeiro(id_empresa,id_conta,periodo_fim DESC)`);
    }
    async down(q) {
        await q.query(`ALTER TABLE relatorios_fechamento_financeiro DROP COLUMN conta_nome,DROP COLUMN id_conta`);
        await q.query(`ALTER TABLE fechamentos_financeiros RENAME TO fechamentos_financeiros_por_conta`);
        await q.query(`CREATE TABLE fechamentos_financeiros(id_empresa integer PRIMARY KEY,fechado_ate date,id_usuario integer NOT NULL REFERENCES usuarios(id_usuario),created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now())`);
        await q.query(`INSERT INTO fechamentos_financeiros(id_empresa,fechado_ate,id_usuario,created_at,updated_at) SELECT id_empresa,fechado_ate,id_usuario,created_at,updated_at FROM fechamentos_financeiros_por_conta WHERE id_conta IS NULL`);
        await q.query(`DROP TABLE fechamentos_financeiros_por_conta`);
    }
}
exports.AddContaFechamentoFinanceiro1700000000050 = AddContaFechamentoFinanceiro1700000000050;
