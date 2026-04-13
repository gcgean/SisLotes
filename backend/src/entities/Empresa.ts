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

  /** Quando true, a empresa não participa do controle de planos/licença do Hub Billing */
  @Column({ type: "boolean", name: "ignorar_controle_planos", default: false })
  ignorar_controle_planos!: boolean;

  /** Plano contratado (ex: "básico", "profissional", "enterprise") */
  @Column({ type: "varchar", length: 50, nullable: true })
  plano?: string | null;

  /** Data de vencimento da licença */
  @Column({ type: "date", name: "data_vencimento", nullable: true })
  data_vencimento?: string | null;

  @Column({ type: "varchar", length: 80, name: "hub_customer_id", nullable: true })
  hub_customer_id?: string | null;

  @Column({ type: "varchar", length: 80, name: "hub_product_code", nullable: true })
  hub_product_code?: string | null;

  @Column({ type: "varchar", length: 40, name: "hub_license_status", nullable: true })
  hub_license_status?: string | null;

  @Column({ type: "varchar", length: 80, name: "hub_license_reason", nullable: true })
  hub_license_reason?: string | null;

  @Column({ type: "timestamp", name: "hub_expires_at", nullable: true })
  hub_expires_at?: Date | null;

  @Column({ type: "jsonb", name: "hub_features", nullable: true })
  hub_features?: Record<string, unknown> | null;

  @Column({ type: "timestamp", name: "hub_last_sync", nullable: true })
  hub_last_sync?: Date | null;

  @Column({ type: "timestamp", name: "hub_cache_until", nullable: true })
  hub_cache_until?: Date | null;

  /** Último acesso (atualizado no login de qualquer usuário da empresa) */
  @Column({ type: "timestamp", name: "ultimo_acesso", nullable: true })
  ultimo_acesso?: Date | null;

  /** Modelo personalizado do contrato (HTML com placeholders {{variavel}}) */
  @Column({ type: "text", name: "modelo_contrato", nullable: true })
  modelo_contrato?: string | null;

  /** Observações internas da plataforma */
  @Column({ type: "text", nullable: true })
  observacoes?: string | null;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updated_at!: Date;
}
