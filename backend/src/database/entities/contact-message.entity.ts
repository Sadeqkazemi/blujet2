import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/**
 * Phase 0 spike entity #1 — baseline sanity check. Plain columns, a
 * `createdAt` default, one index, no relations. If this doesn't produce an
 * empty schema-parity diff, nothing else will either.
 */
@Entity('contact_messages')
export class ContactMessage {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  phone!: string;

  @Column({ type: 'text' })
  subject!: string;

  @Column({ type: 'text' })
  body!: string;

  @Index('contact_messages_createdAt_idx')
  @CreateDateColumn({
    type: 'timestamp',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;
}
