import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Loteamento } from "./Loteamento";

@Entity({ name: "lotes" })
@Index("idx_lotes_loteamento", ["id_loteamento"])
@Index("uq_lotes_loteamento_quadra_lote", ["id_loteamento", "quadra", "lote"], { unique: true })
export class Lote {
  @PrimaryGeneratedColumn({ name: "id_lote" })
  id_lote!: number;

  @Column({ type: "integer", name: "id_loteamento" })
  id_loteamento!: number;

  @ManyToOne(() => Loteamento, (loteamento) => loteamento.lotes)
  loteamento!: Loteamento;

  @Column({ type: "varchar", length: 20 })
  lote!: string;

  @Column({ type: "varchar", length: 20 })
  quadra!: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  area?: string | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  frente?: string | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  fundo?: string | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  esquerdo?: string | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  direito?: string | null;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  created_at!: Date;
}

