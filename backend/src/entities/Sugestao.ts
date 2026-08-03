import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Usuario } from "./Usuario";

export type SugestaoStatus = "aberta" | "em_analise" | "concluida";

@Entity({ name: "sugestoes" })
export class Sugestao {
  @PrimaryGeneratedColumn({ name: "id_sugestao" })
  id_sugestao!: number;

  @Column({ type: "integer", name: "id_empresa" })
  id_empresa!: number;

  @Column({ type: "integer", name: "id_usuario" })
  id_usuario!: number;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: "id_usuario" })
  usuario!: Usuario;

  @Column({ type: "varchar", length: 200 })
  titulo!: string;

  @Column({ type: "text" })
  descricao!: string;

  @Column({ type: "varchar", length: 20, default: "aberta" })
  status!: SugestaoStatus;

  @Column({ type: "text", name: "resposta_admin", nullable: true })
  resposta_admin!: string | null;

  /** Anexo opcional enviado junto com a sugestão original (mesmo padrão de despesas/logo: base64 inline) */
  @Column({ type: "varchar", length: 200, name: "anexo_nome", nullable: true })
  anexo_nome!: string | null;

  @Column({ type: "text", name: "anexo_base64", nullable: true })
  anexo_base64!: string | null;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updated_at!: Date;
}
