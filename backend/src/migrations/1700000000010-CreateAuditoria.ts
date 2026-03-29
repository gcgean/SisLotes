import { MigrationInterface, QueryRunner, Table, TableForeignKey } from "typeorm";

export class CreateAuditoria1700000000010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
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
      }),
      true
    );

    await queryRunner.createForeignKey(
      "auditoria",
      new TableForeignKey({
        columnNames: ["id_usuario"],
        referencedColumnNames: ["id_usuario"],
        referencedTableName: "usuarios",
        onDelete: "CASCADE",
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("auditoria");
    if (table) {
      const foreignKey = table.foreignKeys.find(
        (fk) => fk.columnNames.indexOf("id_usuario") !== -1
      );
      if (foreignKey) {
        await queryRunner.dropForeignKey("auditoria", foreignKey);
      }
      await queryRunner.dropTable("auditoria");
    }
  }
}
