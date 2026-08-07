import { randomUUID } from 'node:crypto';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { bigintTransformer } from '../transformers/bigint.transformer';
import { User } from './user.entity';

export const TRAVEL_EXTRA_CODES = [
  'EXTRA_BAGGAGE',
  'SEAT_SELECTION',
  'TRAVEL_INSURANCE',
  'SPECIAL_MEAL',
  'DATE_CHANGE',
  'REFUND_FEE',
  'CIP',
] as const;

export type TravelExtraCode = (typeof TRAVEL_EXTRA_CODES)[number];

export const TRAVEL_EXTRA_BILLING_UNITS = [
  'PER_BOOKING',
  'PER_PASSENGER',
  'PER_KG',
] as const;

export type TravelExtraBillingUnit =
  (typeof TRAVEL_EXTRA_BILLING_UNITS)[number];

@Index('travel_extra_settings_code_key', ['code'], { unique: true })
@Index('travel_extra_settings_active_sortOrder_idx', ['active', 'sortOrder'])
@Entity('travel_extra_settings')
export class TravelExtraSetting {
  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: 'travel_extra_settings_pkey',
  })
  id!: string;

  @BeforeInsert()
  generateId() {
    this.id ??= randomUUID();
  }

  @Column({ type: 'text' })
  code!: TravelExtraCode;

  @Column({ type: 'text' })
  titleFa!: string;

  @Column({ type: 'text', nullable: true })
  titleEn!: string | null;

  @Column({ type: 'text', nullable: true })
  titleAr!: string | null;

  @Column({ type: 'text', nullable: true })
  descriptionFa!: string | null;

  @Column({ type: 'text' })
  billingUnit!: TravelExtraBillingUnit;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  priceIrr!: bigint;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ type: 'boolean', default: true })
  purchaseEnabled!: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ type: 'text', nullable: true })
  updatedById!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'updatedById',
    foreignKeyConstraintName: 'travel_extra_settings_updatedById_fkey',
  })
  updatedBy!: User | null;

  @CreateDateColumn({ precision: 3, default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @UpdateDateColumn({ precision: 3 })
  updatedAt!: Date;
}
