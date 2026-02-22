import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";
import { Venda } from "./Venda";
import { Conta } from "./Conta";
import { Usuario } from "./Usuario";

export type PagamentoTipo = "boleto" | "carne";
export type PagamentoSituacao = "aberto" | "pago";

@Entity({ name: "pagamentos" })
@Unique("uq_pagamentos_venda_parcela", ["id_venda", "numero_parcela"])
@Index("idx_pagamentos_venda", ["id_venda"])
@Index("idx_pagamentos_vencimento", ["vencimento"])
@Index("idx_pagamentos_situacao", ["situacao"])
export class Pagamento {
  @PrimaryGeneratedColumn({ name: "id_pagamento" })
  id_pagamento!: number;

  @Column({ type: "integer", name: "id_venda" })
  id_venda!: number;

  @ManyToOne(() => Venda, (venda) => venda.pagamentos)
  venda!: Venda;

  @Column({ type: "integer", name: "id_conta", nullable: true })
  id_conta!: number | null;

  @ManyToOne(() => Conta, (conta) => conta.pagamentos)
  conta!: Conta | null;

  @Column({ type: "integer", name: "id_usuario", nullable: true })
  id_usuario!: number | null;

  @ManyToOne(() => Usuario, (usuario) => usuario.pagamentos)
  usuario!: Usuario | null;

  @Column({ type: "integer", name: "numero_parcela" })
  numero_parcela!: number;

  @Column({ type: "varchar", length: 10, default: "boleto" })
  tipo!: PagamentoTipo;

  @Column({ type: "varchar", length: 10, default: "aberto" })
  situacao!: PagamentoSituacao;

  @Column({ type: "date" })
  vencimento!: string;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  valor!: string;

  @Column({ type: "date", name: "pago_data", nullable: true })
  pago_data!: string | null;

  @Column({ type: "decimal", precision: 12, scale: 2, name: "valor_pago", nullable: true })
  valor_pago!: string | null;

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  multa!: string;

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  juros!: string;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updated_at!: Date;
}

