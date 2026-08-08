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
import { CabinClass } from '../enums';
import { AircraftDefinition } from './aircraft-definition.entity';

/** Per-aircraft cabin capacity row. The set of rows for one
 * aircraftDefinitionId must sum to that aircraft's totalCapacity
 * (enforced in AircraftService, not the DB — same convention as
 * FlightInstanceCabinCapacity-style sum checks elsewhere). */
@Index(
  'aircraft_cabins_aircraftDefinitionId_cabinType_key',
  ['aircraftDefinitionId', 'cabinType'],
  { unique: true },
)
@Entity('aircraft_cabins')
export class AircraftCabin {
  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: 'aircraft_cabins_pkey',
  })
  id!: string;

  @BeforeInsert()
  generateId() {
    this.id ??= randomUUID();
  }

  @Column({ type: 'text' })
  aircraftDefinitionId!: string;

  @ManyToOne(() => AircraftDefinition, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'aircraftDefinitionId',
    foreignKeyConstraintName: 'aircraft_cabins_aircraftDefinitionId_fkey',
  })
  aircraftDefinition!: AircraftDefinition;

  @Column({ type: 'enum', enum: CabinClass, enumName: 'CabinClass' })
  cabinType!: CabinClass;

  @Column({ type: 'int' })
  capacity!: number;

  @Column({ type: 'timestamp', precision: 3 })
  createdAt!: Date;

  @Column({ type: 'timestamp', precision: 3 })
  updatedAt!: Date;
}
