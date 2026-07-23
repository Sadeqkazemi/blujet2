-- AlterEnum
ALTER TYPE "TwoFactorPurpose" ADD VALUE 'STEP_UP_VERIFICATION';

-- CreateEnum
CREATE TYPE "StepUpScope" AS ENUM ('ADMIN_ROLE_CHANGE', 'API_KEY_ROTATE', 'REFUND_PAYOUT', 'PRICE_CAPACITY_CHANGE', 'SESSION_REVOKE');

-- AlterTable
ALTER TABLE "two_factor_challenges" ADD COLUMN "scope" "StepUpScope";
