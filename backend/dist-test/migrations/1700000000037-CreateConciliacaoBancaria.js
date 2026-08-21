"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateConciliacaoBancaria1700000000037 = void 0;
class CreateConciliacaoBancaria1700000000037 {
    constructor() {
        this.name = "CreateConciliacaoBancaria1700000000037";
    }
    async up(q) {
        await q.query(`CREATE TABLE conciliacao_importacoes (id_importacao SERIAL PRIMARY KEY, id_empresa integer NOT NULL, id_conta integer NOT NULL REFERENCES contas(id_conta), nome_arquivo varchar(255) NOT NULL, hash_arquivo varchar(64) NOT NULL, id_usuario integer NOT NULL REFERENCES usuarios(id_usuario), created_at timestamp NOT NULL DEFAULT now(), UNIQUE(id_conta, hash_arquivo))`);
        await q.query(`CREATE TABLE conciliacao_itens (id_item SERIAL PRIMARY KEY, id_importacao integer NOT NULL REFERENCES conciliacao_importacoes(id_importacao) ON DELETE CASCADE, id_empresa integer NOT NULL, id_conta integer NOT NULL REFERENCES contas(id_conta), fitid varchar(255) NOT NULL, data date NOT NULL, tipo varchar(10) NOT NULL CHECK (tipo IN ('receita','despesa')), valor numeric(12,2) NOT NULL CHECK (valor > 0), descricao varchar(500) NOT NULL, status varchar(12) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','conciliado','ignorado')), UNIQUE(id_conta, fitid))`);
        await q.query(`CREATE INDEX idx_conciliacao_itens_fila ON conciliacao_itens(id_empresa,id_conta,status,data)`);
        await q.query(`CREATE TABLE conciliacao_vinculos (id_vinculo SERIAL PRIMARY KEY, id_item integer NOT NULL UNIQUE REFERENCES conciliacao_itens(id_item) ON DELETE CASCADE, id_empresa integer NOT NULL, id_conta integer NOT NULL REFERENCES contas(id_conta), origem varchar(20) NOT NULL, id_origem integer NOT NULL, id_usuario integer NOT NULL REFERENCES usuarios(id_usuario), created_at timestamp NOT NULL DEFAULT now(), UNIQUE(id_conta, origem, id_origem))`);
    }
    async down(q) {
        await q.query(`DROP TABLE conciliacao_vinculos`);
        await q.query(`DROP TABLE conciliacao_itens`);
        await q.query(`DROP TABLE conciliacao_importacoes`);
    }
}
exports.CreateConciliacaoBancaria1700000000037 = CreateConciliacaoBancaria1700000000037;
