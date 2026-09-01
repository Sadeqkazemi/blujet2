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
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { CabinClass, FlightCouponStatus } from '../enums';
import { bigintTransformer } from '../transformers/bigint.transformer';
import { FlightInstance } from './flight-instance.entity';
import { TicketDocument } from './ticket-document.entity';

@Index('flight_coupons_ticketDocumentId_idx', ['ticketDocumentId'])
@Index('flight_coupons_flightInstanceId_status_idx', [
  'flightInstanceId',
  'status',
])
@Unique('flight_coupons_document_sequence_key', [
  'ticketDocumentId',
  'sequenceNo',
])
@Unique('flight_coupons_document_flight_key', [
  'ticketDocumentId',
  'flightInstanceId',
])
@Entity('flight_coupons')
export class FlightCoupon {
  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: 'flight_coupons_pkey',
  })
  id!: string;

  @BeforeInsert()
  generateId() {
    this.id ??= randomUUID();
  }

  @Column({ type: 'text' })
  ticketDocumentId!: string;

  @ManyToOne(() => TicketDocument, (document) => document.coupons, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'ticketDocumentId',
    foreignKeyConstraintName: 'flight_coupons_ticketDocumentId_fkey',
  })
  ticketDocument!: TicketDocument;

  @Column({ type: 'text' })
  flightInstanceId!: string;

  @ManyToOne(() => FlightInstance, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'flightInstanceId',
    foreignKeyConstraintName: 'flight_coupons_flightInstanceId_fkey',
  })
  flightInstance!: FlightInstance;

  @Column({ type: 'int' })
  sequenceNo!: number;

  @Column({
    type: 'enum',
    enum: FlightCouponStatus,
    enumName: 'FlightCouponStatus',
    default: FlightCouponStatus.OPEN,
  })
  status: FlightCouponStatus = FlightCouponStatus.OPEN;

  @Column({ type: 'text' })
  flightNo!: string;

  @Column({ type: 'text' })
  originCode!: string;

  @Column({ type: 'text' })
  destCode!: string;

  @Column({ type: 'timestamp', precision: 3 })
  departureAt!: Date;

  @Column({ type: 'enum', enum: CabinClass, enumName: 'CabinClass' })
  cabin!: CabinClass;

  @Column({ type: 'text', nullable: true })
  fareClassCode!: string | null;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  fareIrr = 0n;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  taxIrr = 0n;

  @CreateDateColumn({ precision: 3, default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @UpdateDateColumn({ precision: 3, default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}
