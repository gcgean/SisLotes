"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddSalarioMinimoAndVendaSnapshots1700000000009 = void 0;
class AddSalarioMinimoAndVendaSnapshots1700000000009 {
    constructor() {
        this.name = "AddSalarioMinimoAndVendaSnapshots1700000000009";
    }
    async up(queryRunner) {
        // Adiciona salario_minimo na tabela empresas
        await queryRunner.query(`
      ALTER TABLE empresas
        ADD COLUMN IF NOT EXISTS salario_minimo DECIMAL(10,2) DEFAULT 0
    `);
        // Adiciona campos de snapshot na tabela vendas (para não depender da config futura)
        await queryRunner.query(`
      ALTER TABLE vendas
        ADD COLUMN IF NOT EXISTS salario_minimo_base DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS valor_parcela DECIMAL(10,2)
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE empresas
        DROP COLUMN IF EXISTS salario_minimo
    `);
        await queryRunner.query(`
      ALTER TABLE vendas
        DROP COLUMN IF EXISTS salario_minimo_base,
        DROP COLUMN IF EXISTS valor_parcela
    `);
    }
}
exports.AddSalarioMinimoAndVendaSnapshots1700000000009 = AddSalarioMinimoAndVendaSnapshots1700000000009;
