"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddLastLoginToUsuario1700000000027 = void 0;
class AddLastLoginToUsuario1700000000027 {
    constructor() {
        this.name = "AddLastLoginToUsuario1700000000027";
    }
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP NULL`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE usuarios DROP COLUMN IF EXISTS last_login_at`);
    }
}
exports.AddLastLoginToUsuario1700000000027 = AddLastLoginToUsuario1700000000027;
