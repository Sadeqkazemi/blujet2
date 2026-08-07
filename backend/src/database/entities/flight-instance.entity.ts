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
import { FlightDefinitionStatus, FlightInstanceStatus } from '../enums';
import { bigintTransformer } from '../transformers/bigint.transformer';
import type { JsonValue } from '../json-types';
import { Flight } from './flight.entity';
import { Schedule } from './schedule.entity';

@Index('flight_instances_departureAt_idx', ['departureAt'])
@Index(
  'flight_instances_scheduleId_departureAt_key',
  ['scheduleId', 'departureAt'],
  { unique: true },
)
@Entity('flight_instances')
export class FlightInstance {
  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: 'flight_instances_pkey',
  })
  id!: string;

  @BeforeInsert()
  generateId() {
    this.id ??= randomUUID();
  }

  @Column({ type: 'text' })
  flightId!: string;

  @ManyToOne(() => Flight, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'flightId',
    foreignKeyConstraintName: 'flight_instances_flightId_fkey',
  })
  flight!: Flight;

  @Column({ type: 'timestamp', precision: 3 })
  departureAt!: Date;

  @Column({ type: 'timestamp', precision: 3 })
  arrivalAt!: Date;

  @Column({ type: 'int' })
  capacity!: number;

  @Column({ type: 'int', default: 0 })
  charterSeats!: number;

  @Column({
    type: 'enum',
    enum: FlightInstanceStatus,
    enumName: 'FlightInstanceStatus',
    default: FlightInstanceStatus.SCHEDULED,
  })
  status!: FlightInstanceStatus;

  @Column({ type: 'int', nullable: true })
  agencySeatsAllocated!: number | null;

  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  basePriceIrr!: bigint | null;

  @Column({ type: 'jsonb', nullable: true })
  aiSuggestion!: JsonValue | null;

  @Column({ type: 'text', nullable: true })
  scheduleId!: string | null;

  @ManyToOne(() => Schedule, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'scheduleId',
    foreignKeyConstraintName: 'flight_instances_scheduleId_fkey',
  })
  schedule!: Schedule | null;

  @Column({ type: 'text', nullable: true })
  aircraftRegistration!: string | null;

  @Column({ type: 'text', nullable: true })
  aircraftTypeOverride!: string | null;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  saleEndsAt!: Date | null;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  saleStartsAt!: Date | null;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  niraSubmittedAt!: Date | null;

  /** Block time in minutes. When set, arrivalAt = departureAt + durationMinutes. */
  @Column({ type: 'int', nullable: true })
  durationMinutes!: number | null;

  /** Optional competitor observation (IRR) for commercial pricing UI. */
  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  competitorPriceIrr!: bigint | null;

  /**
   * Per-cabin capacities: [{ cabin, seats }]. COMFORT is independent of ECONOMY.
   * Null on legacy rows (pre-definition migration).
   */
  @Column({ type: 'jsonb', nullable: true })
  cabinCapacities!: JsonValue | null;

  /**
   * Definition workflow. Legacy rows default to APPROVED so existing inventory
   * stays bookable without a CEO re-approval.
   */
  @Column({
    type: 'enum',
    enum: FlightDefinitionStatus,
    enumName: 'FlightDefinitionStatus',
    default: FlightDefinitionStatus.APPROVED,
  })
  definitionStatus!: FlightDefinitionStatus;

  @Column({ type: 'text', nullable: true })
  rejectionReason!: string | null;

  /** Last CEO-approved definition snapshot (immutable until next approval). */
  @Column({ type: 'jsonb', nullable: true })
  approvedSnapshot!: JsonValue | null;

  /** Pending definition while definitionStatus = PENDING_REVISION. */
  @Column({ type: 'jsonb', nullable: true })
  pendingRevisionSnapshot!: JsonValue | null;
}
