import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Sugestao } from "./Sugestao";
import { Usuario } from "./Usuario";

// Thread de chat (várias mensagens, ida e volta) entre o usuário que abriu a
// sugestão e o gestor da plataforma — substitui o antigo campo único
// "resposta_admin" por uma conversa de verdade.
@Entity({ name: "sugestao_mensagens" })
@Index("idx_sugestao_mensagens_sugestao", ["id_sugestao"])
export class SugestaoMensagem {
  @PrimaryGeneratedColumn({ name: "id_mensagem" })
  id_mensagem!: number;

  @Column({ type: "integer", name: "id_sugestao" })
  id_sugestao!: number;

  @ManyToOne(() => Sugestao)
  @JoinColumn({ name: "id_sugestao" })
  sugestao!: Sugestao;

  @Column({ type: "integer", name: "id_usuario" })
  id_usuario!: number;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: "id_usuario" })
  usuario!: Usuario;

  /** true = mensagem do gestor da plataforma (gcgean); false = mensagem do usuário/empresa */
  @Column({ type: "boolean", name: "autor_admin", default: false })
  autor_admin!: boolean;

  @Column({ type: "text", nullable: true })
  mensagem!: string | null;

  @Column({ type: "varchar", length: 200, name: "anexo_nome", nullable: true })
  anexo_nome!: string | null;

  @Column({ type: "text", name: "anexo_base64", nullable: true })
  anexo_base64!: string | null;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  created_at!: Date;
}
