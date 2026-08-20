// ─── Registro de ferramentas do assistente ───────────────────────────────────
// Regras que valem para TODA ferramenta:
//
// 1. Isolamento por empresa: o id_empresa vem sempre do usuário autenticado
//    (contexto), nunca de um argumento que o modelo escreveu. O modelo pede
//    "buscar contas a receber"; o código decide de qual empresa.
// 2. Permissão: cada ferramenta declara a permissão exigida, checada com a
//    mesma regra do requirePermission — a IA nunca pode mais que o usuário.
// 3. Escrita nunca executa direto: ferramentas de escrita apenas *propõem* a
//    ação; quem confirma é o usuário na tela.
// 4. Dado do banco é informação, não instrução. O texto que volta de uma
//    ferramenta é conteúdo digitado por usuários (nome de cliente, descrição de
//    despesa) e pode conter tentativa de injeção — o prompt do sistema instrui
//    a tratá-lo como dado.

import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { Usuario } from "../../entities/Usuario";

type PermissaoIA =
  | "clientes_cadastrar"
  | "vendas_cadastrar"
  | "financeiro_estornar"
  | "financeiro_excluir"
  | "financeiro_lancar_retroativo";

export interface ContextoIA {
  usuario: Usuario;
  idEmpresa: number;
}

export interface Ferramenta<S extends z.ZodTypeAny = z.ZodTypeAny> {
  nome: string;
  /** Descrição prescritiva: diz QUANDO chamar, não só o que faz. */
  descricao: string;
  schema: S;
  /** Ferramenta de escrita só devolve proposta; execução exige confirmação. */
  escrita?: boolean;
  permissao?: PermissaoIA;
  executar: (args: z.infer<S>, ctx: ContextoIA) => Promise<unknown>;
}

export function podeUsar(ferramenta: Ferramenta, usuario: Usuario): boolean {
  if (!ferramenta.permissao) return true;
  if (usuario.user_master) return true;
  return Boolean(usuario[ferramenta.permissao]);
}

const moeda = (v: unknown) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

type Linha = Record<string, unknown>;

// ─── Consulta ────────────────────────────────────────────────────────────────

const listarLoteamentos: Ferramenta = {
  nome: "listar_loteamentos",
  descricao:
    "Lista os loteamentos da empresa com cidade e quantidade de lotes. Chame antes de qualquer outra " +
    "ferramenta que precise de um id de loteamento, ou quando o usuário citar um loteamento pelo nome.",
  schema: z.object({}),
  async executar(_args, ctx) {
    const linhas: Linha[] = await AppDataSource.query(
      `SELECT lo.id_loteamento, lo.nome, lo.cidade, lo.estado,
              COUNT(l.id_lote) AS total_lotes
       FROM loteamentos lo
       LEFT JOIN lotes l ON l.id_loteamento = lo.id_loteamento
       WHERE lo.id_empresa = $1
       GROUP BY lo.id_loteamento, lo.nome, lo.cidade, lo.estado
       ORDER BY lo.nome ASC`,
      [ctx.idEmpresa],
    );
    return linhas.map((r) => ({
      id: Number(r.id_loteamento),
      nome: r.nome,
      cidade: [r.cidade, r.estado].filter(Boolean).join("/") || null,
      totalLotes: Number(r.total_lotes ?? 0),
    }));
  },
};

const dividaPorLoteamento: Ferramenta = {
  nome: "divida_por_loteamento",
  descricao:
    "Quanto cada loteamento tem vendido, já recebido, em atraso e a vencer. Chame quando o usuário " +
    "perguntar sobre inadimplência, quanto tem a receber, ou a situação financeira de um loteamento.",
  schema: z.object({
    id_loteamento: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Filtra um loteamento específico. Omita para trazer todos."),
  }),
  async executar(args, ctx) {
    const params: unknown[] = [ctx.idEmpresa];
    let filtro = "";
    if (args.id_loteamento) {
      params.push(args.id_loteamento);
      filtro = `AND lo.id_loteamento = $${params.length}`;
    }
    const linhas: Linha[] = await AppDataSource.query(
      `SELECT lo.nome,
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
       ORDER BY lo.nome ASC`,
      params,
    );
    return linhas.map((r) => ({
      loteamento: r.nome,
      vendido: moeda(r.vendido),
      pago: moeda(r.pago),
      atrasado: moeda(r.atrasado),
      aVencer: moeda(r.a_vencer),
    }));
  },
};

const saldoDasContas: Ferramenta = {
  nome: "saldo_das_contas",
  descricao:
    "Saldo atual de cada conta bancária/caixa da empresa e o total geral. Chame quando o usuário " +
    "perguntar quanto tem em caixa, saldo disponível, ou quanto tem no banco.",
  schema: z.object({}),
  async executar(_args, ctx) {
    const linhas: Linha[] = await AppDataSource.query(
      `SELECT c.apelido, c.tipo,
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
       ORDER BY c.apelido ASC`,
      [ctx.idEmpresa],
    );
    const total = linhas.reduce((a, r) => a + Number(r.saldo ?? 0), 0);
    return {
      contas: linhas.map((r) => ({ conta: r.apelido, tipo: r.tipo, saldo: moeda(r.saldo) })),
      totalGeral: moeda(total),
    };
  },
};

