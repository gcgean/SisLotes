import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "cobranca_comunicacoes" })
@Index("idx_cobranca_comunicacoes_empresa_status", ["id_empresa", "status"])
export class CobrancaComunicacao {
  @PrimaryGeneratedColumn({ name: "id_comunicacao" }) id_comunicacao!: number;
  @Column({ type: "integer" }) id_empresa!: number;
  @Column({ type: "integer" }) id_regra!: number;
  @Column({ type: "integer" }) id_pagamento!: number;
  @Column({ type: "varchar", length: 10 }) canal!: "email" | "whatsapp";
  @Column({ type: "varchar", length: 200, nullable: true }) destinatario!: string | null;
  @Column({ type: "text" }) mensagem!: string;
  @Column({ type: "varchar", length: 20, default: "rascunho" }) status!: "rascunho" | "enviada" | "erro" | "cancelada";
  @Column({ type: "varchar", length: 100, nullable: true }) provedor!: string | null;
  @Column({ type: "varchar", length: 150, nullable: true }) id_externo!: string | null;
  @Column({ type: "text", nullable: true }) erro!: string | null;
  @CreateDateColumn({ type: "timestamp" }) created_at!: Date;
}
