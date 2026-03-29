import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "hub_billing_charges" })
@Index("idx_hub_charge_empresa", ["id_empresa"])
@Index("idx_hub_charge_charge_id", ["charge_id"])
export class HubBillingCharge {
  @PrimaryGeneratedColumn({ name: "id_hub_charge" })
  id_hub_charge!: number;

  @Column({ type: "integer", name: "id_empresa" })
  id_empresa!: number;

  @Column({ type: "varchar", length: 40, name: "origin_type" })
  origin_type!: "order" | "subscription";

  @Column({ type: "varchar", length: 100, name: "origin_id" })
  origin_id!: string;

  @Column({ type: "varchar", length: 100, name: "order_id", nullable: true })
  order_id!: string | null;

  @Column({ type: "varchar", length: 100, name: "subscription_id", nullable: true })
  subscription_id!: string | null;

  @Column({ type: "varchar", length: 120, name: "charge_id", nullable: true })
  charge_id!: string | null;

  @Column({ type: "varchar", length: 40, nullable: true })
  status!: string | null;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  amount!: string | null;

  @Column({ type: "jsonb", name: "payload", nullable: true })
  payload!: Record<string, unknown> | null;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updated_at!: Date;
}

