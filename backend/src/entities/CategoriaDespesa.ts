import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "categorias_despesa" })
export class CategoriaDespesa {
  @PrimaryGeneratedColumn({ name: "id_categoria" })
  id_categoria!: number;

  @Column({ type: "integer", name: "id_empresa" })
  id_empresa!: number;

  @Column({ type: "varchar", length: 100 })
  nome!: string;

  /** Agrupamento livre para exibição/relatórios: Infraestrutura, Técnico, Legal, Operacional, Comercial... */
  @Column({ type: "varchar", length: 50, nullable: true })
  grupo?: string | null;

  @Column({ type: "boolean", default: true })
  ativo!: boolean;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  created_at!: Date;
}
