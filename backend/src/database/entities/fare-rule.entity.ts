import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { bigintTransformer } from '../transformers/bigint.transformer';
import { BookingChannel, CabinClass } from '../enums';

/**
 * Phase 0 spike entity #3 — covers the one enum-array column in the whole
 * schema (`allowedChannels`), a composite `@@unique`, and BigInt money
 * columns (`priceIrr`/`taxIrr`) via `bigintTransformer` so
 * `src/common/money.ts`'s `bigint`-based contract stays unchanged.
 */
// @Index({unique:true}), not @Unique() — see seat-lock.entity.ts's comment;
// TypeORM's @@unique is a plain UNIQUE INDEX, not a CONSTRAINT.
@Index(
  'fare_rules_flightInstanceId_cabin_classCode_key',
  ['flightInstanceId', 'cabin', 'classCode'],
  { unique: true },
)
@Entity('fare_rules')
export class FareRule {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'text' })
  flightInstanceId!: string;

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

  @Column({ type: 'boolean', default: true })
  changeable!: boolean;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  taxIrr!: bigint;

  @Column({ type: 'int', nullable: true })
  baggageAllowanceKg!: number | null;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  validFrom!: Date | null;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  validUntil!: Date | null;

  @Column({
    type: 'enum',
    enum: BookingChannel,
    enumName: 'BookingChannel',
    array: true,
    nullable: true,
    default: [],
  })
  allowedChannels!: BookingChannel[] | null;
}
