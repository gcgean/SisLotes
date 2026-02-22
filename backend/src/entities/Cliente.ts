import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "clientes" })
export class Cliente {
  @PrimaryGeneratedColumn({ name: "id_cliente" })
  id_cliente!: number;

  @Column({ type: "char", length: 1 })
  tipo!: "f" | "j";

  @Index("idx_clientes_nome")
  @Column({ type: "varchar", length: 200 })
  nome!: string;

  @Column({ type: "varchar", length: 200, nullable: true })
  razao_social?: string | null;

  @Index("idx_clientes_cpf", { unique: true })
  @Column({ type: "varchar", length: 14, nullable: true })
  cpf?: string | null;

  @Index("idx_clientes_cnpj", { unique: true })
  @Column({ type: "varchar", length: 18, nullable: true })
  cnpj?: string | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  rg?: string | null;

  @Column({ type: "varchar", length: 30, nullable: true })
  estado_civil?: string | null;

  @Column({ type: "varchar", length: 200, nullable: true })
  conjuge?: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  profissao?: string | null;

  @Column({ type: "varchar", length: 300, nullable: true })
  endereco?: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  bairro?: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  cidade?: string | null;

  @Column({ type: "char", length: 2, nullable: true })
  estado?: string | null;

  @Column({ type: "varchar", length: 9, nullable: true })
  cep?: string | null;

  @Column({ type: "varchar", length: 200, nullable: true })
  complemento?: string | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  fone_res?: string | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  fone_com?: string | null;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updated_at!: Date;
}

