import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

// Rateio de um lançamento manual entre múltiplos loteamentos. Quando existem
// linhas aqui, o campo lancamento.id_loteamento fica nulo.
@Entity({ name: "lancamento_rateio" })
@Index("idx_lancamento_rateio_lancamento", ["id_lancamento"])
export class LancamentoRateio {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "integer", name: "id_empresa" })
  id_empresa!: number;

  @Column({ type: "integer", name: "id_lancamento" })
  id_lancamento!: number;

  @Column({ type: "integer", name: "id_loteamento" })
  id_loteamento!: number;

  @Column({ type: "decimal", precision: 5, scale: 2 })
  percentual!: string;
}
