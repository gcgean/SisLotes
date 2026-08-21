"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateReguaCobranca1700000000041 = void 0;
class CreateReguaCobranca1700000000041 {
    constructor() {
        this.name = "CreateReguaCobranca1700000000041";
    }
    async up(q) {
        await q.query(`ALTER TABLE clientes ADD COLUMN email varchar(200)`);
        await q.query(`CREATE TABLE cobranca_regras(id_regra SERIAL PRIMARY KEY,id_empresa integer NOT NULL,nome varchar(100) NOT NULL,dias_relativos integer NOT NULL CHECK(dias_relativos BETWEEN -365 AND 365),canal varchar(10) NOT NULL CHECK(canal IN('email','whatsapp')),assunto varchar(150),mensagem text NOT NULL,ativo boolean NOT NULL DEFAULT false,id_usuario integer NOT NULL REFERENCES usuarios(id_usuario),created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now())`);
        await q.query(`CREATE INDEX idx_cobranca_regras_empresa_ativo ON cobranca_regras(id_empresa,ativo)`);
        await q.query(`CREATE TABLE cobranca_comunicacoes(id_comunicacao SERIAL PRIMARY KEY,id_empresa integer NOT NULL,id_regra integer NOT NULL REFERENCES cobranca_regras(id_regra),id_pagamento integer NOT NULL REFERENCES pagamentos(id_pagamento),canal varchar(10) NOT NULL CHECK(canal IN('email','whatsapp')),destinatario varchar(200),mensagem text NOT NULL,status varchar(20) NOT NULL DEFAULT 'rascunho' CHECK(status IN('rascunho','enviada','erro','cancelada')),provedor varchar(100),id_externo varchar(150),erro text,created_at timestamp NOT NULL DEFAULT now())`);
        await q.query(`CREATE INDEX idx_cobranca_comunicacoes_empresa_status ON cobranca_comunicacoes(id_empresa,status)`);
        await q.query(`CREATE UNIQUE INDEX uq_cobranca_comunicacao_regra_pagamento ON cobranca_comunicacoes(id_regra,id_pagamento) WHERE status<>'cancelada'`);
    }
    async down(q) { await q.query(`DROP TABLE cobranca_comunicacoes`); await q.query(`DROP TABLE cobranca_regras`); await q.query(`ALTER TABLE clientes DROP COLUMN email`); }
}
exports.CreateReguaCobranca1700000000041 = CreateReguaCobranca1700000000041;
