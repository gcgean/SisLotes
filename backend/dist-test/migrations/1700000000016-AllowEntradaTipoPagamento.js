"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllowEntradaTipoPagamento1700000000016 = void 0;
class AllowEntradaTipoPagamento1700000000016 {
    constructor() {
        this.name = "AllowEntradaTipoPagamento1700000000016";
    }
    async up(queryRunner) {
        await queryRunner.query(`
      DO $$
      DECLARE c RECORD;
      BEGIN
        FOR c IN
          SELECT conname
          FROM pg_constraint
          WHERE conrelid = 'pagamentos'::regclass
            AND contype = 'c'
            AND pg_get_constraintdef(oid) ILIKE '%tipo%'
        LOOP
          EXECUTE format('ALTER TABLE pagamentos DROP CONSTRAINT IF EXISTS %I', c.conname);
        END LOOP;
      END $$;
    `);
        await queryRunner.query(`
      ALTER TABLE pagamentos
      ADD CONSTRAINT chk_pagamentos_tipo
      CHECK (tipo IN ('boleto', 'carne', 'entrada'));
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE pagamentos
      DROP CONSTRAINT IF EXISTS chk_pagamentos_tipo;
    `);
        await queryRunner.query(`
      ALTER TABLE pagamentos
      ADD CONSTRAINT chk_pagamentos_tipo
      CHECK (tipo IN ('boleto', 'carne'));
    `);
    }
}
exports.AllowEntradaTipoPagamento1700000000016 = AllowEntradaTipoPagamento1700000000016;
