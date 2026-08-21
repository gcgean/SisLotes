"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddReajustadoToPagamentos1700000000020 = void 0;
class AddReajustadoToPagamentos1700000000020 {
    constructor() {
        this.name = "AddReajustadoToPagamentos1700000000020";
    }
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS reajustado BOOLEAN NOT NULL DEFAULT FALSE`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE pagamentos DROP COLUMN IF EXISTS reajustado`);
    }
}
exports.AddReajustadoToPagamentos1700000000020 = AddReajustadoToPagamentos1700000000020;
