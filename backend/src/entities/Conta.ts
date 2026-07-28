import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Pagamento } from "./Pagamento";

export type ContaTipo = "banco" | "caixa";

@Entity({ name: "contas" })
export class Conta {
  @PrimaryGeneratedColumn({ name: "id_conta" })
  id_conta!: number;

  @Column({ type: "integer", name: "id_empresa" })
  id_empresa!: number;

  @Column({ type: "varchar", length: 100 })
  apelido!: string;

  @Column({ type: "varchar", length: 200, nullable: true })
  titular?: string | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  agencia?: string | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  conta?: string | null;

  @Column({ type: "varchar", length: 30, nullable: true })
  convenio?: string | null;

  /** "banco" (padrão) ou "caixa" — Caixa Geral/Tesouraria não tem dados bancários */
  @Column({ type: "varchar", length: 10, default: "banco" })
  tipo!: ContaTipo;

  @Column({ type: "decimal", precision: 12, scale: 2, name: "saldo_inicial", default: 0 })
  saldo_inicial!: string;

  /** Data a partir da qual o saldo_inicial passa a valer (movimentos anteriores não entram no saldo) */
  @Column({ type: "date", name: "data_saldo_inicial", nullable: true })
  data_saldo_inicial?: string | null;

  @Column({ type: "boolean", default: true })
  ativo!: boolean;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  created_at!: Date;

  @OneToMany(() => Pagamento, (pagamento: Pagamento) => pagamento.conta)
  pagamentos!: Pagamento[];
}
