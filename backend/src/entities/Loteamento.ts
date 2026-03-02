import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Lote } from "./Lote";

@Entity({ name: "loteamentos" })
export class Loteamento {
  @PrimaryGeneratedColumn({ name: "id_loteamento" })
  id_loteamento!: number;

  @Column({ type: "integer", name: "id_empresa" })
  id_empresa!: number;

  @Column({ type: "varchar", length: 200 })
  nome!: string;

  @Column({ type: "varchar", length: 300, nullable: true })
  endereco?: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  cidade?: string | null;

  @Column({ type: "char", length: 2, nullable: true })
  estado?: string | null;

  @Column({ type: "char", length: 1, nullable: true })
  tipo_pessoa?: "f" | "j" | null;

  @Column({ type: "varchar", length: 200, nullable: true, name: "prop_nome" })
  prop_nome?: string | null;

  @Column({ type: "varchar", length: 18, nullable: true })
  cnpj?: string | null;

  @Column({ type: "varchar", length: 300, nullable: true, name: "prop_endereco" })
  prop_endereco?: string | null;

  @Column({ type: "varchar", length: 100, nullable: true, name: "prop_bairro" })
  prop_bairro?: string | null;

  @Column({ type: "varchar", length: 100, nullable: true, name: "prop_cidade" })
  prop_cidade?: string | null;

  @Column({ type: "char", length: 2, nullable: true, name: "prop_estado" })
  prop_estado?: string | null;

  @Column({ type: "varchar", length: 9, nullable: true, name: "prop_cep" })
  prop_cep?: string | null;

  @Column({ type: "varchar", length: 20, nullable: true, name: "prop_fone" })
  prop_fone?: string | null;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updated_at!: Date;

  @OneToMany(() => Lote, (lote: Lote) => lote.loteamento)
  lotes!: Lote[];
}
