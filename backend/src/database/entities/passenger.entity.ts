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
import { Booking } from './booking.entity';

@Index('passengers_nationalIdHash_idx', ['nationalIdHash'])
@Entity('passengers')
export class Passenger {
  @PrimaryColumn({ type: 'text', primaryKeyConstraintName: 'passengers_pkey' })
  id!: string;

  @BeforeInsert()
  generateId() {
    this.id ??= randomUUID();
  }

  @Column({ type: 'text' })
  bookingId!: string;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'bookingId',
    foreignKeyConstraintName: 'passengers_bookingId_fkey',
  })
  booking!: Booking;

  @Column({ type: 'text' })
  fullName!: string;

  @Column({ type: 'text', nullable: true })
  nationalIdEnc!: string | null;

  @Column({ type: 'text', nullable: true })
  mobileEnc!: string | null;

  @Column({ type: 'text', nullable: true })
  nationalIdHash!: string | null;

  @Column({ type: 'text', nullable: true })
  seatCode!: string | null;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  deletedAt!: Date | null;
}
