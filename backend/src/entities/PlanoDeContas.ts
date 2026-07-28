import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

export type PlanoDeContasTipo = "receita" | "despesa";

@Entity({ name: "plano_de_contas" })
export class PlanoDeContas {
  @PrimaryGeneratedColumn({ name: "id_conta_contabil" })
  id_conta_contabil!: number;

  @Column({ type: "integer", name: "id_empresa" })
  id_empresa!: number;

  /** Nulo = nó raiz (grupo). A hierarquia é resolvida por query, não por relation. */
  @Column({ type: "integer", name: "id_pai", nullable: true })
  id_pai?: number | null;

  @Column({ type: "varchar", length: 10 })
  tipo!: PlanoDeContasTipo;

  /** Código gerado automaticamente pela posição na árvore: "1", "1.1", "1.1.3"... */
  @Column({ type: "varchar", length: 20 })
  codigo!: string;

  @Column({ type: "varchar", length: 150 })
  nome!: string;

  @Column({ type: "boolean", default: true })
  ativo!: boolean;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updated_at!: Date;
}
