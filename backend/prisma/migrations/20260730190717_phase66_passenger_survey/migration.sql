-- AlterEnum
ALTER TYPE "AuditCategory" ADD VALUE 'SURVEY';

-- CreateTable
CREATE TABLE "survey_settings" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT NOT NULL DEFAULT 'نظرسنجی رضایت مسافران',
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_questions" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_invites" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "flightInstanceId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "smsSentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_responses" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_logs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contextId" TEXT,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costIrr" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "survey_invites_bookingId_key" ON "survey_invites"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "survey_invites_token_key" ON "survey_invites"("token");

-- CreateIndex
CREATE INDEX "survey_invites_flightInstanceId_idx" ON "survey_invites"("flightInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "survey_responses_inviteId_key" ON "survey_responses"("inviteId");

-- CreateIndex
CREATE INDEX "ai_usage_logs_provider_createdAt_idx" ON "ai_usage_logs"("provider", "createdAt");

-- AddForeignKey
ALTER TABLE "survey_settings" ADD CONSTRAINT "survey_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_invites" ADD CONSTRAINT "survey_invites_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_invites" ADD CONSTRAINT "survey_invites_flightInstanceId_fkey" FOREIGN KEY ("flightInstanceId") REFERENCES "flight_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "survey_invites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
