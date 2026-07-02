import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

export interface TelegramRecipient {
  nome: string;
  chat_id: string;
}

// Configuração única da plataforma (linha fixa id = 1) para notificações via Telegram.
@Entity({ name: "telegram_config" })
export class TelegramConfig {
  @PrimaryColumn({ type: "integer", default: 1 })
  id!: number;

  @Column({ type: "boolean", default: false })
  ativo!: boolean;

  @Column({ type: "text", name: "bot_token", nullable: true })
  bot_token!: string | null;

  // Notificar quando um novo lead (empresa) se cadastrar na plataforma
  @Column({ type: "boolean", name: "notificar_novo_lead", default: true })
  notificar_novo_lead!: boolean;

  // Lista de destinatários: [{ nome, chat_id }]
  @Column({ type: "jsonb", nullable: true })
  recipients!: TelegramRecipient[] | null;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updated_at!: Date;
}
