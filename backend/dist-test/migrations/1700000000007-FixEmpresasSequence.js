"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FixEmpresasSequence1700000000007 = void 0;
class FixEmpresasSequence1700000000007 {
    constructor() {
        this.name = "FixEmpresasSequence1700000000007";
    }
    async up(queryRunner) {
        // Corrige a sequência da tabela empresas após inserção com ID explícito
        await queryRunner.query(`
      SELECT setval(
        pg_get_serial_sequence('empresas', 'id_empresa'),
        COALESCE((SELECT MAX(id_empresa) FROM empresas), 0) + 1,
        false
      )
    `);
    }
    async down(_queryRunner) {
        // Não aplicável
    }
}
exports.FixEmpresasSequence1700000000007 = FixEmpresasSequence1700000000007;
