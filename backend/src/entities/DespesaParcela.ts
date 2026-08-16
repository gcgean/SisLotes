import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Despesa } from "./Despesa";

export type DespesaParcelaSituacao = "aberto" | "pago";

@Entity({ name: "despesa_parcelas" })
@Index("idx_despesa_parcelas_despesa", ["id_despesa"])
@Index("idx_despesa_parcelas_vencimento", ["vencimento"])
@Index("idx_despesa_parcelas_situacao", ["situacao"])
export class DespesaParcela {
  @PrimaryGeneratedColumn({ name: "id_despesa_parcela" })
  id_despesa_parcela!: number;

  @Column({ type: "integer", name: "id_empresa" })
  id_empresa!: number;

  @Column({ type: "integer", name: "id_despesa" })
  id_despesa!: number;

  @ManyToOne(() => Despesa, (despesa) => despesa.parcelas)
  @JoinColumn({ name: "id_despesa" })
  despesa!: Despesa;

  @Column({ type: "integer", name: "numero_parcela" })
  numero_parcela!: number;

  @Column({ type: "date" })
  vencimento!: string;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  valor!: string;

  @Column({ type: "varchar", length: 10, default: "aberto" })
  situacao!: DespesaParcelaSituacao;

  @Column({ type: "date", name: "pago_data", nullable: true })
  pago_data?: string | null;

  @Column({ type: "decimal", precision: 12, scale: 2, name: "valor_pago", nullable: true })
  valor_pago?: string | null;

  @Column({ type: "decimal", precision: 12, scale: 2, name: "multa_paga", default: 0 })
  multa_paga!: string;
  @Column({ type: "decimal", precision: 12, scale: 2, name: "juros_pagos", default: 0 })
  juros_pagos!: string;
  @Column({ type: "decimal", precision: 12, scale: 2, name: "desconto_obtido", default: 0 })
  desconto_obtido!: string;

  @Column({ type: "integer", name: "id_conta", nullable: true })
  id_conta?: number | null;

  @Column({ type: "integer", name: "id_usuario", nullable: true })
  id_usuario?: number | null;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updated_at!: Date;
}
