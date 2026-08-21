"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddEncargosDespesaParcela1700000000038 = void 0;
class AddEncargosDespesaParcela1700000000038 {
    constructor() {
        this.name = "AddEncargosDespesaParcela1700000000038";
    }
    async up(q) { await q.query(`ALTER TABLE despesa_parcelas ADD COLUMN multa_paga numeric(12,2) NOT NULL DEFAULT 0, ADD COLUMN juros_pagos numeric(12,2) NOT NULL DEFAULT 0, ADD COLUMN desconto_obtido numeric(12,2) NOT NULL DEFAULT 0`); }
    async down(q) { await q.query(`ALTER TABLE despesa_parcelas DROP COLUMN desconto_obtido, DROP COLUMN juros_pagos, DROP COLUMN multa_paga`); }
}
exports.AddEncargosDespesaParcela1700000000038 = AddEncargosDespesaParcela1700000000038;
