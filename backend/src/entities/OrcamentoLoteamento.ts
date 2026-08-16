import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";

@Entity({ name: "orcamentos_loteamento" })
@Unique("uq_orcamento_lote_conta_mes", ["id_empresa", "id_loteamento", "id_conta_contabil", "mes"])
@Index("idx_orcamentos_empresa_mes", ["id_empresa", "mes"])
export class OrcamentoLoteamento {
  @PrimaryGeneratedColumn({ name: "id_orcamento" }) id_orcamento!: number;
  @Column({ type: "integer" }) id_empresa!: number;
  @Column({ type: "integer" }) id_loteamento!: number;
  @Column({ type: "integer" }) id_conta_contabil!: number;
  @Column({ type: "date" }) mes!: string;
  @Column({ type: "decimal", precision: 14, scale: 2 }) valor!: string;
  @Column({ type: "integer" }) id_usuario!: number;
  @CreateDateColumn({ type: "timestamp" }) created_at!: Date;
  @UpdateDateColumn({ type: "timestamp" }) updated_at!: Date;
}
