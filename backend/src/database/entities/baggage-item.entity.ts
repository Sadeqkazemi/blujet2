import { randomUUID } from 'node:crypto';
import {
  BeforeInsert,
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BaggageStatus } from '../enums';
import { FlightCoupon } from './flight-coupon.entity';
import { User } from './user.entity';

@Index('baggage_items_tagNo_key', ['tagNo'], { unique: true })
@Index('baggage_items_flightCouponId_status_idx', ['flightCouponId', 'status'])
@Check(
  'baggage_items_weightGrams_check',
  '"weightGrams" > 0 AND "weightGrams" <= 100000',
)
@Entity('baggage_items')
export class BaggageItem {
  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: 'baggage_items_pkey',
  })
  id!: string;

  @BeforeInsert()
  generateId() {
    this.id ??= randomUUID();
  }

  @Column({ type: 'text' })
  flightCouponId!: string;

  @ManyToOne(() => FlightCoupon, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'flightCouponId',
    foreignKeyConstraintName: 'baggage_items_flightCouponId_fkey',
  })
  flightCoupon!: FlightCoupon;

  @Column({ type: 'text' })
  tagNo!: string;

  @Column({ type: 'int' })
  weightGrams!: number;

  @Column({
    type: 'enum',
    enum: BaggageStatus,
    enumName: 'BaggageStatus',
    default: BaggageStatus.ACCEPTED,
  })
  status: BaggageStatus = BaggageStatus.ACCEPTED;

  @Column({ type: 'timestamp', precision: 3 })
  acceptedAt!: Date;

  @Column({ type: 'text' })
  acceptedById!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'acceptedById',
    foreignKeyConstraintName: 'baggage_items_acceptedById_fkey',
  })
  acceptedBy!: User;

  @CreateDateColumn({ precision: 3, default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @UpdateDateColumn({ precision: 3, default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}
