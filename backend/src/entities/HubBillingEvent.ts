import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "hub_billing_events" })
@Index("idx_hub_event_empresa", ["id_empresa"])
@Index("idx_hub_event_charge_id", ["charge_id"])
export class HubBillingEvent {
  @PrimaryGeneratedColumn({ name: "id_hub_event" })
  id_hub_event!: number;

  @Column({ type: "integer", name: "id_empresa" })
  id_empresa!: number;

  @Column({ type: "varchar", length: 80, name: "event_type" })
  event_type!: string;

  @Column({ type: "varchar", length: 30, name: "event_source" })
  event_source!: "webhook" | "sync" | "system";

  @Column({ type: "varchar", length: 120, name: "charge_id", nullable: true })
  charge_id!: string | null;

  @Column({ type: "varchar", length: 120, name: "order_id", nullable: true })
  order_id!: string | null;

  @Column({ type: "varchar", length: 120, name: "subscription_id", nullable: true })
  subscription_id!: string | null;

  @Column({ type: "varchar", length: 40, nullable: true })
  status!: string | null;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  amount!: string | null;

  @Column({ type: "jsonb", nullable: true })
  payload!: Record<string, unknown> | null;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  created_at!: Date;
}

