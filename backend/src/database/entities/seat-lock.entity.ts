import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import { LockApprovalStatus, LockClassification, Role } from '../enums';

/**
 * Phase 0 spike entity #2 — the partial-unique-index case. FK columns to
 * User/FlightInstance/Booking stay scalar (no @ManyToOne) since those
 * entities don't exist yet in this spike; relations are added in Phase 2
 * once the full 77-entity set lands together.
 *
 * `seat_locks_active_seat_unique` (UNIQUE ON (flightInstanceId, seatCode)
 * WHERE "releasedAt" IS NULL) is the schema's only hand-written DDL with no
 * Prisma-schema equivalent, and it's what CLAUDE.md's double-booking
 * guarantee for seat *locks* relies on. This is exactly the case Phase 0
 * exists to answer: does the @Index(... { where }) decorator round-trip
 * cleanly, or does it need to live in a hand-written migration instead
 * (see docs/features/typeorm-migration-phase-0.md once written).
 */
@Index('seat_locks_active_seat_unique', ['flightInstanceId', 'seatCode'], {
  unique: true,
  where: '"releasedAt" IS NULL',
})
// Prisma's `@unique` compiles to a plain UNIQUE INDEX (verified against
// pg_constraint — "seat_locks_bookingId_key" has no CONSTRAINT entry), so
// this must be @Index({unique:true}), never the @Unique() decorator (which
// creates an ADD CONSTRAINT ... UNIQUE and diffs forever against Prisma's
// schema even with a matching name).
@Index('seat_locks_bookingId_key', ['bookingId'], { unique: true })
@Entity('seat_locks')
export class SeatLock {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Index('seat_locks_flightInstanceId_idx')
  @Column({ type: 'text' })
  flightInstanceId!: string;

  @Column({ type: 'text' })
  seatCode!: string;

  @Column({ type: 'text' })
  lockedById!: string;

  @Column({ type: 'text', nullable: true })
  passengerName!: string | null;

  @Column({ type: 'text', nullable: true })
  passengerNationalIdEnc!: string | null;

  @Column({ type: 'text', nullable: true })
  passengerNationalIdHash!: string | null;

  @Column({ type: 'text', nullable: true })
  passengerMobileEnc!: string | null;

  @Column({ type: 'text', nullable: true })
  releasedById!: string | null;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  releasedAt!: Date | null;

  @CreateDateColumn({
    type: 'timestamp',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @Column({ type: 'text', default: '' })
  reason!: string;

  @Column({
    type: 'enum',
    enum: LockClassification,
    enumName: 'LockClassification',
    default: LockClassification.PAYABLE,
  })
  classification!: LockClassification;

  @Column({ type: 'int', nullable: true })
  discountPct!: number | null;

  @Column({
    type: 'enum',
    enum: Role,
    enumName: 'Role',
    default: Role.IT_MANAGER,
  })
  requesterRank!: Role;

  @Column({
    type: 'enum',
    enum: LockApprovalStatus,
    enumName: 'LockApprovalStatus',
    default: LockApprovalStatus.APPROVED,
  })
  approvalStatus!: LockApprovalStatus;

  @Column({ type: 'text', nullable: true })
  approvedById!: string | null;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  approvedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectedById!: string | null;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  rejectedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason!: string | null;

  @Column({
    type: 'timestamp',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP',
  })
  expiresAt!: Date;

  @Column({ type: 'text', nullable: true })
  bookingId!: string | null;
}
