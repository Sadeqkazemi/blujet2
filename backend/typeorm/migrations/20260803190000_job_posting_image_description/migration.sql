-- AlterTable
ALTER TABLE "job_postings" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN "imageFileId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "job_postings_imageFileId_key" ON "job_postings"("imageFileId");

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_imageFileId_fkey" FOREIGN KEY ("imageFileId") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
