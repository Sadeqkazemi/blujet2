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
import { FlightCoupon } from './flight-coupon.entity';
import { User } from './user.entity';

@Index('dcs_passenger_operations_flightCouponId_key', ['flightCouponId'], {
  unique: true,
})
@Index('dcs_passenger_operations_boardingPassNo_key', ['boardingPassNo'], {
  unique: true,
})
@Entity('dcs_passenger_operations')
export class DcsPassengerOperation {
  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: 'dcs_passenger_operations_pkey',
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
    foreignKeyConstraintName: 'dcs_passenger_operations_flightCouponId_fkey',
  })
  flightCoupon!: FlightCoupon;

  @Column({ type: 'text' })
  boardingPassNo!: string;

  @Column({ type: 'text' })
  seatCode!: string;

  @Column({ type: 'text', nullable: true })
  gate!: string | null;

  @Column({ type: 'timestamp', precision: 3 })
  checkedInAt!: Date;

  @Column({ type: 'text' })
  checkedInById!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'checkedInById',
    foreignKeyConstraintName: 'dcs_passenger_operations_checkedInById_fkey',
  })
  checkedInBy!: User;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  boardedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  boardedById!: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'boardedById',
    foreignKeyConstraintName: 'dcs_passenger_operations_boardedById_fkey',
  })
  boardedBy!: User | null;

  @CreateDateColumn({ precision: 3, default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @UpdateDateColumn({ precision: 3, default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}
