import { MigrationInterface, QueryRunner } from "typeorm";

// O juros por atraso passa a poder ser expresso em R$ por dia, além de % ao dia.
// Coluna nova em vez de reinterpretar juros_percentual_dia: uma coluna chamada
// "percentual" guardando reais confundiria qualquer leitura futura, e manter as
// duas separadas deixa a configuração anterior intacta ao alternar o tipo.
export class AddJurosTipoToEmpresa1700000000052 implements MigrationInterface {
  name = "AddJurosTipoToEmpresa1700000000052";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE empresas ADD COLUMN IF NOT EXISTS juros_tipo VARCHAR(12) NOT NULL DEFAULT 'percentual'`,
    );
    await queryRunner.query(
      `ALTER TABLE empresas ADD COLUMN IF NOT EXISTS juros_valor_dia NUMERIC(12,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'chk_empresas_juros_tipo'
            AND conrelid = 'empresas'::regclass
        ) THEN
          ALTER TABLE empresas
          ADD CONSTRAINT chk_empresas_juros_tipo
          CHECK (juros_tipo IN ('percentual', 'valor'));
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE empresas DROP CONSTRAINT IF EXISTS chk_empresas_juros_tipo`);
    await queryRunner.query(`ALTER TABLE empresas DROP COLUMN IF EXISTS juros_valor_dia`);
    await queryRunner.query(`ALTER TABLE empresas DROP COLUMN IF EXISTS juros_tipo`);
  }
}
