-- CreateTable
CREATE TABLE "saved_passengers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "latinName" TEXT NOT NULL,
    "nationalIdEnc" TEXT,
    "nationalIdHash" TEXT,
    "passportNoEnc" TEXT,
    "mobileEnc" TEXT,
    "isChild" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_passengers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_passengers_userId_createdAt_idx" ON "saved_passengers"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "saved_passengers_userId_nationalIdHash_idx" ON "saved_passengers"("userId", "nationalIdHash");

-- AddForeignKey
ALTER TABLE "saved_passengers" ADD CONSTRAINT "saved_passengers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
