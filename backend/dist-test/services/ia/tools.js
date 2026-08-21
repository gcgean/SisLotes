"use strict";
// ─── Registro de ferramentas do assistente ───────────────────────────────────
// Regras que valem para TODA ferramenta:
//
// 1. Isolamento por empresa: o id_empresa vem sempre do usuário autenticado
//    (contexto), nunca de um argumento que o modelo escreveu. O modelo pede
//    "buscar contas a receber"; o código decide de qual empresa. Consultas são
//    conferidas por exigirEscopoDeEmpresa().
// 2. Permissão: cada ferramenta declara a permissão exigida, checada com a
//    mesma regra do requirePermission — a IA nunca pode mais que o usuário.
// 3. Nível de risco: "consulta" e "escrita" executam direto; "critica"
//    (irreversível ou que mexe em dinheiro já movimentado) exige confirmação.
// 4. Dado do banco é informação, não instrução. O prompt do sistema instrui a
//    tratar o retorno das ferramentas como dado — nomes de cliente e descrições
//    são texto digitado por usuários e podem conter tentativa de injeção.
// 5. Nada sensível sai: o resultado passa por sanitizar() no orquestrador.
Object.defineProperty(exports, "__esModule", { value: true });
exports.FERRAMENTAS = void 0;
exports.podeUsar = podeUsar;
exports.ferramentasPara = ferramentasPara;
const zod_1 = require("zod");
const data_source_1 = require("../../db/data-source");
const Despesa_1 = require("../../entities/Despesa");
const DespesaParcela_1 = require("../../entities/DespesaParcela");
const LancamentoManual_1 = require("../../entities/LancamentoManual");
const despesas_1 = require("../../routes/modules/despesas");
const plano_contas_1 = require("../../utils/plano-contas");
const seguranca_1 = require("./seguranca");
function podeUsar(ferramenta, usuario) {
    if (!ferramenta.permissao)
        return true;
    if (usuario.user_master)
        return true;
    return Boolean(usuario[ferramenta.permissao]);
}
const moeda = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));
/** Consulta com a trava de escopo por empresa aplicada antes de rodar. */
async function consultar(origem, sql, params) {
    (0, seguranca_1.exigirEscopoDeEmpresa)(sql, origem);
    return data_source_1.AppDataSource.query(sql, params);
}
// ─── Consulta ────────────────────────────────────────────────────────────────
const listarLoteamentos = {
    nome: "listar_loteamentos",
    descricao: "Lista os loteamentos da empresa com cidade e quantidade de lotes. Chame antes de qualquer outra " +
        "ferramenta que precise de um id de loteamento, ou quando o usuário citar um loteamento pelo nome.",
    risco: "consulta",
    schema: zod_1.z.object({}),
    async executar(_args, ctx) {
        const linhas = await consultar("listar_loteamentos", `SELECT lo.id_loteamento, lo.nome, lo.cidade, lo.estado,
              COUNT(l.id_lote) AS total_lotes
       FROM loteamentos lo
       LEFT JOIN lotes l ON l.id_loteamento = lo.id_loteamento
       WHERE lo.id_empresa = $1
       GROUP BY lo.id_loteamento, lo.nome, lo.cidade, lo.estado
       ORDER BY lo.nome ASC`, [ctx.idEmpresa]);
        return linhas.map((r) => ({
            id: Number(r.id_loteamento),
            nome: r.nome,
            cidade: [r.cidade, r.estado].filter(Boolean).join("/") || null,
            totalLotes: Number(r.total_lotes ?? 0),
        }));
    },
};
const dividaPorLoteamento = {
    nome: "divida_por_loteamento",
    descricao: "Quanto cada loteamento tem vendido, já recebido, em atraso e a vencer. Chame quando o usuário " +
        "perguntar sobre inadimplência, quanto tem a receber, ou a situação financeira de um loteamento.",
    risco: "consulta",
    schema: zod_1.z.object({
        id_loteamento: zod_1.z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Filtra um loteamento específico. Omita para trazer todos."),
    }),
    async executar(args, ctx) {
        const params = [ctx.idEmpresa];
        let filtro = "";
        if (args.id_loteamento) {
            params.push(args.id_loteamento);
            filtro = `AND lo.id_loteamento = $${params.length}`;
        }
        const linhas = await consultar("divida_por_loteamento", `SELECT lo.nome,
              COALESCE(SUM(p.valor), 0) AS vendido,
              COALESCE(SUM(CASE WHEN p.situacao = 'pago' THEN COALESCE(p.valor_pago, p.valor) ELSE 0 END), 0) AS pago,
              COALESCE(SUM(CASE WHEN p.situacao = 'aberto' AND p.vencimento < CURRENT_DATE THEN p.valor ELSE 0 END), 0) AS atrasado,
              COALESCE(SUM(CASE WHEN p.situacao = 'aberto' AND p.vencimento >= CURRENT_DATE THEN p.valor ELSE 0 END), 0) AS a_vencer
       FROM loteamentos lo
       LEFT JOIN lotes l ON l.id_loteamento = lo.id_loteamento
       LEFT JOIN vendas v ON v.id_lote = l.id_lote AND v.status <> 'cancelada'
       LEFT JOIN pagamentos p ON p.id_venda = v.id_venda
       WHERE lo.id_empresa = $1 ${filtro}
       GROUP BY lo.id_loteamento, lo.nome
       ORDER BY lo.nome ASC`, params);
        return linhas.map((r) => ({
            loteamento: r.nome,
            vendido: moeda(r.vendido),
            pago: moeda(r.pago),
            atrasado: moeda(r.atrasado),
            aVencer: moeda(r.a_vencer),
        }));
    },
};
const saldoDasContas = {
    nome: "saldo_das_contas",
    descricao: "Saldo atual de cada conta bancária/caixa da empresa e o total geral. Chame quando o usuário " +
        "perguntar quanto tem em caixa, saldo disponível, ou quanto tem no banco.",
    risco: "consulta",
    schema: zod_1.z.object({}),
    async executar(_args, ctx) {
        const linhas = await consultar("saldo_das_contas", `SELECT c.id_conta, c.apelido, c.tipo,
              c.saldo_inicial
              + COALESCE((SELECT SUM(COALESCE(p.valor_pago, p.valor)) FROM pagamentos p
                          JOIN vendas v ON v.id_venda = p.id_venda
                          WHERE p.id_conta = c.id_conta AND p.situacao = 'pago' AND v.status <> 'cancelada'), 0)
              + COALESCE((SELECT SUM(l.valor) FROM lancamentos_manuais l
                          WHERE l.id_conta = c.id_conta AND l.tipo = 'receita'), 0)
              - COALESCE((SELECT SUM(dp.valor_pago) FROM despesa_parcelas dp
                          WHERE dp.id_conta = c.id_conta AND dp.situacao = 'pago'), 0)
              - COALESCE((SELECT SUM(l2.valor) FROM lancamentos_manuais l2
                          WHERE l2.id_conta = c.id_conta AND l2.tipo = 'despesa'), 0) AS saldo
       FROM contas c
       WHERE c.id_empresa = $1 AND c.ativo = true
       ORDER BY c.apelido ASC`, [ctx.idEmpresa]);
        const total = linhas.reduce((a, r) => a + Number(r.saldo ?? 0), 0);
        return {
            contas: linhas.map((r) => ({
                id: Number(r.id_conta),
                conta: r.apelido,
                tipo: r.tipo,
                saldo: moeda(r.saldo),
            })),
            totalGeral: moeda(total),
        };
    },
};
const contasAPagar = {
    nome: "contas_a_pagar",
    descricao: "Contas a pagar em aberto, com vencimento, fornecedor e se está atrasada. Chame quando o usuário " +
        "perguntar o que tem para pagar, quais contas estão atrasadas, ou o que vence num período.",
    risco: "consulta",
    schema: zod_1.z.object({
        somente_atrasadas: zod_1.z.boolean().optional().describe("true para trazer só o que já venceu."),
        ate_dias: zod_1.z
            .number()
            .int()
            .positive()
            .max(365)
            .optional()
            .describe("Traz o que vence nos próximos N dias."),
    }),
    async executar(args, ctx) {
        const condicoes = ["d.id_empresa = $1", "dp.situacao = 'aberto'"];
        const params = [ctx.idEmpresa];
        if (args.somente_atrasadas)
            condicoes.push("dp.vencimento < CURRENT_DATE");
        if (args.ate_dias) {
            params.push(args.ate_dias);
            condicoes.push(`dp.vencimento <= CURRENT_DATE + make_interval(days => $${params.length})`);
        }
        const linhas = await consultar("contas_a_pagar", `SELECT d.descricao, f.nome AS fornecedor, dp.valor,
              TO_CHAR(dp.vencimento, 'DD/MM/YYYY') AS vencimento,
              (dp.vencimento < CURRENT_DATE) AS atrasada
       FROM despesa_parcelas dp
       JOIN despesas d ON d.id_despesa = dp.id_despesa
       LEFT JOIN fornecedores f ON f.id_fornecedor = d.id_fornecedor
       WHERE ${condicoes.join(" AND ")}
       ORDER BY dp.vencimento ASC
       LIMIT 100`, params);
        const total = linhas.reduce((a, r) => a + Number(r.valor ?? 0), 0);
        return {
            total: moeda(total),
            quantidade: linhas.length,
            contas: linhas.map((r) => ({
                descricao: r.descricao,
                fornecedor: r.fornecedor ?? "—",
                valor: moeda(r.valor),
                vencimento: r.vencimento,
                atrasada: Boolean(r.atrasada),
            })),
        };
    },
};
const buscarCliente = {
    nome: "buscar_cliente",
    descricao: "Procura clientes por parte do nome ou CPF/CNPJ e devolve a situação das parcelas de cada um. " +
        "Chame quando o usuário citar uma pessoa pelo nome e quiser saber a situação dela.",
    risco: "consulta",
    schema: zod_1.z.object({
        termo: zod_1.z.string().min(2).describe("Parte do nome ou do CPF/CNPJ."),
    }),
    async executar(args, ctx) {
        const linhas = await consultar("buscar_cliente", `SELECT c.id_cliente, c.nome, c.cpf,
              COUNT(p.id_pagamento) FILTER (WHERE p.situacao = 'aberto' AND p.vencimento < CURRENT_DATE) AS parcelas_atrasadas,
              COALESCE(SUM(p.valor) FILTER (WHERE p.situacao = 'aberto'), 0) AS em_aberto
       FROM clientes c
       LEFT JOIN vendas v ON v.id_cliente = c.id_cliente AND v.status <> 'cancelada'
       LEFT JOIN pagamentos p ON p.id_venda = v.id_venda
       WHERE c.id_empresa = $1 AND (c.nome ILIKE $2 OR c.cpf ILIKE $2)
       GROUP BY c.id_cliente, c.nome, c.cpf
       ORDER BY c.nome ASC
       LIMIT 20`, [ctx.idEmpresa, `%${args.termo}%`]);
        return linhas.map((r) => ({
            id: Number(r.id_cliente),
            nome: r.nome,
            cpf: r.cpf ?? null,
            parcelasAtrasadas: Number(r.parcelas_atrasadas ?? 0),
            emAberto: moeda(r.em_aberto),
        }));
    },
};
const listarPlanoDeContas = {
    nome: "listar_plano_de_contas",
    descricao: "Lista as contas contábeis (categorias) que aceitam lançamento, separadas em receita e despesa. " +
        "Chame antes de criar uma conta a pagar ou um lançamento, para escolher a categoria correta.",
    risco: "consulta",
    schema: zod_1.z.object({
        tipo: zod_1.z.enum(["receita", "despesa"]).optional().describe("Filtra por tipo."),
    }),
    async executar(args, ctx) {
        const params = [ctx.idEmpresa];
        let filtro = "";
        if (args.tipo) {
            params.push(args.tipo);
            filtro = `AND pc.tipo = $${params.length}`;
        }
        const linhas = await consultar("listar_plano_de_contas", `SELECT pc.id_conta_contabil, pc.nome, pc.tipo
       FROM plano_de_contas pc
       WHERE pc.id_empresa = $1 ${filtro}
         AND NOT EXISTS (SELECT 1 FROM plano_de_contas f WHERE f.id_pai = pc.id_conta_contabil)
       ORDER BY pc.tipo, pc.nome`, params);
        return linhas.map((r) => ({
            id: Number(r.id_conta_contabil),
            nome: r.nome,
            tipo: r.tipo,
        }));
    },
};
// ─── Escrita: executa de verdade ─────────────────────────────────────────────
const criarContaAPagar = {
    nome: "criar_conta_a_pagar",
    descricao: "Cadastra uma nova conta a pagar (despesa) e gera as parcelas. Use quando o usuário pedir para " +
        "lançar, cadastrar ou registrar uma despesa. Antes de chamar, use listar_plano_de_contas para " +
        "escolher a categoria e listar_loteamentos se o usuário citar um loteamento. GRAVA no sistema.",
    risco: "escrita",
    schema: zod_1.z.object({
        descricao: zod_1.z.string().min(1).max(200),
        valor_total: zod_1.z.number().positive().max(99999999),
        id_categoria: zod_1.z.number().int().positive().describe("Id da conta contábil (listar_plano_de_contas)."),
        data_primeiro_vencimento: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD"),
        numero_parcelas: zod_1.z.number().int().min(1).max(360).optional(),
        id_loteamento: zod_1.z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Omita para lançar como despesa administrativa da empresa."),
        id_fornecedor: zod_1.z.number().int().positive().optional(),
    }),
    async executar(args, ctx) {
        // Todo id que veio do modelo é conferido contra a empresa do usuário antes de usar.
        if (args.id_loteamento) {
            const [lote] = await consultar("criar_conta_a_pagar/loteamento", `SELECT nome FROM loteamentos WHERE id_loteamento = $1 AND id_empresa = $2`, [args.id_loteamento, ctx.idEmpresa]);
            if (!lote)
                return { erro: "Loteamento não encontrado nesta empresa." };
        }
        if (args.id_fornecedor) {
            const [f] = await consultar("criar_conta_a_pagar/fornecedor", `SELECT nome FROM fornecedores WHERE id_fornecedor = $1 AND id_empresa = $2`, [args.id_fornecedor, ctx.idEmpresa]);
            if (!f)
                return { erro: "Fornecedor não encontrado nesta empresa." };
        }
        if (!(await (0, plano_contas_1.contaContabilAceitaLancamento)(args.id_categoria, ctx.idEmpresa, "despesa"))) {
            return {
                erro: "Categoria inválida: use uma conta contábil analítica de despesa (contas com subcontas não aceitam lançamento).",
            };
        }
        const numeroParcelas = args.numero_parcelas ?? 1;
        const despesaRepo = data_source_1.AppDataSource.getRepository(Despesa_1.Despesa);
        const parcelaRepo = data_source_1.AppDataSource.getRepository(DespesaParcela_1.DespesaParcela);
        const despesa = await despesaRepo.save(despesaRepo.create({
            id_empresa: ctx.idEmpresa,
            id_loteamento: args.id_loteamento ?? null,
            id_categoria: args.id_categoria,
            id_fornecedor: args.id_fornecedor ?? null,
            descricao: args.descricao,
            valor_total: args.valor_total.toFixed(2),
            numero_parcelas: numeroParcelas,
            recorrente: false,
            recorrencia_ativa: true,
        }));
        // Mesma função de rateio de centavos usada pela tela, para não divergir.
        const valores = (0, despesas_1.gerarValoresParcelas)(args.valor_total, numeroParcelas);
        await parcelaRepo.save(valores.map((valor, i) => parcelaRepo.create({
            id_empresa: ctx.idEmpresa,
            id_despesa: despesa.id_despesa,
            numero_parcela: i + 1,
            vencimento: (0, despesas_1.addMonths)(args.data_primeiro_vencimento, i),
            valor: valor.toFixed(2),
            situacao: "aberto",
        })));
        return {
            criado: true,
            id_despesa: despesa.id_despesa,
            descricao: despesa.descricao,
            valorTotal: moeda(args.valor_total),
            parcelas: numeroParcelas,
            primeiroVencimento: args.data_primeiro_vencimento,
        };
    },
};
const criarLancamento = {
    nome: "criar_lancamento",
    descricao: "Registra um lançamento manual de entrada (receita) ou saída (despesa) numa conta. Use quando o " +
        "usuário pedir para lançar uma entrada/saída avulsa no caixa ou banco. Antes, use saldo_das_contas " +
        "para pegar o id da conta e listar_plano_de_contas para a categoria. GRAVA no sistema.",
    risco: "escrita",
    schema: zod_1.z.object({
        tipo: zod_1.z.enum(["receita", "despesa"]),
        descricao: zod_1.z.string().min(1).max(200),
        valor: zod_1.z.number().positive().max(99999999),
        data: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD"),
        id_conta: zod_1.z.number().int().positive().describe("Id da conta (saldo_das_contas)."),
        id_conta_contabil: zod_1.z.number().int().positive().optional(),
        id_loteamento: zod_1.z.number().int().positive().optional(),
    }),
    async executar(args, ctx) {
        const [conta] = await consultar("criar_lancamento/conta", `SELECT apelido FROM contas WHERE id_conta = $1 AND id_empresa = $2 AND ativo = true`, [args.id_conta, ctx.idEmpresa]);
        if (!conta)
            return { erro: "Conta não encontrada nesta empresa ou inativa." };
        if (args.id_loteamento) {
            const [lote] = await consultar("criar_lancamento/loteamento", `SELECT nome FROM loteamentos WHERE id_loteamento = $1 AND id_empresa = $2`, [args.id_loteamento, ctx.idEmpresa]);
            if (!lote)
                return { erro: "Loteamento não encontrado nesta empresa." };
        }
        if (args.id_conta_contabil &&
            !(await (0, plano_contas_1.contaContabilAceitaLancamento)(args.id_conta_contabil, ctx.idEmpresa, args.tipo))) {
            return { erro: "Categoria inválida para este tipo de lançamento." };
        }
        const repo = data_source_1.AppDataSource.getRepository(LancamentoManual_1.LancamentoManual);
        const lancamento = await repo.save(repo.create({
            id_empresa: ctx.idEmpresa,
            id_conta: args.id_conta,
            id_conta_contabil: args.id_conta_contabil ?? null,
            id_loteamento: args.id_loteamento ?? null,
            tipo: args.tipo,
            descricao: args.descricao,
            valor: args.valor.toFixed(2),
            data: args.data,
        }));
        return {
            criado: true,
            id_lancamento: lancamento.id_lancamento,
            tipo: args.tipo,
            descricao: args.descricao,
            valor: moeda(args.valor),
            conta: conta.apelido,
            data: args.data,
        };
    },
};
exports.FERRAMENTAS = [
    listarLoteamentos,
    dividaPorLoteamento,
    saldoDasContas,
    contasAPagar,
    buscarCliente,
    listarPlanoDeContas,
    criarContaAPagar,
    criarLancamento,
];
function ferramentasPara(usuario) {
    return exports.FERRAMENTAS.filter((f) => podeUsar(f, usuario));
}
