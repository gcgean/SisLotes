import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

export type CobrancaBancariaTipo = "boleto" | "pix";
export type CobrancaBancariaStatus = "rascunho" | "aguardando_integracao" | "emitida" | "paga" | "cancelada" | "erro";

@Entity({ name: "cobrancas_bancarias" })
@Index("idx_cobrancas_empresa_status_vencimento", ["id_empresa", "status", "vencimento"])
export class CobrancaBancaria {
  @PrimaryGeneratedColumn({ name: "id_cobranca" }) id_cobranca!: number;
  @Column({ type: "integer" }) id_empresa!: number;
  @Column({ type: "integer", nullable: true }) id_pagamento!: number | null;
  @Column({ type: "integer", nullable: true }) id_conta!: number | null;
  @Column({ type: "varchar", length: 10 }) tipo!: CobrancaBancariaTipo;
  @Column({ type: "varchar", length: 24, default: "rascunho" }) status!: CobrancaBancariaStatus;
  @Column({ type: "varchar", length: 300 }) descricao!: string;
  @Column({ type: "decimal", precision: 12, scale: 2 }) valor!: string;
  @Column({ type: "date" }) vencimento!: string;
  @Column({ type: "varchar", length: 80, nullable: true }) provedor!: string | null;
  @Column({ type: "varchar", length: 150, nullable: true }) id_externo!: string | null;
  @Column({ type: "varchar", length: 80, nullable: true }) nosso_numero!: string | null;
  @Column({ type: "varchar", length: 200, nullable: true }) linha_digitavel!: string | null;
  @Column({ type: "text", nullable: true }) pix_copia_cola!: string | null;
  @Column({ type: "jsonb", nullable: true }) payload_provedor!: Record<string, unknown> | null;
  @Column({ type: "text", nullable: true }) erro_integracao!: string | null;
  @Column({ type: "integer" }) id_usuario!: number;
  @CreateDateColumn({ type: "timestamp" }) created_at!: Date;
  @UpdateDateColumn({ type: "timestamp" }) updated_at!: Date;
}
