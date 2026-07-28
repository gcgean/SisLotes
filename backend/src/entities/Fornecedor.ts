import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "fornecedores" })
export class Fornecedor {
  @PrimaryGeneratedColumn({ name: "id_fornecedor" })
  id_fornecedor!: number;

  @Column({ type: "integer", name: "id_empresa" })
  id_empresa!: number;

  @Column({ type: "varchar", length: 200 })
  nome!: string;

  @Column({ type: "varchar", length: 18, nullable: true })
  documento?: string | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  telefone?: string | null;

  @Column({ type: "varchar", length: 200, nullable: true })
  email?: string | null;

  /** Nome da pessoa de contato no fornecedor */
  @Column({ type: "varchar", length: 200, nullable: true })
  contato?: string | null;

  @Column({ type: "text", nullable: true })
  observacoes?: string | null;

  @Column({ type: "boolean", default: true })
  ativo!: boolean;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updated_at!: Date;
}
