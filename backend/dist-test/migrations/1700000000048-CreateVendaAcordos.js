"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateVendaAcordos1700000000048 = void 0;
class CreateVendaAcordos1700000000048 {
    constructor() {
        this.name = "CreateVendaAcordos1700000000048";
    }
    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE venda_acordos (id_acordo SERIAL PRIMARY KEY,id_empresa integer NOT NULL,id_venda integer NOT NULL REFERENCES vendas(id_venda),tipo varchar(20) NOT NULL CHECK(tipo IN('distrato','renegociacao')),motivo text NOT NULL,snapshot_antes jsonb NOT NULL,snapshot_depois jsonb NOT NULL,id_usuario integer NOT NULL REFERENCES usuarios(id_usuario),created_at timestamp NOT NULL DEFAULT now())`);
        await queryRunner.query(`CREATE INDEX idx_venda_acordos_venda ON venda_acordos(id_venda)`);
    }
    async down(queryRunner) { await queryRunner.query(`DROP TABLE venda_acordos`); }
}
exports.CreateVendaAcordos1700000000048 = CreateVendaAcordos1700000000048;
