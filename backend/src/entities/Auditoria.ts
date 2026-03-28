import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Usuario } from "./Usuario";

@Entity("auditoria")
export class Auditoria {
  @PrimaryGeneratedColumn()
  id_auditoria!: number;

  @Column()
  id_usuario!: number;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: "id_usuario" })
  usuario!: Usuario;

  @Column()
  tabela!: string;

  @Column({ nullable: true })
  id_registro?: number;

  @Column()
  acao!: "CREATE" | "UPDATE" | "DELETE";

  @Column({ type: "jsonb", nullable: true })
  valores_antigos?: Record<string, any>;

  @Column({ type: "jsonb", nullable: true })
  valores_novos?: Record<string, any>;

  @Column({ nullable: true })
  descricao?: string;

  @Column({ nullable: true })
  ip_address?: string;

  @CreateDateColumn()
  data_hora!: Date;

  @Column({ nullable: true })
  id_empresa?: number;
}
