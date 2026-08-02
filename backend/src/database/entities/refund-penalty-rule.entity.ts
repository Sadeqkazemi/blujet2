import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('refund_penalty_rules')
export class RefundPenaltyRule {
  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: 'refund_penalty_rules_pkey',
  })
  id!: string;

  @Column({ type: 'int' })
  minHoursBeforeDeparture!: number;

  @Column({ type: 'int' })
  penaltyPct!: number;

  @Column({ type: 'text' })
  labelFa!: string;
}
