import { randomUUID } from 'node:crypto';
import { BeforeInsert, Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Index('routes_originCode_destCode_key', ['originCode', 'destCode'], {
  unique: true,
})
@Entity('routes')
export class Route {
  @PrimaryColumn({ type: 'text', primaryKeyConstraintName: 'routes_pkey' })
  id!: string;

  @BeforeInsert()
  generateId() {
    this.id ??= randomUUID();
  }

  @Column({ type: 'text' })
  originCode!: string;

  @Column({ type: 'text' })
  destCode!: string;

  @Column({ type: 'int', default: 120 })
  durationMin!: number;
}
