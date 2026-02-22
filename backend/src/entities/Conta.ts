import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Pagamento } from "./Pagamento";

@Entity({ name: "contas" })
export class Conta {
  @PrimaryGeneratedColumn({ name: "id_conta" })
  id_conta!: number;

  @Column({ type: "varchar", length: 100 })
  apelido!: string;

  @Column({ type: "varchar", length: 200 })
  titular!: string;

  @Column({ type: "varchar", length: 20 })
  agencia!: string;

  @Column({ type: "varchar", length: 20 })
  conta!: string;

  @Column({ type: "varchar", length: 30, nullable: true })
  convenio?: string | null;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  created_at!: Date;

  @OneToMany(() => Pagamento, (pagamento: Pagamento) => pagamento.conta)
  pagamentos!: Pagamento[];
}
