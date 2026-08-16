# Reconciliação de históricos sem conta

O comando abaixo gera um relatório JSON somente leitura com recebimentos e despesas pagos sem conta, além das contas ativas disponíveis:

```bash
npm run financeiro:reconciliar
```

Para simular uma reconciliação, crie um JSON neste formato:

```json
{
  "recebimentos": [{ "id_pagamento": 123, "id_conta": 10 }],
  "despesas": [{ "id_despesa_parcela": 456, "id_conta": 10 }]
}
```

Execute primeiro sem confirmação. O script valida tudo dentro de uma transação e sempre faz rollback:

```bash
npm run financeiro:reconciliar -- --apply caminho/mapeamento.json
```

Somente depois de conferir a simulação, aplique explicitamente:

```bash
npm run financeiro:reconciliar -- --apply caminho/mapeamento.json --confirm
```

O script não altera valor, data ou situação. Ele atualiza apenas `id_conta`, exige conta ativa da mesma empresa e recusa registros que já tenham sido reconciliados.
