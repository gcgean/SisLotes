import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCoreTables1700000000001 implements MigrationInterface {
  name = "CreateCoreTables1700000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS loteamentos (
        id_loteamento SERIAL PRIMARY KEY,
        nome          VARCHAR(200) NOT NULL,
        endereco      VARCHAR(300),
        cidade        VARCHAR(100),
        estado        CHAR(2),
        tipo_pessoa   CHAR(1) CHECK (tipo_pessoa IN ('f', 'j')),
        prop_nome     VARCHAR(200),
        cnpj          VARCHAR(18),
        prop_endereco VARCHAR(300),
        prop_bairro   VARCHAR(100),
        prop_cidade   VARCHAR(100),
        prop_estado   CHAR(2),
        prop_cep      VARCHAR(9),
        prop_fone     VARCHAR(20),
        created_at    TIMESTAMP DEFAULT NOW(),
        updated_at    TIMESTAMP DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS lotes (
        id_lote        SERIAL PRIMARY KEY,
        id_loteamento  INTEGER NOT NULL REFERENCES loteamentos(id_loteamento),
        lote           VARCHAR(20) NOT NULL,
        quadra         VARCHAR(20) NOT NULL,
        area           VARCHAR(20),
        frente         VARCHAR(20),
        fundo          VARCHAR(20),
        esquerdo       VARCHAR(20),
        direito        VARCHAR(20),
        created_at     TIMESTAMP DEFAULT NOW(),
        UNIQUE(id_loteamento, quadra, lote)
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_lotes_loteamento ON lotes(id_loteamento);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS contas (
        id_conta   SERIAL PRIMARY KEY,
        apelido    VARCHAR(100) NOT NULL,
        titular    VARCHAR(200) NOT NULL,
        agencia    VARCHAR(20) NOT NULL,
        conta      VARCHAR(20) NOT NULL,
        convenio   VARCHAR(30),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id_usuario            SERIAL PRIMARY KEY,
        login                 VARCHAR(50) NOT NULL UNIQUE,
        senha                 VARCHAR(255) NOT NULL,
        user_master           BOOLEAN DEFAULT FALSE,
        clientes_cadastrar    BOOLEAN DEFAULT FALSE,
        clientes_alterar      BOOLEAN DEFAULT FALSE,
        clientes_excluir      BOOLEAN DEFAULT FALSE,
        loteamentos_cadastrar BOOLEAN DEFAULT FALSE,
        loteamentos_alterar   BOOLEAN DEFAULT FALSE,
        loteamentos_excluir   BOOLEAN DEFAULT FALSE,
        vendas_cadastrar      BOOLEAN DEFAULT FALSE,
        vendas_alterar        BOOLEAN DEFAULT FALSE,
        vendas_excluir        BOOLEAN DEFAULT FALSE,
        created_at            TIMESTAMP DEFAULT NOW(),
        updated_at            TIMESTAMP DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS vendas (
        id_venda       SERIAL PRIMARY KEY,
        id_cliente     INTEGER NOT NULL REFERENCES clientes(id_cliente),
        id_lote        INTEGER NOT NULL REFERENCES lotes(id_lote) UNIQUE,
        data_venda     DATE NOT NULL,
        valor_entrada  DECIMAL(12,2) NOT NULL DEFAULT 0,
        parcelas       INTEGER NOT NULL CHECK (parcelas > 0),
        porcentagem    DECIMAL(5,2) NOT NULL DEFAULT 0,
        status         VARCHAR(20) NOT NULL DEFAULT 'aberta'
                       CHECK (status IN ('aberta', 'quitada', 'cancelada')),
        created_at     TIMESTAMP DEFAULT NOW(),
        updated_at     TIMESTAMP DEFAULT NOW()
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_vendas_cliente ON vendas(id_cliente);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_vendas_lote ON vendas(id_lote);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS pagamentos (
        id_pagamento    SERIAL PRIMARY KEY,
        id_venda        INTEGER NOT NULL REFERENCES vendas(id_venda),
        id_conta        INTEGER REFERENCES contas(id_conta),
        id_usuario      INTEGER REFERENCES usuarios(id_usuario),
        numero_parcela  INTEGER NOT NULL,
        tipo            VARCHAR(10) NOT NULL DEFAULT 'boleto'
                        CHECK (tipo IN ('boleto', 'carne')),
        situacao        VARCHAR(10) NOT NULL DEFAULT 'aberto'
                        CHECK (situacao IN ('aberto', 'pago')),
        vencimento      DATE NOT NULL,
        valor           DECIMAL(12,2) NOT NULL,
        pago_data       DATE,
        valor_pago      DECIMAL(12,2),
        multa           DECIMAL(12,2) DEFAULT 0,
        juros           DECIMAL(12,2) DEFAULT 0,
        created_at      TIMESTAMP DEFAULT NOW(),
        updated_at      TIMESTAMP DEFAULT NOW(),
        UNIQUE(id_venda, numero_parcela)
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pagamentos_venda ON pagamentos(id_venda);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pagamentos_vencimento ON pagamentos(vencimento);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pagamentos_situacao ON pagamentos(situacao);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id_log      SERIAL PRIMARY KEY,
        id_usuario  INTEGER NOT NULL REFERENCES usuarios(id_usuario),
        id_cliente  INTEGER REFERENCES clientes(id_cliente),
        id_lote     INTEGER REFERENCES lotes(id_lote),
        servico     VARCHAR(100),
        url         VARCHAR(500),
        log         TEXT,
        query       TEXT,
        data_hora   TIMESTAMP DEFAULT NOW()
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_logs_usuario ON logs(id_usuario);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_logs_data ON logs(data_hora);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS logs;`);
    await queryRunner.query(`DROP TABLE IF EXISTS pagamentos;`);
    await queryRunner.query(`DROP TABLE IF EXISTS vendas;`);
    await queryRunner.query(`DROP TABLE IF EXISTS usuarios;`);
    await queryRunner.query(`DROP TABLE IF EXISTS contas;`);
    await queryRunner.query(`DROP TABLE IF EXISTS lotes;`);
    await queryRunner.query(`DROP TABLE IF EXISTS loteamentos;`);
  }
}

