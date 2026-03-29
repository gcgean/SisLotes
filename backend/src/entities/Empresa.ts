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
  bairro?: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  cidade?: string | null;

  @Column({ type: "char", length: 2, nullable: true })
  estado?: string | null;

  @Column({ type: "varchar", length: 9, nullable: true })
  cep?: string | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  telefone?: string | null;

  @Column({ type: "varchar", length: 200, nullable: true })
  email?: string | null;

  @Column({ type: "varchar", length: 200, nullable: true })
  site?: string | null;

  @Column({ type: "decimal", precision: 10, scale: 2, name: "salario_minimo", nullable: true, default: 0 })
  salario_minimo?: string | null;

  /** Logo em base64 (data URL: "data:image/png;base64,...") */
  @Column({ type: "text", nullable: true })
  logo?: string | null;

  @Column({ type: "boolean", default: true })
  ativo!: boolean;

  /** Plano contratado (ex: "básico", "profissional", "enterprise") */
  @Column({ type: "varchar", length: 50, nullable: true })
  plano?: string | null;

  /** Data de vencimento da licença */
  @Column({ type: "date", name: "data_vencimento", nullable: true })
  data_vencimento?: string | null;

  /** Último acesso (atualizado no login de qualquer usuário da empresa) */
  @Column({ type: "timestamp", name: "ultimo_acesso", nullable: true })
  ultimo_acesso?: Date | null;

  /** Observações internas da plataforma */
  @Column({ type: "text", nullable: true })
  observacoes?: string | null;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updated_at!: Date;
}
