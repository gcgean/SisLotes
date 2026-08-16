import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "cobranca_regras" })
@Index("idx_cobranca_regras_empresa_ativo", ["id_empresa", "ativo"])
export class CobrancaRegra {
  @PrimaryGeneratedColumn({ name: "id_regra" }) id_regra!: number;
  @Column({ type: "integer" }) id_empresa!: number;
  @Column({ type: "varchar", length: 100 }) nome!: string;
  @Column({ type: "integer" }) dias_relativos!: number;
  @Column({ type: "varchar", length: 10 }) canal!: "email" | "whatsapp";
  @Column({ type: "varchar", length: 150, nullable: true }) assunto!: string | null;
  @Column({ type: "text" }) mensagem!: string;
  @Column({ type: "boolean", default: false }) ativo!: boolean;
  @Column({ type: "integer" }) id_usuario!: number;
  @CreateDateColumn({ type: "timestamp" }) created_at!: Date;
  @UpdateDateColumn({ type: "timestamp" }) updated_at!: Date;
}
