import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { BookingChannel, BookingStatus, CabinClass } from '../enums';
import { bigintTransformer } from '../transformers/bigint.transformer';
import { AgencyProfile } from './agency-profile.entity';
import { FlightInstance } from './flight-instance.entity';
import { User } from './user.entity';

@Index('bookings_agencyId_idx', ['agencyId'])
@Index('bookings_channel_idx', ['channel'])
@Index('bookings_flightInstanceId_status_idx', ['flightInstanceId', 'status'])
@Index('bookings_idempotencyKey_key', ['idempotencyKey'], { unique: true })
@Index('bookings_pnr_key', ['pnr'], { unique: true })
@Index('bookings_userId_idx', ['userId'])
@Entity('bookings')
export class Booking {
  @PrimaryColumn({ type: 'text', primaryKeyConstraintName: 'bookings_pkey' })
  id!: string;

  @Column({ type: 'text' })
  pnr!: string;

  @Column({ type: 'text' })
  flightInstanceId!: string;

  @ManyToOne(() => FlightInstance, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'flightInstanceId',
    foreignKeyConstraintName: 'bookings_flightInstanceId_fkey',
  })
  flightInstance!: FlightInstance;

  @Column({ type: 'enum', enum: BookingChannel, enumName: 'BookingChannel' })
  channel!: BookingChannel;

  @Column({ type: 'text', nullable: true })
  agencyId!: string | null;

  @ManyToOne(() => AgencyProfile, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'agencyId',
    foreignKeyConstraintName: 'bookings_agencyId_fkey',
  })
  agency!: AgencyProfile | null;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    enumName: 'BookingStatus',
    default: BookingStatus.DRAFT,
  })
  status!: BookingStatus;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  priceIrr!: bigint;

  @CreateDateColumn({ precision: 3, default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @Column({
    type: 'enum',
    enum: CabinClass,
    enumName: 'CabinClass',
    default: CabinClass.ECONOMY,
  })
  cabin!: CabinClass;

  @Column({ type: 'text', nullable: true })
  contactPhone!: string | null;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  holdExpiresAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  idempotencyKey!: string | null;

  @Column({ type: 'text', nullable: true })
  userId!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'bookings_userId_fkey',
  })
  user!: User | null;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  deletedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  fareClassCode!: string | null;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  taxIrr!: bigint;
}
