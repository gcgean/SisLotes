import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePlanoDeContas1700000000030 implements MigrationInterface {
  name = "CreatePlanoDeContas1700000000030";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS plano_de_contas (
        id_conta_contabil SERIAL PRIMARY KEY,
        id_empresa INTEGER NOT NULL,
        id_pai INTEGER REFERENCES plano_de_contas(id_conta_contabil) ON DELETE CASCADE,
        tipo VARCHAR(10) NOT NULL,
        codigo VARCHAR(20) NOT NULL,
        nome VARCHAR(150) NOT NULL,
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_plano_contas_pai ON plano_de_contas(id_pai)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_plano_contas_empresa ON plano_de_contas(id_empresa)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_plano_contas_tipo ON plano_de_contas(tipo)`);

    // Se a tabela antiga não existir (banco novo, sem despesas ainda), não há nada pra migrar.
    const [{ existe }] = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'categorias_despesa'
      ) AS existe
    `);

    if (existe) {
      // 1 nó raiz por grupo distinto, por empresa
      await queryRunner.query(`
        INSERT INTO plano_de_contas (id_empresa, id_pai, tipo, codigo, nome, ativo)
        SELECT id_empresa, NULL, 'despesa',
               ROW_NUMBER() OVER (PARTITION BY id_empresa ORDER BY grupo_nome)::text,
               grupo_nome, true
        FROM (
          SELECT DISTINCT id_empresa, COALESCE(grupo, 'Outras') AS grupo_nome
          FROM categorias_despesa
        ) g
      `);

      // 1 nó filho por categoria existente, sob o grupo correspondente
      await queryRunner.query(`
        INSERT INTO plano_de_contas (id_empresa, id_pai, tipo, codigo, nome, ativo)
        SELECT cd.id_empresa, pai.id_conta_contabil, 'despesa',
               pai.codigo || '.' || ROW_NUMBER() OVER (PARTITION BY cd.id_empresa, cd.grupo ORDER BY cd.nome),
               cd.nome, cd.ativo
        FROM categorias_despesa cd
        JOIN plano_de_contas pai
          ON pai.id_empresa = cd.id_empresa
         AND pai.nome = COALESCE(cd.grupo, 'Outras')
         AND pai.id_pai IS NULL
      `);

      // Nó de fallback "Outras > Não classificado" por empresa, pra qualquer despesa que não mapear
      await queryRunner.query(`
        INSERT INTO plano_de_contas (id_empresa, id_pai, tipo, codigo, nome, ativo)
        SELECT DISTINCT e.id_empresa, NULL::integer, 'despesa',
               (SELECT COALESCE(MAX(p2.codigo::int), 0) + 1 FROM plano_de_contas p2 WHERE p2.id_empresa = e.id_empresa AND p2.id_pai IS NULL)::text,
               'Outras', true
        FROM empresas e
        WHERE NOT EXISTS (
          SELECT 1 FROM plano_de_contas p WHERE p.id_empresa = e.id_empresa AND p.nome = 'Outras' AND p.id_pai IS NULL
        )
      `);
      await queryRunner.query(`
        INSERT INTO plano_de_contas (id_empresa, id_pai, tipo, codigo, nome, ativo)
        SELECT pai.id_empresa, pai.id_conta_contabil, 'despesa', pai.codigo || '.1', 'Não classificado', true
        FROM plano_de_contas pai
        WHERE pai.nome = 'Outras' AND pai.id_pai IS NULL
          AND NOT EXISTS (SELECT 1 FROM plano_de_contas c WHERE c.id_pai = pai.id_conta_contabil AND c.nome = 'Não classificado')
      `);

      // Repointa despesas.id_categoria pro novo plano de contas (fallback = "Outras > Não classificado")
      await queryRunner.query(`
        UPDATE despesas d
        SET id_categoria = COALESCE(
          (
            SELECT novo.id_conta_contabil
            FROM plano_de_contas novo
            JOIN categorias_despesa antigo
              ON antigo.nome = novo.nome AND antigo.id_empresa = novo.id_empresa AND novo.id_pai IS NOT NULL
            WHERE antigo.id_categoria = d.id_categoria
            LIMIT 1
          ),
          (
            SELECT c.id_conta_contabil
            FROM plano_de_contas c
            JOIN plano_de_contas pai ON pai.id_conta_contabil = c.id_pai
            WHERE pai.nome = 'Outras' AND pai.id_empresa = d.id_empresa AND c.nome = 'Não classificado'
            LIMIT 1
          )
        )
      `);

      await queryRunner.query(`DROP TABLE categorias_despesa`);
    }

    await queryRunner.query(`ALTER TABLE lancamentos_manuais DROP COLUMN IF EXISTS categoria`);
    await queryRunner.query(`ALTER TABLE lancamentos_manuais ADD COLUMN IF NOT EXISTS id_conta_contabil INTEGER`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE lancamentos_manuais DROP COLUMN IF EXISTS id_conta_contabil`);
    await queryRunner.query(`ALTER TABLE lancamentos_manuais ADD COLUMN IF NOT EXISTS categoria VARCHAR(100)`);
    await queryRunner.query(`DROP TABLE IF EXISTS plano_de_contas`);
  }
}
