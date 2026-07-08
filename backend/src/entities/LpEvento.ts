import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

// Evento de rastreamento da landing page de vendas (/lp).
// tipo: 'pageview' | 'section' | 'cta' | 'exit'
@Entity({ name: "lp_evento" })
@Index("idx_lp_evento_created", ["created_at"])
@Index("idx_lp_evento_tipo", ["tipo"])
@Index("idx_lp_evento_session", ["session_id"])
export class LpEvento {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 40, name: "visitor_id", nullable: true })
  visitor_id!: string | null;

  @Column({ type: "varchar", length: 40, name: "session_id", nullable: true })
  session_id!: string | null;

  @Column({ type: "varchar", length: 20 })
  tipo!: string;

  @Column({ type: "varchar", length: 40, nullable: true })
  secao!: string | null;

  @Column({ type: "varchar", length: 40, nullable: true })
  cta!: string | null;

  @Column({ type: "text", nullable: true })
  referrer!: string | null;

  @Column({ type: "varchar", length: 80, name: "utm_source", nullable: true })
  utm_source!: string | null;

  @Column({ type: "varchar", length: 80, name: "utm_medium", nullable: true })
  utm_medium!: string | null;

  @Column({ type: "varchar", length: 80, name: "utm_campaign", nullable: true })
  utm_campaign!: string | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  device!: string | null;

  @Column({ type: "text", name: "user_agent", nullable: true })
  user_agent!: string | null;

  @Column({ type: "varchar", length: 50, nullable: true })
  ip!: string | null;

  // Segundos na página (para eventos 'exit')
  @Column({ type: "integer", nullable: true })
  duracao!: number | null;

  // Percentual máximo de rolagem (0-100) para eventos 'exit'
  @Column({ type: "integer", name: "scroll_pct", nullable: true })
  scroll_pct!: number | null;

  @Column({ type: "timestamp", name: "created_at", default: () => "NOW()" })
  created_at!: Date;
}
