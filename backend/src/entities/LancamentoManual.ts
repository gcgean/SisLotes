import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type LancamentoTipo = "receita" | "despesa";

@Entity({ name: "lancamentos_manuais" })
@Index("idx_lancamentos_conta", ["id_conta"])
@Index("idx_lancamentos_data", ["data"])
@Index("idx_lancamentos_tipo", ["tipo"])
export class LancamentoManual {
  @PrimaryGeneratedColumn({ name: "id_lancamento" })
  id_lancamento!: number;

  @Column({ type: "integer", name: "id_empresa" })
  id_empresa!: number;

  @Column({ type: "integer", name: "id_conta" })
  id_conta!: number;

  @Column({ type: "integer", name: "id_loteamento", nullable: true })
  id_loteamento?: number | null;

  @Column({ type: "varchar", length: 10 })
  tipo!: LancamentoTipo;

  @Column({ type: "varchar", length: 100, nullable: true })
  categoria?: string | null;

  @Column({ type: "varchar", length: 300 })
  descricao!: string;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  valor!: string;

  @Column({ type: "date" })
  data!: string;

  @Column({ type: "integer", name: "id_usuario" })
  id_usuario!: number;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updated_at!: Date;
}
