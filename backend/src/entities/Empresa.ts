import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "empresas" })
export class Empresa {
  @PrimaryGeneratedColumn({ name: "id_empresa" })
  id_empresa!: number;

  @Column({ type: "varchar", length: 200 })
  nome_fantasia!: string;

  @Column({ type: "varchar", length: 200, nullable: true })
  razao_social?: string | null;

  @Column({ type: "varchar", length: 18, nullable: true })
  cnpj?: string | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  ie?: string | null;

  @Column({ type: "varchar", length: 300, nullable: true })
  endereco?: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  cidade?: string | null;

  @Column({ type: "char", length: 2, nullable: true })
  estado?: string | null;

  @Column({ type: "varchar", length: 9, nullable: true })
  cep?: string | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  telefone?: string | null;

  @Column({ type: "boolean", default: true })
  ativo!: boolean;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updated_at!: Date;
}
