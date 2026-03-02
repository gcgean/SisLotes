import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Pagamento } from "./Pagamento";
import { Log } from "./Log";

@Entity({ name: "usuarios" })
export class Usuario {
  @PrimaryGeneratedColumn({ name: "id_usuario" })
  id_usuario!: number;

  @Column({ type: "integer", name: "id_empresa" })
  id_empresa!: number;

  @Column({ type: "varchar", length: 50, unique: true })
  login!: string;

  @Column({ type: "varchar", length: 255 })
  senha!: string;

  @Column({ type: "boolean", default: false })
  user_master!: boolean;

  @Column({ type: "boolean", default: false })
  clientes_cadastrar!: boolean;

  @Column({ type: "boolean", default: false })
  clientes_alterar!: boolean;

  @Column({ type: "boolean", default: false })
  clientes_excluir!: boolean;

  @Column({ type: "boolean", default: false })
  loteamentos_cadastrar!: boolean;

  @Column({ type: "boolean", default: false })
  loteamentos_alterar!: boolean;

  @Column({ type: "boolean", default: false })
  loteamentos_excluir!: boolean;

  @Column({ type: "boolean", default: false })
  vendas_cadastrar!: boolean;

  @Column({ type: "boolean", default: false })
  vendas_alterar!: boolean;

  @Column({ type: "boolean", default: false })
  vendas_excluir!: boolean;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updated_at!: Date;

  @OneToMany(() => Pagamento, (pagamento: Pagamento) => pagamento.usuario)
  pagamentos!: Pagamento[];

  @OneToMany(() => Log, (log: Log) => log.usuario)
  logs!: Log[];
}
