import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

// Registro de deduplicação: garante que cada empresa receba cada tipo de aviso
// (ex.: "trial_vencendo", "trial_expirado") apenas uma vez.
@Entity({ name: "telegram_notificacao" })
@Unique("uq_telegram_notificacao", ["id_empresa", "tipo"])
export class TelegramNotificacao {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "integer", name: "id_empresa" })
  id_empresa!: number;

  @Column({ type: "varchar", length: 40 })
  tipo!: string;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  created_at!: Date;
}
