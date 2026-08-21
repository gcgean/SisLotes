"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddPermissoesFinanceiras1700000000044 = void 0;
class AddPermissoesFinanceiras1700000000044 {
    constructor() {
        this.name = "AddPermissoesFinanceiras1700000000044";
    }
    async up(q) { await q.query(`ALTER TABLE usuarios ADD COLUMN financeiro_estornar boolean NOT NULL DEFAULT true,ADD COLUMN financeiro_excluir boolean NOT NULL DEFAULT true,ADD COLUMN financeiro_lancar_retroativo boolean NOT NULL DEFAULT true`); await q.query(`ALTER TABLE usuarios ALTER COLUMN financeiro_estornar SET DEFAULT false,ALTER COLUMN financeiro_excluir SET DEFAULT false,ALTER COLUMN financeiro_lancar_retroativo SET DEFAULT false`); }
    async down(q) { await q.query(`ALTER TABLE usuarios DROP COLUMN financeiro_estornar,DROP COLUMN financeiro_excluir,DROP COLUMN financeiro_lancar_retroativo`); }
}
exports.AddPermissoesFinanceiras1700000000044 = AddPermissoesFinanceiras1700000000044;
