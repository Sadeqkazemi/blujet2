import { randomUUID } from 'node:crypto';
import { BeforeInsert, Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Index('airports_code_key', ['code'], { unique: true })
@Entity('airports')
export class Airport {
  @PrimaryColumn({ type: 'text', primaryKeyConstraintName: 'airports_pkey' })
  id!: string;

  @BeforeInsert()
  generateId() {
    this.id ??= randomUUID();
  }

  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'text' })
  cityFa!: string;

  @Column({ type: 'text' })
  tz!: string;

  @Column({ type: 'int', default: 60 })
  minConnectMin!: number;
}
