import { randomUUID } from 'node:crypto';
import {
  BeforeInsert,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { BookingChannel, CabinClass } from '../enums';
import { bigintTransformer } from '../transformers/bigint.transformer';
import { FlightInstance } from './flight-instance.entity';

@Index(
  'fare_rules_flightInstanceId_cabin_classCode_key',
  ['flightInstanceId', 'cabin', 'classCode'],
  { unique: true },
)
@Entity('fare_rules')
export class FareRule {
  @PrimaryColumn({ type: 'text', primaryKeyConstraintName: 'fare_rules_pkey' })
  id!: string;

  @BeforeInsert()
  generateId() {
    this.id ??= randomUUID();
  }

  @Column({ type: 'text' })
  flightInstanceId!: string;

  @ManyToOne(() => FlightInstance, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'flightInstanceId',
    foreignKeyConstraintName: 'fare_rules_flightInstanceId_fkey',
  })
  flightInstance!: FlightInstance;

  @Column({ type: 'enum', enum: CabinClass, enumName: 'CabinClass' })
  cabin!: CabinClass;

  @Column({ type: 'text' })
  classCode!: string;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  priceIrr!: bigint;

  @Column({ type: 'int' })
  seatsAllocated!: number;

  @Column({ type: 'boolean', default: true })
  refundable!: boolean;

  @Column({
    type: 'enum',
    enum: BookingChannel,
    enumName: 'BookingChannel',
    array: true,
    nullable: true,
    default: [],
  })
  allowedChannels!: BookingChannel[] | null;

  @Column({ type: 'int', nullable: true })
  baggageAllowanceKg!: number | null;

  @Column({ type: 'boolean', default: true })
  changeable!: boolean;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  taxIrr!: bigint;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  validFrom!: Date | null;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  validUntil!: Date | null;
}
