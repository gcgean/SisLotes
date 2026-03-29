import { Router } from "express";
import { AppDataSource } from "../../db/data-source";
import { Venda } from "../../entities/Venda";
import { Cliente } from "../../entities/Cliente";
import { Lote } from "../../entities/Lote";
import { Loteamento } from "../../entities/Loteamento";
import { Empresa } from "../../entities/Empresa";
import { Pagamento } from "../../entities/Pagamento";
import { AuthRequest, requireAuth } from "../../middleware/auth";

export const contratosRouter = Router();

/** GET /api/contratos/venda/:id_venda
 *  Retorna todos os dados necessários para geração do contrato
 */
contratosRouter.get("/venda/:id_venda", requireAuth, async (req: AuthRequest, res) => {
  const { id_venda } = req.params;
  const idEmpresa = req.user?.id_empresa;

  const vendaRepo    = AppDataSource.getRepository(Venda);
  const clienteRepo  = AppDataSource.getRepository(Cliente);
  const loteRepo     = AppDataSource.getRepository(Lote);
  const loteamRepo   = AppDataSource.getRepository(Loteamento);
  const empresaRepo  = AppDataSource.getRepository(Empresa);
  const pagRepo      = AppDataSource.getRepository(Pagamento);

  // Venda
  const whereVenda: Record<string, unknown> = { id_venda: Number(id_venda) };
  if (idEmpresa) whereVenda.id_empresa = idEmpresa;
  const venda = await vendaRepo.findOne({ where: whereVenda });
  if (!venda) return res.status(404).json({ error: "Venda não encontrada" });

  // Cliente
  const whereCliente: Record<string, unknown> = { id_cliente: venda.id_cliente };
  if (idEmpresa) whereCliente.id_empresa = idEmpresa;
  const cliente = await clienteRepo.findOne({ where: whereCliente });

  // Lote
  const whereLote: Record<string, unknown> = { id_lote: venda.id_lote };
  if (idEmpresa) whereLote.id_empresa = idEmpresa;
  const lote = await loteRepo.findOne({ where: whereLote });

  // Loteamento
  const loteamento = lote
    ? await loteamRepo.findOne({
        where: {
          id_loteamento: lote.id_loteamento,
          ...(idEmpresa ? { id_empresa: idEmpresa } : {}),
        },
      })
    : null;

  // Empresa
  const empresa = idEmpresa
    ? await empresaRepo.findOne({ where: { id_empresa: idEmpresa } })
    : null;

  // Pagamentos (resumo)
  const pagamentos = await pagRepo.find({
    where: {
      id_venda: Number(id_venda),
      ...(idEmpresa ? { id_empresa: idEmpresa } : {}),
    },
    order: { numero_parcela: "ASC" },
  });

  const valorTotal = pagamentos.reduce((acc, p) => acc + Number(p.valor ?? 0), 0);
  const primeiroPagamento = pagamentos[0] ?? null;

  return res.json({
    venda: {
      id_venda: venda.id_venda,
      data_venda: venda.data_venda,
      valor_entrada: Number(venda.valor_entrada ?? 0),
      parcelas: venda.parcelas,
      porcentagem: Number(venda.porcentagem ?? 0),
      status: venda.status,
      valor_total: valorTotal,
      valor_parcela: pagamentos.length > 0 ? Number(pagamentos[0].valor ?? 0) : 0,
      primeiro_vencimento: primeiroPagamento?.vencimento ?? null,
    },
    cliente: cliente ? {
      id_cliente: cliente.id_cliente,
      nome: cliente.nome,
      tipo: cliente.tipo,
      cpf: cliente.cpf ?? null,
      cnpj: cliente.cnpj ?? null,
      rg: cliente.rg ?? null,
      estado_civil: cliente.estado_civil ?? null,
      conjuge: cliente.conjuge ?? null,
      profissao: cliente.profissao ?? null,
      endereco: cliente.endereco ?? null,
      bairro: cliente.bairro ?? null,
      cidade: cliente.cidade ?? null,
      estado: cliente.estado ?? null,
      cep: cliente.cep ?? null,
      fone_res: cliente.fone_res ?? null,
      fone_com: cliente.fone_com ?? null,
    } : null,
    lote: lote ? {
      id_lote: lote.id_lote,
      lote: lote.lote,
      quadra: lote.quadra,
      area: lote.area ?? null,
      frente: lote.frente ?? null,
      fundo: lote.fundo ?? null,
      esquerdo: lote.esquerdo ?? null,
      direito: lote.direito ?? null,
    } : null,
    loteamento: loteamento ? {
      id_loteamento: loteamento.id_loteamento,
      nome: loteamento.nome,
      cidade: loteamento.cidade ?? null,
      estado: loteamento.estado ?? null,
      prop_nome: loteamento.prop_nome ?? null,
      prop_endereco: loteamento.prop_endereco ?? null,
      prop_bairro: loteamento.prop_bairro ?? null,
      prop_cidade: loteamento.prop_cidade ?? null,
      prop_estado: loteamento.prop_estado ?? null,
      prop_cep: loteamento.prop_cep ?? null,
      prop_fone: loteamento.prop_fone ?? null,
      cnpj: loteamento.cnpj ?? null,
    } : null,
    empresa: empresa ? {
      nome_fantasia: empresa.nome_fantasia,
      razao_social: empresa.razao_social ?? null,
      cnpj: empresa.cnpj ?? null,
      ie: empresa.ie ?? null,
      endereco: empresa.endereco ?? null,
      bairro: empresa.bairro ?? null,
      cidade: empresa.cidade ?? null,
      estado: empresa.estado ?? null,
      cep: empresa.cep ?? null,
      telefone: empresa.telefone ?? null,
      email: empresa.email ?? null,
      site: empresa.site ?? null,
      logo: empresa.logo ?? null,
    } : null,
  });
});

/** GET /api/contratos/cliente/:id_cliente/vendas
 *  Lista as vendas ativas de um cliente para selecionar qual gerar o contrato
 */
contratosRouter.get("/cliente/:id_cliente/vendas", requireAuth, async (req: AuthRequest, res) => {
  const { id_cliente } = req.params;
  const idEmpresa = req.user?.id_empresa;

  const query = `
    SELECT
      v.id_venda,
      v.status,
      v.data_venda,
      v.parcelas,
      v.valor_entrada,
      CONCAT('Quadra ', l.quadra, ' - Lote ', l.lote) AS lote_desc,
      lot.nome AS loteamento
    FROM vendas v
    JOIN lotes l ON l.id_lote = v.id_lote
    JOIN loteamentos lot ON lot.id_loteamento = l.id_loteamento
    WHERE v.id_cliente = $1
    ${idEmpresa ? "AND v.id_empresa = $2" : ""}
    ORDER BY v.data_venda DESC
  `;

  const params = idEmpresa ? [Number(id_cliente), idEmpresa] : [Number(id_cliente)];
  const rows = await AppDataSource.query(query, params);

  return res.json(rows);
});
