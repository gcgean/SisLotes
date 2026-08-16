import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "transferencias_contas" })
@Index("idx_transferencias_empresa_data", ["id_empresa", "data"])
export class TransferenciaConta {
  @PrimaryGeneratedColumn({ name: "id_transferencia" })
  id_transferencia!: number;

  @Column({ type: "integer", name: "id_empresa" })
  id_empresa!: number;

  @Column({ type: "integer", name: "id_conta_origem" })
  id_conta_origem!: number;

  @Column({ type: "integer", name: "id_conta_destino" })
  id_conta_destino!: number;

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
