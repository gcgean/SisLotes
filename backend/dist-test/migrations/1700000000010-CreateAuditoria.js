"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateAuditoria1700000000010 = void 0;
const typeorm_1 = require("typeorm");
class CreateAuditoria1700000000010 {
    async up(queryRunner) {
        await queryRunner.createTable(new typeorm_1.Table({
            name: "auditoria",
            columns: [
                {
                    name: "id_auditoria",
                    type: "int",
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: "increment",
                },
                {
                    name: "id_usuario",
                    type: "int",
                    isNullable: false,
                },
                {
                    name: "tabela",
                    type: "varchar",
                    isNullable: false,
                },
                {
                    name: "id_registro",
                    type: "int",
                    isNullable: true,
                },
                {
                    name: "acao",
                    type: "varchar",
                    isNullable: false,
                    default: "'CREATE'",
                },
                {
                    name: "valores_antigos",
                    type: "jsonb",
                    isNullable: true,
                },
                {
                    name: "valores_novos",
                    type: "jsonb",
                    isNullable: true,
                },
                {
                    name: "descricao",
                    type: "varchar",
                    isNullable: true,
                },
                {
                    name: "ip_address",
                    type: "varchar",
                    isNullable: true,
                },
                {
                    name: "data_hora",
                    type: "timestamp",
                    isNullable: false,
                    default: "CURRENT_TIMESTAMP",
                },
                {
                    name: "id_empresa",
                    type: "int",
                    isNullable: true,
                },
            ],
        }), true);
        await queryRunner.createForeignKey("auditoria", new typeorm_1.TableForeignKey({
            columnNames: ["id_usuario"],
            referencedColumnNames: ["id_usuario"],
            referencedTableName: "usuarios",
            onDelete: "CASCADE",
        }));
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable("auditoria");
        if (table) {
            const foreignKey = table.foreignKeys.find((fk) => fk.columnNames.indexOf("id_usuario") !== -1);
            if (foreignKey) {
                await queryRunner.dropForeignKey("auditoria", foreignKey);
            }
            await queryRunner.dropTable("auditoria");
        }
    }
}
exports.CreateAuditoria1700000000010 = CreateAuditoria1700000000010;
