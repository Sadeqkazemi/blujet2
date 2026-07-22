-- CreateEnum
CREATE TYPE "SmsMessageType" AS ENUM ('OTP', 'TEMP_PASSWORD');

-- CreateEnum
CREATE TYPE "SmsStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "sms_logs" (
    "id" TEXT NOT NULL,
    "phone" TEXT,
    "messageType" "SmsMessageType" NOT NULL,
    "status" "SmsStatus" NOT NULL,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sms_logs_createdAt_idx" ON "sms_logs"("createdAt");
