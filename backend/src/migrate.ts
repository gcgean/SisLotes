
import { Client } from "pg";
import mysql from "mysql2/promise";

async function migrate() {
  console.log('Iniciando migração...');

  // Conexão MySQL (Origem)
  const mysqlConn = await mysql.createConnection({
    host: process.env.MYSQL_MIG_HOST ?? "185.100.215.16",
    user: process.env.MYSQL_MIG_USER ?? "root",
    password: process.env.MYSQL_MIG_PASSWORD ?? "SDGdfa45342",
    database: process.env.MYSQL_MIG_DB ?? "LO",
    port: Number(process.env.MYSQL_MIG_PORT ?? 3306),
  });
  console.log('Conectado ao MySQL (Origem)!');

  // Conexão PostgreSQL (Destino)
  const pgClient = new Client({
    host: process.env.PG_MIG_HOST ?? "localhost",
    port: Number(process.env.PG_MIG_PORT ?? 5433),
    user: process.env.PG_MIG_USER ?? "sislote",
    password: process.env.PG_MIG_PASSWORD ?? "sislote",
    database: process.env.PG_MIG_DB ?? "sislote",
  });
  await pgClient.connect();
  console.log('Conectado ao PostgreSQL (Destino)!');

  try {
    // 1. Limpar tabelas
    console.log('Limpando tabelas antigas...');
    await pgClient.query('DELETE FROM logs');
    await pgClient.query('DELETE FROM pagamentos');
    await pgClient.query('DELETE FROM vendas');
    await pgClient.query('DELETE FROM lotes');
    await pgClient.query('DELETE FROM loteamentos');
    await pgClient.query('DELETE FROM clientes');
    await pgClient.query('DELETE FROM contas');
    await pgClient.query('DELETE FROM usuarios');
    
    // 2. Migrar Usuários
    console.log('Migrando Usuários...');
    const [usuarios]: [any[], any] = await mysqlConn.execute('SELECT * FROM usuarios');
    for (const u of usuarios) {
      const userMaster = (u.user_master === 's' || u.user_master === 'S' || u.user_master === '1');
      const mapPerm = (val: any) => (val === 's' || val === 'S' || val === '1');

      try {
        await pgClient.query(`
          INSERT INTO usuarios (
            id_usuario, login, senha, user_master,
            clientes_cadastrar, clientes_alterar, clientes_excluir,
            loteamentos_cadastrar, loteamentos_alterar, loteamentos_excluir,
            vendas_cadastrar, vendas_alterar, vendas_excluir
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
          u.id_usuario,
          u.login || `user${u.id_usuario}`,
          u.senha || '123456',
          userMaster,
          mapPerm(u.clientes_cadastrar), mapPerm(u.clientes_alterar), mapPerm(u.clientes_excluir),
          mapPerm(u.loteamentos_cadastrar), mapPerm(u.loteamentos_alterar), mapPerm(u.loteamentos_excluir),
          mapPerm(u.vendas_cadastrar), mapPerm(u.vendas_alterar), mapPerm(u.vendas_excluir)
        ]);
      } catch (err: any) {
        if (err.code === '23505') { // Unique violation (login)
           console.warn(`Login duplicado para usuário ID ${u.id_usuario}. Alterando login...`);
           // Usar ID no sufixo para garantir unicidade
           const newLogin = (u.login || `user${u.id_usuario}`) + '_dup' + u.id_usuario;
           await pgClient.query(`
            INSERT INTO usuarios (
              id_usuario, login, senha, user_master,
              clientes_cadastrar, clientes_alterar, clientes_excluir,
              loteamentos_cadastrar, loteamentos_alterar, loteamentos_excluir,
              vendas_cadastrar, vendas_alterar, vendas_excluir
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          `, [
            u.id_usuario,
            newLogin,
            u.senha || '123456',
            userMaster,
            mapPerm(u.clientes_cadastrar), mapPerm(u.clientes_alterar), mapPerm(u.clientes_excluir),
            mapPerm(u.loteamentos_cadastrar), mapPerm(u.loteamentos_alterar), mapPerm(u.loteamentos_excluir),
            mapPerm(u.vendas_cadastrar), mapPerm(u.vendas_alterar), mapPerm(u.vendas_excluir)
          ]);
        } else {
          throw err;
        }
      }
    }
    console.log(`Migrados ${usuarios.length} usuários.`);

    // 3. Migrar Contas
    console.log('Migrando Contas...');
    const [contas]: [any[], any] = await mysqlConn.execute('SELECT * FROM contas');
    for (const c of contas) {
      await pgClient.query(`
        INSERT INTO contas (id_conta, apelido, titular, agencia, conta, convenio)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [c.id_conta, c.apelido, c.titular, c.agencia, c.conta, c.convenio]);
    }
    console.log(`Migradas ${contas.length} contas.`);

    // 4. Migrar Clientes
    console.log('Migrando Clientes...');
    const [clientes]: [any[], any] = await mysqlConn.execute('SELECT * FROM clientes');
    for (const c of clientes) {
      const tipo = c.tipo?.toLowerCase() || 'f';
      
      let endereco = c.endereco;
      let bairro = c.bairro;
      let cidade = c.cidade;
      let estado = c.estado;
      let cep = c.cep;
      let complemento = c.complemento;
      let fone_com = c.fone_com;
      
      if (tipo === 'j') {
         if (c.pj_endereco) endereco = c.pj_endereco;
         if (c.pj_bairro) bairro = c.pj_bairro;
         if (c.pj_cidade) cidade = c.pj_cidade;
         if (c.pj_estado) estado = c.pj_estado;
         if (c.pj_cep) cep = c.pj_cep;
         if (c.pj_complemento) complemento = c.pj_complemento;
         if (c.pj_fone_com) fone_com = c.pj_fone_com;
      }

      const emptyToNull = (val: any) => (val && typeof val === 'string' && val.trim() !== '') ? val.trim() : null;

      const params = [
        c.id_cliente,
        tipo,
        c.nome,
        c.razao_social,
        emptyToNull(c.cpf),
        emptyToNull(c.cnpj),
        emptyToNull(c.rg),
        endereco,
        bairro,
        cidade,
        estado,
        cep,
        complemento,
        c.fone_res,
        fone_com,
        c.estado_civil ? String(c.estado_civil) : null,
        c.conjuge,
        c.profissao
      ];

      try {
        await pgClient.query(`
          INSERT INTO clientes (
            id_cliente, tipo, nome, razao_social, cpf, cnpj, rg,
            endereco, bairro, cidade, estado, cep, complemento,
            fone_res, fone_com, estado_civil, conjuge, profissao
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        `, params);
      } catch (err: any) {
        if (err.code === '23505') { // Unique violation
          console.warn(`CPF/CNPJ duplicado para cliente ID ${c.id_cliente}. Inserindo sem documento...`);
          params[4] = null; // CPF
          params[5] = null; // CNPJ
          await pgClient.query(`
            INSERT INTO clientes (
              id_cliente, tipo, nome, razao_social, cpf, cnpj, rg,
              endereco, bairro, cidade, estado, cep, complemento,
              fone_res, fone_com, estado_civil, conjuge, profissao
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          `, params);
        } else {
          throw err;
        }
      }
    }
    console.log(`Migrados ${clientes.length} clientes.`);

    // 5. Migrar Loteamentos
    console.log('Migrando Loteamentos...');
    const [loteamentos]: [any[], any] = await mysqlConn.execute('SELECT * FROM loteamentos');
    for (const l of loteamentos) {
      const emptyToNull = (val: any) => (val && typeof val === 'string' && val.trim() !== '') ? val.trim() : null;

      await pgClient.query(`
        INSERT INTO loteamentos (
          id_loteamento, nome, endereco, cidade, estado,
          tipo_pessoa, prop_nome, cnpj, prop_endereco,
          prop_bairro, prop_cidade, prop_estado, prop_cep, prop_fone
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        l.id_loteamento,
        l.nome,
        l.endereco,
        l.cidade,
        l.estado,
        l.tipo_pessoa?.toLowerCase() || 'f',
        l.prop_nome || l.pj_nome,
        emptyToNull(l.cnpj),
        l.prop_endereco,
        l.prop_bairro,
        l.prop_cidade,
        l.prop_estado,
        l.prop_cep,
        l.prop_fone
      ]);
    }
    console.log(`Migrados ${loteamentos.length} loteamentos.`);

    // 6. Migrar Lotes
    console.log('Migrando Lotes...');
    const [lotes]: [any[], any] = await mysqlConn.execute('SELECT * FROM lotes');
    for (const l of lotes) {
      const toVarchar20 = (val: any) => {
        if (val === null || val === undefined) return null;
        const s = String(val);
        return s.length > 20 ? s.slice(0, 20) : s;
      };

      const params = [
        l.id_lote,
        l.id_loteamento,
        toVarchar20(l.lote),
        toVarchar20(l.quadra),
        toVarchar20(l.area),
        toVarchar20(l.frente),
        toVarchar20(l.fundo),
        toVarchar20(l.esquerdo),
        toVarchar20(l.direito)
      ];

      try {
        await pgClient.query(`
          INSERT INTO lotes (
            id_lote, id_loteamento, lote, quadra,
            area, frente, fundo, esquerdo, direito
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, params);
      } catch (err: any) {
        if (err.code === '23505') { // Unique violation
           console.warn(`Lote duplicado (ID ${l.id_lote}). Adicionando sufixo...`);
           const base = params[2] ?? '';
           const withSuffix = `${base} (DUP ${l.id_lote})`;
           params[2] = withSuffix.length > 20 ? withSuffix.slice(0, 20) : withSuffix;
           
           try {
              await pgClient.query(`
                INSERT INTO lotes (
                  id_lote, id_loteamento, lote, quadra,
                  area, frente, fundo, esquerdo, direito
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              `, params);
           } catch (e) {
             console.error(`Falha ao inserir lote duplicado ID ${l.id_lote} mesmo com sufixo. Pulando...`, e);
             throw e; 
           }
        } else if (err.code === '23503') {
           console.warn(`Lote ID ${l.id_lote} com loteamento inexistente (${l.id_loteamento}). Ignorando...`);
        } else {
           throw err;
        }
      }
    }
    console.log(`Migrados ${lotes.length} lotes.`);

    // 7. Migrar Vendas
    console.log('Migrando Vendas...');
    const [vendas]: [any[], any] = await mysqlConn.execute('SELECT * FROM vendas');
    for (const v of vendas) {
      let dataVenda = v.data_venda;
      if (!dataVenda) dataVenda = new Date();

      let valorEntrada = Number(v.valor_entrada) || 0;
      let parcelas = Number(v.parcelas) || 1;
      let porcentagem = Number(v.porcentagem) || 0;

      if (porcentagem > 999.99) porcentagem = 999.99;
      if (porcentagem < -999.99) porcentagem = -999.99;

      try {
        await pgClient.query(`
          INSERT INTO vendas (
            id_venda, id_cliente, id_lote, data_venda,
            valor_entrada, parcelas, porcentagem, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          v.id_venda,
          v.id_cliente,
          v.id_lote,
          dataVenda,
          valorEntrada,
          parcelas,
          porcentagem,
          'aberta'
        ]);
      } catch (err: any) {
        if (err.code === '23505') { // Lote já vendido?
          console.warn(`Venda duplicada para lote ${v.id_lote}. Ignorando venda ${v.id_venda}...`);
        } else if (err.code === '23503') { // FK violation (lote ou cliente não existe)
          console.warn(`Venda ${v.id_venda} referenciando cliente/lote inexistente. Ignorando...`);
        } else if (err.code === '22003') { // Numeric overflow
          console.warn(`Venda ${v.id_venda} com valores numéricos inválidos. Ignorando...`);
        } else {
          throw err;
        }
      }
    }
    console.log(`Migradas ${vendas.length} vendas.`);

    // 8. Migrar Pagamentos
    console.log('Migrando Pagamentos...');
    const [pagamentos]: [any[], any] = await mysqlConn.execute('SELECT * FROM pagamentos');
    let count = 0;
    
    for (const p of pagamentos) {
      let idConta = p.id_conta;
      if (idConta === 0) idConta = null;

      let idUsuario = p.id_usuario;
      if (idUsuario === 0) idUsuario = null;

      let situacao = p.situacao;
      if (!situacao) situacao = 'aberto';
      
      let tipo = p.tipo;
      if (!tipo) tipo = 'boleto';

      const parseDate = (val: any) => {
        if (!val) return null;
        const d = new Date(val);
        return Number.isNaN(d.getTime()) ? null : d;
      };

      const vencimento = parseDate(p.vencimento);
      if (!vencimento) {
        console.warn(`Pagamento ${p.id_pagamento} com vencimento inválido. Ignorando...`);
        continue;
      }

      const pagoData = parseDate(p.pago_data);
      const valor = Number(p.valor) || 0;
      const valorPago = p.valor_pago != null ? Number(p.valor_pago) : null;

      try {
        await pgClient.query(`
          INSERT INTO pagamentos (
            id_pagamento, id_venda, id_conta, id_usuario,
            numero_parcela, tipo, situacao, vencimento,
            valor, pago_data, valor_pago
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          p.id_pagamento,
          p.id_venda,
          idConta,
          idUsuario,
          p.numero_parcela,
          tipo,
          situacao,
          vencimento,
          valor,
          pagoData,
          valorPago
        ]);
        count++;
      } catch (err: any) {
        if (err.code === '23503') {
          console.warn(`Pagamento ${p.id_pagamento} órfão (venda/conta/usuário inexistente). Ignorando...`);
        } else if (err.code === '23505') {
          console.warn(`Pagamento duplicado para venda ${p.id_venda}, parcela ${p.numero_parcela}. Ignorando...`);
        } else {
          throw err;
        }
      }

      if (count % 5000 === 0) console.log(`Migrados ${count} pagamentos...`);
    }
    console.log(`Migrados ${count} pagamentos (Total).`);

    // Atualizar sequências
    console.log('Atualizando sequências do PostgreSQL...');
    
    const tables = [
      { name: 'usuarios', col: 'id_usuario' },
      { name: 'clientes', col: 'id_cliente' },
      { name: 'loteamentos', col: 'id_loteamento' },
      { name: 'lotes', col: 'id_lote' },
      { name: 'contas', col: 'id_conta' },
      { name: 'vendas', col: 'id_venda' },
      { name: 'pagamentos', col: 'id_pagamento' }
    ];

    for (const t of tables) {
      await pgClient.query(`
        SELECT setval('${t.name}_${t.col}_seq', (SELECT MAX(${t.col}) FROM ${t.name}) + 1);
      `);
    }

    console.log('MIGRAÇÃO CONCLUÍDA COM SUCESSO!');

  } catch (error) {
    console.error('ERRO FATAL NA MIGRAÇÃO:', error);
    if (error instanceof Error) {
        console.error('Stack:', error.stack);
    }
  } finally {
    await pgClient.end();
    await mysqlConn.end();
  }
}

migrate();
