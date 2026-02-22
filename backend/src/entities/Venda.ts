import { Column, CreateDateColumn, Entity, Index, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Cliente } from "./Cliente";
import { Lote } from "./Lote";
import { Pagamento } from "./Pagamento";

export type VendaStatus = "aberta" | "quitada" | "cancelada";

@Entity({ name: "vendas" })
@Index("idx_vendas_cliente", ["id_cliente"])
@Index("idx_vendas_lote", ["id_lote"])
export class Venda {
  @PrimaryGeneratedColumn({ name: "id_venda" })
  id_venda!: number;

  @Column({ type: "integer", name: "id_cliente" })
  id_cliente!: number;

  @ManyToOne(() => Cliente)
  cliente!: Cliente;

  @Column({ type: "integer", name: "id_lote", unique: true })
  id_lote!: number;

  @ManyToOne(() => Lote)
  lote!: Lote;

  @Column({ type: "date", name: "data_venda" })
  data_venda!: string;

  @Column({ type: "decimal", precision: 12, scale: 2, name: "valor_entrada", default: 0 })
  valor_entrada!: string;

  @Column({ type: "integer" })
  parcelas!: number;

  @Column({ type: "decimal", precision: 5, scale: 2, name: "porcentagem", default: 0 })
  porcentagem!: string;

  @Column({ type: "varchar", length: 20, default: "aberta" })
  status!: VendaStatus;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updated_at!: Date;

  @OneToMany(() => Pagamento, (pagamento: Pagamento) => pagamento.venda)
  pagamentos!: Pagamento[];
}
