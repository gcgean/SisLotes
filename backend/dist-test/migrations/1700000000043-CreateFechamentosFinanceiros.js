"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateFechamentosFinanceiros1700000000043 = void 0;
class CreateFechamentosFinanceiros1700000000043 {
    constructor() {
        this.name = "CreateFechamentosFinanceiros1700000000043";
    }
    async up(q) { await q.query(`CREATE TABLE fechamentos_financeiros(id_empresa integer PRIMARY KEY,fechado_ate date,id_usuario integer NOT NULL REFERENCES usuarios(id_usuario),created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now())`); }
    async down(q) { await q.query(`DROP TABLE fechamentos_financeiros`); }
}
exports.CreateFechamentosFinanceiros1700000000043 = CreateFechamentosFinanceiros1700000000043;
