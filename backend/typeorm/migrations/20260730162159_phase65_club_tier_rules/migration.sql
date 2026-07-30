-- CreateTable
CREATE TABLE "club_tier_rules" (
    "id" TEXT NOT NULL,
    "goldMinPoints" INTEGER NOT NULL DEFAULT 5000,
    "platinumMinPoints" INTEGER NOT NULL DEFAULT 15000,
    "cardRequestMinPoints" INTEGER NOT NULL DEFAULT 5000,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_tier_rules_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "club_tier_rules" ADD CONSTRAINT "club_tier_rules_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
