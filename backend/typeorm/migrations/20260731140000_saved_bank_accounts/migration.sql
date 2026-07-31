-- CreateTable
CREATE TABLE "saved_bank_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankShort" TEXT NOT NULL,
    "brandColor" TEXT NOT NULL,
    "cardPanEnc" TEXT,
    "cardLast4" TEXT,
    "shebaEnc" TEXT NOT NULL,
    "shebaHash" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_bank_accounts_userId_createdAt_idx" ON "saved_bank_accounts"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "saved_bank_accounts_userId_shebaHash_idx" ON "saved_bank_accounts"("userId", "shebaHash");

-- AddForeignKey
ALTER TABLE "saved_bank_accounts" ADD CONSTRAINT "saved_bank_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
