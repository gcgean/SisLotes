import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "venda_acordos" })
@Index("idx_venda_acordos_venda", ["id_venda"])
export class VendaAcordo {
  @PrimaryGeneratedColumn({ name: "id_acordo" }) id_acordo!: number;
  @Column({ type: "integer", name: "id_empresa" }) id_empresa!: number;
  @Column({ type: "integer", name: "id_venda" }) id_venda!: number;
  @Column({ type: "varchar", length: 20 }) tipo!: "distrato" | "renegociacao";
  @Column({ type: "text" }) motivo!: string;
  @Column({ type: "jsonb", name: "snapshot_antes" }) snapshot_antes!: Record<string, unknown>;
  @Column({ type: "jsonb", name: "snapshot_depois" }) snapshot_depois!: Record<string, unknown>;
  @Column({ type: "integer", name: "id_usuario" }) id_usuario!: number;
  @CreateDateColumn({ type: "timestamp", name: "created_at" }) created_at!: Date;
}
