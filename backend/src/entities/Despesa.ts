import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { DespesaParcela } from "./DespesaParcela";

@Entity({ name: "despesas" })
export class Despesa {
  @PrimaryGeneratedColumn({ name: "id_despesa" })
  id_despesa!: number;

  @Column({ type: "integer", name: "id_empresa" })
  id_empresa!: number;

  /** Nulo = despesa administrativa da empresa (não amarrada a um empreendimento) */
  @Column({ type: "integer", name: "id_loteamento", nullable: true })
  id_loteamento?: number | null;

  @Column({ type: "integer", name: "id_categoria" })
  id_categoria!: number;

  @Column({ type: "integer", name: "id_fornecedor", nullable: true })
  id_fornecedor?: number | null;

  @Column({ type: "integer", name: "id_venda_origem", nullable: true })
  id_venda_origem?: number | null;

  @Column({ type: "varchar", length: 300 })
  descricao!: string;

  @Column({ type: "decimal", precision: 12, scale: 2, name: "valor_total" })
  valor_total!: string;

  @Column({ type: "integer", name: "numero_parcelas", default: 1 })
  numero_parcelas!: number;

  /** Conta recorrente: gera automaticamente uma nova parcela todo mês */
  @Column({ type: "boolean", default: false })
  recorrente!: boolean;

  /** Controla se a geração automática mensal está ativa (permite pausar sem perder o histórico) */
  @Column({ type: "boolean", name: "recorrencia_ativa", default: true })
  recorrencia_ativa!: boolean;

  /** Número da nota fiscal / documento fiscal */
  @Column({ type: "varchar", length: 60, nullable: true })
  documento?: string | null;

  @Column({ type: "varchar", length: 200, name: "anexo_nome", nullable: true })
  anexo_nome?: string | null;

  /** Comprovante/NF em base64 (data URL), mesmo padrão do logo da empresa */
  @Column({ type: "text", name: "anexo_base64", nullable: true })
  anexo_base64?: string | null;

  @Column({ type: "text", nullable: true })
  observacoes?: string | null;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updated_at!: Date;

  @OneToMany(() => DespesaParcela, (parcela) => parcela.despesa)
  parcelas!: DespesaParcela[];
}
