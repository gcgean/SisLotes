import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

// Rateio de uma conta a pagar entre múltiplos loteamentos (ex: energia que
// atende mais de um empreendimento). Quando existem linhas aqui para uma
// despesa, o campo despesa.id_loteamento fica nulo (a despesa é "rateada").
@Entity({ name: "despesa_rateio" })
@Index("idx_despesa_rateio_despesa", ["id_despesa"])
export class DespesaRateio {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "integer", name: "id_empresa" })
  id_empresa!: number;

  @Column({ type: "integer", name: "id_despesa" })
  id_despesa!: number;

  @Column({ type: "integer", name: "id_loteamento" })
  id_loteamento!: number;

  @Column({ type: "decimal", precision: 5, scale: 2 })
  percentual!: string;
}
