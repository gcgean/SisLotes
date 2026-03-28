import { AppDataSource } from "../db/data-source";
import { Auditoria } from "../entities/Auditoria";
import { AuthRequest } from "../middleware/auth";

export class AuditoriaService {
  static async registrar(
    req: AuthRequest,
    tabela: string,
    acao: "CREATE" | "UPDATE" | "DELETE",
    id_registro?: number,
    valores_antigos?: Record<string, any>,
    valores_novos?: Record<string, any>,
    descricao?: string
  ) {
    try {
      const auditoriaRepo = AppDataSource.getRepository(Auditoria);
      const ip_address = req.ip || (req.headers["x-forwarded-for"] as string)?.split(",")[0];

      const auditoria = auditoriaRepo.create({
        id_usuario: req.user?.id_usuario ?? 1,
        tabela,
        id_registro,
        acao,
        valores_antigos,
        valores_novos,
        descricao,
        ip_address: ip_address?.trim(),
        id_empresa: req.user?.id_empresa,
      });

      await auditoriaRepo.save(auditoria);
    } catch (error) {
      console.error("[Auditoria] Erro ao registrar:", error);
    }
  }

  static async registrarVenda(
    req: AuthRequest,
    acao: "CREATE" | "UPDATE" | "DELETE",
    id_venda: number,
    descricao: string,
    valores?: Record<string, any>
  ) {
    await this.registrar(
      req,
      "vendas",
      acao,
      id_venda,
      undefined,
      valores,
      descricao
    );
  }

  static async registrarPagamento(
    req: AuthRequest,
    acao: "CREATE" | "UPDATE" | "DELETE",
    id_pagamento: number,
    descricao: string,
    valores?: Record<string, any>
  ) {
    await this.registrar(
      req,
      "pagamentos",
      acao,
      id_pagamento,
      undefined,
      valores,
      descricao
    );
  }

  static async registrarCliente(
    req: AuthRequest,
    acao: "CREATE" | "UPDATE" | "DELETE",
    id_cliente: number,
    descricao: string,
    valores?: Record<string, any>
  ) {
    await this.registrar(
      req,
      "clientes",
      acao,
      id_cliente,
      undefined,
      valores,
      descricao
    );
  }

  static async registrarLote(
    req: AuthRequest,
    acao: "CREATE" | "UPDATE" | "DELETE",
    id_lote: number,
    descricao: string,
    valores?: Record<string, any>
  ) {
    await this.registrar(
      req,
      "lotes",
      acao,
      id_lote,
      undefined,
      valores,
      descricao
    );
  }
}
