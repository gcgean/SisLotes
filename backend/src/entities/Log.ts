import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Usuario } from "./Usuario";
import { Cliente } from "./Cliente";
import { Lote } from "./Lote";

@Entity({ name: "logs" })
@Index("idx_logs_usuario", ["id_usuario"])
@Index("idx_logs_data", ["data_hora"])
export class Log {
  @PrimaryGeneratedColumn({ name: "id_log" })
  id_log!: number;

  @Column({ type: "integer", name: "id_usuario" })
  id_usuario!: number;

  @ManyToOne(() => Usuario, (usuario) => usuario.logs)
  usuario!: Usuario;

  @Column({ type: "integer", name: "id_cliente", nullable: true })
  id_cliente!: number | null;

  @ManyToOne(() => Cliente)
  cliente!: Cliente | null;

  @Column({ type: "integer", name: "id_lote", nullable: true })
  id_lote!: number | null;

  @ManyToOne(() => Lote)
  lote!: Lote | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  servico!: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  url!: string | null;

  @Column({ type: "text", nullable: true })
  log!: string | null;

  @Column({ type: "text", nullable: true })
  query!: string | null;

  @CreateDateColumn({ type: "timestamp", name: "data_hora" })
  data_hora!: Date;
}

