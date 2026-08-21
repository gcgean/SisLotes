import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

// Um registro por login bem-sucedido — usado pelo admin da plataforma para
// saber de onde e com qual dispositivo cada usuário está acessando.
@Entity({ name: "usuario_login_historico" })
@Index("idx_login_historico_data", ["data_hora"])
@Index("idx_login_historico_usuario", ["id_usuario"])
export class UsuarioLoginHistorico {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  id_usuario!: number;

  @Column()
  id_empresa!: number;

  @Column({ type: "varchar", length: 50, nullable: true })
  ip_address!: string | null;

  @Column({ type: "text", nullable: true })
  user_agent!: string | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  dispositivo!: string | null;

  @Column({ type: "varchar", length: 40, nullable: true })
  navegador!: string | null;

  @Column({ type: "varchar", length: 40, nullable: true })
  sistema_operacional!: string | null;

  @CreateDateColumn({ name: "data_hora" })
  data_hora!: Date;
}
