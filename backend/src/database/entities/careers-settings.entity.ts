import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Phase 0 spike entity #4 — exists solely to answer the @UpdateDateColumn
 * question. Live DB check confirmed `updatedAt` has NO column default
 * (Prisma's `@updatedAt` is set client-side on every write, unlike
 * `createdAt`'s `DEFAULT CURRENT_TIMESTAMP`) — so this uses a plain
 * @Column, not @UpdateDateColumn (which would want `DEFAULT
 * CURRENT_TIMESTAMP` and diff against the real schema). Services must set
 * `updatedAt: new Date()` explicitly on every write, same discipline as
 * Prisma's `@updatedAt` gave for free — flagged again in Phase 2.
 */
@Entity('careers_settings')
export class CareersSettings {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ type: 'timestamp', precision: 3 })
  updatedAt!: Date;

  @CreateDateColumn({ type: 'timestamp', precision: 3 })
  createdAt!: Date;
}