const contasAPagar: Ferramenta = {
  nome: "contas_a_pagar",
  descricao:
    "Contas a pagar em aberto, com vencimento, fornecedor e se está atrasada. Chame quando o usuário " +
    "perguntar o que tem para pagar, quais contas estão atrasadas, ou o que vence num período.",
  schema: z.object({
    somente_atrasadas: z.boolean().optional().describe("true para trazer só o que já venceu."),
    ate_dias: z
      .number()
      .int()
      .positive()
      .max(365)
      .optional()
      .describe("Traz o que vence nos próximos N dias."),
  }),
  async executar(args, ctx) {
    const condicoes = ["d.id_empresa = $1", "dp.situacao = 'aberto'"];
    const params: unknown[] = [ctx.idEmpresa];
    if (args.somente_atrasadas) condicoes.push("dp.vencimento < CURRENT_DATE");
    if (args.ate_dias) {
      params.push(args.ate_dias);
      condicoes.push(`dp.vencimento <= CURRENT_DATE + make_interval(days => $${params.length})`);
    }
    const linhas: Linha[] = await AppDataSource.query(
      `SELECT d.descricao, f.nome AS fornecedor, dp.valor,
              TO_CHAR(dp.vencimento, 'DD/MM/YYYY') AS vencimento,
              (dp.vencimento < CURRENT_DATE) AS atrasada
       FROM despesa_parcelas dp
       JOIN despesas d ON d.id_despesa = dp.id_despesa
       LEFT JOIN fornecedores f ON f.id_fornecedor = d.id_fornecedor
       WHERE ${condicoes.join(" AND ")}
       ORDER BY dp.vencimento ASC
       LIMIT 100`,
      params,
    );
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

const buscarCliente: Ferramenta = {
  nome: "buscar_cliente",
  descricao:
    "Procura clientes por parte do nome ou CPF/CNPJ e devolve a situação das parcelas de cada um. " +
    "Chame quando o usuário citar uma pessoa pelo nome e quiser saber a situação dela.",
  schema: z.object({
    termo: z.string().min(2).describe("Parte do nome ou do CPF/CNPJ."),
  }),
  async executar(args, ctx) {
    const linhas: Linha[] = await AppDataSource.query(
      `SELECT c.id_cliente, c.nome, c.cpf,
              COUNT(p.id_pagamento) FILTER (WHERE p.situacao = 'aberto' AND p.vencimento < CURRENT_DATE) AS parcelas_atrasadas,
              COALESCE(SUM(p.valor) FILTER (WHERE p.situacao = 'aberto'), 0) AS em_aberto
       FROM clientes c
       LEFT JOIN vendas v ON v.id_cliente = c.id_cliente AND v.status <> 'cancelada'
       LEFT JOIN pagamentos p ON p.id_venda = v.id_venda
       WHERE c.id_empresa = $1 AND (c.nome ILIKE $2 OR c.cpf ILIKE $2)
       GROUP BY c.id_cliente, c.nome, c.cpf
       ORDER BY c.nome ASC
       LIMIT 20`,
      [ctx.idEmpresa, `%${args.termo}%`],
    );
    return linhas.map((r) => ({
      id: Number(r.id_cliente),
      nome: r.nome,
      cpf: r.cpf ?? null,
      parcelasAtrasadas: Number(r.parcelas_atrasadas ?? 0),
      emAberto: moeda(r.em_aberto),
    }));
  },
};

// ─── Escrita (apenas propõe; quem grava é a confirmação do usuário) ──────────

const proporContaAPagar: Ferramenta = {
  nome: "propor_conta_a_pagar",
  descricao:
    "Prepara o cadastro de uma nova conta a pagar para o usuário revisar e confirmar. Use quando o " +
    "usuário pedir para lançar/cadastrar uma despesa. NÃO grava nada: devolve a proposta para confirmação.",
  escrita: true,
  schema: z.object({
    descricao: z.string().min(1).max(200),
    valor_total: z.number().positive(),
    data_primeiro_vencimento: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD"),
    numero_parcelas: z.number().int().min(1).max(360).optional(),
    id_loteamento: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Omita para lançar como despesa administrativa da empresa."),
  }),
  async executar(args, ctx) {
    // Confere que o loteamento citado é mesmo da empresa do usuário.
    if (args.id_loteamento) {
      const [lote] = await AppDataSource.query(
        `SELECT nome FROM loteamentos WHERE id_loteamento = $1 AND id_empresa = $2`,
        [args.id_loteamento, ctx.idEmpresa],
      );
      if (!lote) {
        return { erro: "Loteamento não encontrado nesta empresa. Liste os loteamentos antes." };
      }
    }
    return {
      tipoProposta: "conta_a_pagar",
      // O frontend usa isto para abrir o formulário já preenchido.
      dados: {
        descricao: args.descricao,
        valor_total: args.valor_total,
        data_primeiro_vencimento: args.data_primeiro_vencimento,
        numero_parcelas: args.numero_parcelas ?? 1,
        id_loteamento: args.id_loteamento ?? null,
      },
      aviso: "Proposta montada. Nada foi gravado — o usuário precisa confirmar na tela.",
    };
  },
};

export const FERRAMENTAS: Ferramenta[] = [
  listarLoteamentos,
  dividaPorLoteamento,
  saldoDasContas,
  contasAPagar,
  buscarCliente,
  proporContaAPagar,
];

export function ferramentasPara(usuario: Usuario): Ferramenta[] {
  return FERRAMENTAS.filter((f) => podeUsar(f, usuario));
}
