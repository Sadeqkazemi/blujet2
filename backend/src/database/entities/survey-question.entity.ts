import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('survey_questions')
export class SurveyQuestion {
  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: 'survey_questions_pkey',
  })
  id!: string;

  @Column({ type: 'text' })
  label!: string;

  @Column({ type: 'int' })
  order!: number;

  @CreateDateColumn({ precision: 3, default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
