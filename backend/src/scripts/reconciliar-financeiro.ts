import "reflect-metadata";
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "pg";

type ItemMapeamento = { id_conta: number };
type Mapeamento = {
  recebimentos?: Array<ItemMapeamento & { id_pagamento: number }>;
  despesas?: Array<ItemMapeamento & { id_despesa_parcela: number }>;
};

function criarCliente(): Client {
  return new Client({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 5433),
    user: process.env.DB_USER || "sislote",
    password: process.env.DB_PASSWORD || "sislote",
    database: process.env.DB_NAME || "sislote",
  });
}

async function gerarRelatorio(client: Client) {
  const recebimentos = await client.query(`
    SELECT p.id_pagamento, p.id_empresa, p.id_venda, p.numero_parcela,
           TO_CHAR(p.pago_data, 'YYYY-MM-DD') AS pago_data,
           COALESCE(p.valor_pago, p.valor)::numeric(12,2) AS valor_pago,
           c.nome AS cliente, lo.nome AS loteamento, l.quadra, l.lote
    FROM pagamentos p
    JOIN vendas v ON v.id_venda = p.id_venda
    JOIN clientes c ON c.id_cliente = v.id_cliente
    JOIN lotes l ON l.id_lote = v.id_lote
    JOIN loteamentos lo ON lo.id_loteamento = l.id_loteamento
    WHERE p.situacao = 'pago' AND p.id_conta IS NULL
    ORDER BY p.id_empresa, p.pago_data, p.id_pagamento`);
  const despesas = await client.query(`
    SELECT dp.id_despesa_parcela, dp.id_empresa, dp.id_despesa, dp.numero_parcela,
           TO_CHAR(dp.pago_data, 'YYYY-MM-DD') AS pago_data,
           dp.valor_pago::numeric(12,2) AS valor_pago, d.descricao,
           COALESCE(lo.nome, 'Administrativa') AS loteamento
    FROM despesa_parcelas dp
    JOIN despesas d ON d.id_despesa = dp.id_despesa
    LEFT JOIN loteamentos lo ON lo.id_loteamento = d.id_loteamento
    WHERE dp.situacao = 'pago' AND dp.id_conta IS NULL
    ORDER BY dp.id_empresa, dp.pago_data, dp.id_despesa_parcela`);
  const contas = await client.query(`
    SELECT id_conta, id_empresa, apelido, tipo
    FROM contas WHERE ativo = true ORDER BY id_empresa, apelido`);
  return { recebimentos: recebimentos.rows, despesas: despesas.rows, contasAtivas: contas.rows };
}

function validarMapeamento(valor: unknown): Mapeamento {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) throw new Error("Mapeamento deve ser um objeto JSON.");
  const entrada = valor as Mapeamento;
  for (const [grupo, chave] of [["recebimentos", "id_pagamento"], ["despesas", "id_despesa_parcela"]] as const) {
    const itens = entrada[grupo] ?? [];
    if (!Array.isArray(itens)) throw new Error(`${grupo} deve ser uma lista.`);
    const vistos = new Set<number>();
    for (const item of itens as Array<Record<string, unknown>>) {
      const id = Number(item[chave]);
      const idConta = Number(item.id_conta);
      if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(idConta) || idConta <= 0) {
        throw new Error(`${grupo}: ${chave} e id_conta devem ser inteiros positivos.`);
      }
      if (vistos.has(id)) throw new Error(`${grupo}: ${chave} ${id} está duplicado.`);
      vistos.add(id);
    }
  }
  return entrada;
}

async function aplicarMapeamento(client: Client, mapa: Mapeamento, confirmar: boolean) {
  await client.query("BEGIN");
  try {
    const alteracoes: Array<{ origem: string; id: number; id_conta: number; empresa: number }> = [];
    for (const item of mapa.recebimentos ?? []) {
      const result = await client.query(
        `SELECT p.id_empresa, c.id_conta
         FROM pagamentos p JOIN contas c ON c.id_conta = $2 AND c.id_empresa = p.id_empresa AND c.ativo = true
         WHERE p.id_pagamento = $1 AND p.situacao = 'pago' AND p.id_conta IS NULL FOR UPDATE OF p`,
        [item.id_pagamento, item.id_conta],
      );
      if (result.rowCount !== 1) throw new Error(`Recebimento ${item.id_pagamento} não está pago/sem conta ou a conta é inválida para a empresa.`);
      await client.query(`UPDATE pagamentos SET id_conta = $2 WHERE id_pagamento = $1`, [item.id_pagamento, item.id_conta]);
      alteracoes.push({ origem: "recebimento", id: item.id_pagamento, id_conta: item.id_conta, empresa: result.rows[0].id_empresa });
    }
    for (const item of mapa.despesas ?? []) {
      const result = await client.query(
        `SELECT dp.id_empresa, c.id_conta
         FROM despesa_parcelas dp JOIN contas c ON c.id_conta = $2 AND c.id_empresa = dp.id_empresa AND c.ativo = true
         WHERE dp.id_despesa_parcela = $1 AND dp.situacao = 'pago' AND dp.id_conta IS NULL FOR UPDATE OF dp`,
        [item.id_despesa_parcela, item.id_conta],
      );
      if (result.rowCount !== 1) throw new Error(`Despesa paga ${item.id_despesa_parcela} não está paga/sem conta ou a conta é inválida para a empresa.`);
      await client.query(`UPDATE despesa_parcelas SET id_conta = $2 WHERE id_despesa_parcela = $1`, [item.id_despesa_parcela, item.id_conta]);
      alteracoes.push({ origem: "pagamento", id: item.id_despesa_parcela, id_conta: item.id_conta, empresa: result.rows[0].id_empresa });
    }
    if (confirmar) await client.query("COMMIT");
    else await client.query("ROLLBACK");
    return { modo: confirmar ? "aplicado" : "simulação", alteracoes };
  } catch (erro) {
    await client.query("ROLLBACK");
    throw erro;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const applyIndex = args.indexOf("--apply");
  const confirmar = args.includes("--confirm");
  const client = criarCliente();
  await client.connect();
  try {
    if (applyIndex >= 0) {
      const arquivo = args[applyIndex + 1];
      if (!arquivo) throw new Error("Informe o arquivo após --apply.");
      const mapa = validarMapeamento(JSON.parse(await readFile(resolve(arquivo), "utf8")));
      console.log(JSON.stringify(await aplicarMapeamento(client, mapa, confirmar), null, 2));
      if (!confirmar) console.log("Simulação concluída com rollback. Use --confirm somente após revisar o resultado.");
    } else {
      console.log(JSON.stringify(await gerarRelatorio(client), null, 2));
    }
  } finally {
    await client.end();
  }
}

main().catch((erro) => {
  console.error(`Falha na reconciliação: ${erro instanceof Error ? erro.message : String(erro)}`);
  process.exitCode = 1;
});
