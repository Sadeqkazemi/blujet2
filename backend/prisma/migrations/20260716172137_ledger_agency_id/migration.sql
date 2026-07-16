-- AlterTable
ALTER TABLE "ledger_entries" ADD COLUMN     "agencyId" TEXT;

-- CreateIndex
CREATE INDEX "ledger_entries_agencyId_type_idx" ON "ledger_entries"("agencyId", "type");

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency_profiles"("userId") ON DELETE SET NULL ON UPDATE CASCADE;
