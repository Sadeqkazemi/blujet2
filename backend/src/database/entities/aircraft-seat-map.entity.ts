import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Index('aircraft_seat_maps_aircraftType_key', ['aircraftType'], {
  unique: true,
})
@Entity('aircraft_seat_maps')
export class AircraftSeatMap {
  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: 'aircraft_seat_maps_pkey',
  })
  id!: string;

  @Column({ type: 'text' })
  aircraftType!: string;

  @Column({ type: 'int' })
  businessRowStart!: number;

  @Column({ type: 'int' })
  businessRowEnd!: number;

  @Column({ type: 'text', array: true, nullable: true })
  businessColsLeft!: string[] | null;

  @Column({ type: 'text', array: true, nullable: true })
  businessColsRight!: string[] | null;

  @Column({ type: 'int' })
  economyRowStart!: number;

  @Column({ type: 'int' })
  economyRowEnd!: number;

  @Column({ type: 'text', array: true, nullable: true })
  economyColsLeft!: string[] | null;

  @Column({ type: 'text', array: true, nullable: true })
  economyColsRight!: string[] | null;

  @Column({ type: 'timestamp', precision: 3 })
  updatedAt!: Date;

  @Column({ type: 'text', array: true, nullable: true, default: [] })
  excludedSeatCodes!: string[] | null;
}
