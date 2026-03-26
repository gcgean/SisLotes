import { MigrationInterface, QueryRunner } from "typeorm";

export class MultiTenantEnsureEmpresaGeral1700000000006 implements MigrationInterface {
  name = "MultiTenantEnsureEmpresaGeral1700000000006";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Garante que existe pelo menos uma empresa (Empresa Geral)
    //    Se já existe alguma empresa, não faz nada.
    await queryRunner.query(`
      INSERT INTO empresas (nome_fantasia, ativo, created_at, updated_at)
      SELECT 'Empresa Geral', true, NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM empresas LIMIT 1)
    `);

    // 2. Obtém o id da primeira empresa cadastrada
    const rows = await queryRunner.query(
      `SELECT id_empresa AS id FROM empresas ORDER BY id_empresa ASC LIMIT 1`
    );
    const empresaId = rows[0]?.id;

    if (!empresaId) {
      throw new Error("Não foi possível encontrar ou criar a empresa padrão.");
    }

    // 3. Vincula todos os registros sem empresa à empresa padrão
    const tabelas = [
      "clientes",
      "loteamentos",
      "lotes",
      "contas",
      "vendas",
      "pagamentos",
      "usuarios",
    ];

    for (const tabela of tabelas) {
      await queryRunner.query(
        `UPDATE ${tabela} SET id_empresa = $1 WHERE id_empresa IS NULL`,
        [empresaId]
      );
    }

    console.log(
      `[Migration 006] Todos os registros sem empresa foram vinculados à empresa id=${empresaId}`
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Reversão não aplicável — dados de produção são preservados
  }
}
