"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateDespesas1700000000028 = void 0;
const categorias_despesa_padrao_1 = require("../config/categorias-despesa-padrao");
class CreateDespesas1700000000028 {
    constructor() {
        this.name = "CreateDespesas1700000000028";
    }
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS categorias_despesa (
        id_categoria SERIAL PRIMARY KEY,
        id_empresa INTEGER NOT NULL,
        nome VARCHAR(100) NOT NULL,
        grupo VARCHAR(50),
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS fornecedores (
        id_fornecedor SERIAL PRIMARY KEY,
        id_empresa INTEGER NOT NULL,
        nome VARCHAR(200) NOT NULL,
        documento VARCHAR(18),
        telefone VARCHAR(20),
        email VARCHAR(200),
        contato VARCHAR(200),
        observacoes TEXT,
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS despesas (
        id_despesa SERIAL PRIMARY KEY,
        id_empresa INTEGER NOT NULL,
        id_loteamento INTEGER,
        id_categoria INTEGER NOT NULL,
        id_fornecedor INTEGER,
        descricao VARCHAR(300) NOT NULL,
        valor_total DECIMAL(12,2) NOT NULL,
        numero_parcelas INTEGER NOT NULL DEFAULT 1,
        documento VARCHAR(60),
        anexo_nome VARCHAR(200),
        anexo_base64 TEXT,
        observacoes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_despesas_empresa ON despesas(id_empresa)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_despesas_loteamento ON despesas(id_loteamento)`);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS despesa_parcelas (
        id_despesa_parcela SERIAL PRIMARY KEY,
        id_empresa INTEGER NOT NULL,
        id_despesa INTEGER NOT NULL REFERENCES despesas(id_despesa) ON DELETE CASCADE,
        numero_parcela INTEGER NOT NULL,
        vencimento DATE NOT NULL,
        valor DECIMAL(12,2) NOT NULL,
        situacao VARCHAR(10) NOT NULL DEFAULT 'aberto',
        pago_data DATE,
        valor_pago DECIMAL(12,2),
        id_conta INTEGER,
        id_usuario INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_despesa_parcelas_despesa ON despesa_parcelas(id_despesa)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_despesa_parcelas_vencimento ON despesa_parcelas(vencimento)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_despesa_parcelas_situacao ON despesa_parcelas(situacao)`);
        // Semeia as categorias padrão para toda empresa já existente (empresas novas recebem via setup.ts).
        const valuesSql = categorias_despesa_padrao_1.CATEGORIAS_DESPESA_PADRAO.map(({ nome, grupo }) => `('${nome.replace(/'/g, "''")}', '${grupo}')`).join(",\n        ");
        await queryRunner.query(`
      INSERT INTO categorias_despesa (id_empresa, nome, grupo)
      SELECT e.id_empresa, c.nome, c.grupo
      FROM empresas e
      CROSS JOIN (VALUES
        ${valuesSql}
      ) AS c(nome, grupo)
      WHERE NOT EXISTS (
        SELECT 1 FROM categorias_despesa cd WHERE cd.id_empresa = e.id_empresa
      )
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS despesa_parcelas`);
        await queryRunner.query(`DROP TABLE IF EXISTS despesas`);
        await queryRunner.query(`DROP TABLE IF EXISTS fornecedores`);
        await queryRunner.query(`DROP TABLE IF EXISTS categorias_despesa`);
    }
}
exports.CreateDespesas1700000000028 = CreateDespesas1700000000028;
