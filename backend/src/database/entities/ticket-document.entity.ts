import { randomUUID } from 'node:crypto';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TicketDocumentStatus } from '../enums';
import { bigintTransformer } from '../transformers/bigint.transformer';
import { Booking } from './booking.entity';
import { FlightCoupon } from './flight-coupon.entity';
import { Passenger } from './passenger.entity';

@Index('ticket_documents_documentNo_key', ['documentNo'], { unique: true })
@Index('ticket_documents_passengerId_key', ['passengerId'], { unique: true })
@Index('ticket_documents_bookingId_idx', ['bookingId'])
@Entity('ticket_documents')
export class TicketDocument {
  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: 'ticket_documents_pkey',
  })
  id!: string;

  @BeforeInsert()
  generateId() {
    this.id ??= randomUUID();
  }

  @Column({ type: 'text' })
  documentNo!: string;

  @Column({ type: 'text' })
  passengerId!: string;

  @ManyToOne(() => Passenger, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'passengerId',
    foreignKeyConstraintName: 'ticket_documents_passengerId_fkey',
  })
  passenger!: Passenger;

  @Column({ type: 'text' })
  bookingId!: string;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'bookingId',
    foreignKeyConstraintName: 'ticket_documents_bookingId_fkey',
  })
  booking!: Booking;

  @Column({
    type: 'enum',
    enum: TicketDocumentStatus,
    enumName: 'TicketDocumentStatus',
    default: TicketDocumentStatus.ISSUED,
  })
  status: TicketDocumentStatus = TicketDocumentStatus.ISSUED;

  @Column({ type: 'timestamp', precision: 3 })
  issuedAt!: Date;

  @Column({ type: 'timestamp', precision: 3 })
  originalIssueAt!: Date;

  @Column({ type: 'text', default: 'IRR' })
  currency = 'IRR';

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  totalFareIrr = 0n;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  totalTaxIrr = 0n;

  @OneToMany(() => FlightCoupon, (coupon) => coupon.ticketDocument)
  coupons!: FlightCoupon[];

  @CreateDateColumn({ precision: 3, default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @UpdateDateColumn({ precision: 3, default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}
