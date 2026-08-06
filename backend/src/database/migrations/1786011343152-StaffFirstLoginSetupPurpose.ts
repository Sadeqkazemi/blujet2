import { MigrationInterface, QueryRunner } from 'typeorm';

export class StaffFirstLoginSetupPurpose1786011343152 implements MigrationInterface {
  name = 'StaffFirstLoginSetupPurpose1786011343152';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."TwoFactorPurpose" RENAME TO "TwoFactorPurpose_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."TwoFactorPurpose" AS ENUM('STAFF_LOGIN_2FA', 'CUSTOMER_OTP_LOGIN', 'STEP_UP_VERIFICATION', 'EMAIL_VERIFY', 'PASSWORD_RESET_EMAIL', 'AGENCY_PASSWORD_RESET', 'STAFF_FIRST_LOGIN_SETUP')`,
    );
    await queryRunner.query(
      `ALTER TABLE "two_factor_challenges" ALTER COLUMN "purpose" TYPE "public"."TwoFactorPurpose" USING "purpose"::"text"::"public"."TwoFactorPurpose"`,
    );
    await queryRunner.query(`DROP TYPE "public"."TwoFactorPurpose_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."TwoFactorPurpose_old" AS ENUM('STAFF_LOGIN_2FA', 'CUSTOMER_OTP_LOGIN', 'STEP_UP_VERIFICATION', 'EMAIL_VERIFY', 'PASSWORD_RESET_EMAIL', 'AGENCY_PASSWORD_RESET')`,
    );
    await queryRunner.query(
      `ALTER TABLE "two_factor_challenges" ALTER COLUMN "purpose" TYPE "public"."TwoFactorPurpose_old" USING "purpose"::"text"::"public"."TwoFactorPurpose_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."TwoFactorPurpose"`);
    await queryRunner.query(
      `ALTER TYPE "public"."TwoFactorPurpose_old" RENAME TO "TwoFactorPurpose"`,
    );
  }
}
