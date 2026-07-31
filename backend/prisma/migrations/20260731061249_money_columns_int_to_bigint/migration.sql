-- AlterTable
ALTER TABLE "agency_allotments" ALTER COLUMN "contractPriceIrr" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "agency_credit_lines" ALTER COLUMN "limitIrr" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "agency_credit_requests" ALTER COLUMN "requestedLimitIrr" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "agency_invoices" ALTER COLUMN "amountIrr" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "agency_webservice_requests" ALTER COLUMN "priceIrr" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "ai_usage_logs" ALTER COLUMN "costIrr" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "bookings" ALTER COLUMN "priceIrr" SET DATA TYPE BIGINT,
ALTER COLUMN "taxIrr" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "cabin_fares" ALTER COLUMN "priceIrr" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "fare_pricing_proposals" ALTER COLUMN "basePriceIrr" SET DATA TYPE BIGINT,
ALTER COLUMN "competitorPriceIrr" SET DATA TYPE BIGINT,
ALTER COLUMN "proposedPriceIrr" SET DATA TYPE BIGINT,
ALTER COLUMN "legalRateIrr" SET DATA TYPE BIGINT,
ALTER COLUMN "registeredPriceIrr" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "fare_rules" ALTER COLUMN "priceIrr" SET DATA TYPE BIGINT,
ALTER COLUMN "taxIrr" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "flight_instances" ALTER COLUMN "basePriceIrr" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "ledger_entries" ALTER COLUMN "signedAmountIrr" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "payment_reconciliations" ALTER COLUMN "amountIrr" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "price_locks" ALTER COLUMN "lockedPriceIrr" SET DATA TYPE BIGINT,
ALTER COLUMN "feeIrr" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "promo_codes" ALTER COLUMN "value" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "promo_redemptions" ALTER COLUMN "discountIrr" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "refund_requests" ALTER COLUMN "totalPaidIrr" SET DATA TYPE BIGINT,
ALTER COLUMN "penaltyAmountIrr" SET DATA TYPE BIGINT,
ALTER COLUMN "refundableIrr" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "wallet_entries" ALTER COLUMN "signedAmountIrr" SET DATA TYPE BIGINT;
