"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddComissaoVenda1700000000047 = void 0;
class AddComissaoVenda1700000000047 {
    constructor() {
        this.name = "AddComissaoVenda1700000000047";
    }
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE vendas ADD COLUMN id_corretor integer REFERENCES fornecedores(id_fornecedor), ADD COLUMN comissao_percentual numeric(7,4), ADD COLUMN comissao_valor numeric(12,2), ADD COLUMN comissao_vencimento date`);
        await queryRunner.query(`ALTER TABLE despesas ADD COLUMN id_venda_origem integer REFERENCES vendas(id_venda)`);
        await queryRunner.query(`CREATE UNIQUE INDEX uq_despesas_comissao_venda ON despesas(id_venda_origem) WHERE id_venda_origem IS NOT NULL`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX uq_despesas_comissao_venda`);
        await queryRunner.query(`ALTER TABLE despesas DROP COLUMN id_venda_origem`);
        await queryRunner.query(`ALTER TABLE vendas DROP COLUMN comissao_vencimento, DROP COLUMN comissao_valor, DROP COLUMN comissao_percentual, DROP COLUMN id_corretor`);
    }
}
exports.AddComissaoVenda1700000000047 = AddComissaoVenda1700000000047;
