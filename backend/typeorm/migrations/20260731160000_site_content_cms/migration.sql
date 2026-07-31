-- CreateEnum
CREATE TYPE "SiteContentBlockKey" AS ENUM ('HERO_BANNER', 'ANNOUNCEMENT_BAR', 'PROMO_BANNER');

-- CreateTable
CREATE TABLE "site_media_assets" (
    "id" TEXT NOT NULL,
    "storedFileId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_content_blocks" (
    "key" "SiteContentBlockKey" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT NOT NULL DEFAULT '',
    "subtitle" TEXT NOT NULL DEFAULT '',
    "buttonText" TEXT NOT NULL DEFAULT '',
    "badgeText" TEXT NOT NULL DEFAULT '',
    "imageFileId" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_content_blocks_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "site_destination_highlights" (
    "id" TEXT NOT NULL,
    "airportCode" TEXT NOT NULL,
    "priceIrr" BIGINT NOT NULL,
    "imageFileId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_destination_highlights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_route_highlights" (
    "id" TEXT NOT NULL,
    "fromAirportCode" TEXT NOT NULL,
    "toAirportCode" TEXT NOT NULL,
    "priceIrr" BIGINT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_route_highlights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_media_assets_storedFileId_key" ON "site_media_assets"("storedFileId");

-- CreateIndex
CREATE INDEX "site_media_assets_uploadedById_idx" ON "site_media_assets"("uploadedById");

-- CreateIndex
CREATE UNIQUE INDEX "site_content_blocks_imageFileId_key" ON "site_content_blocks"("imageFileId");

-- CreateIndex
CREATE UNIQUE INDEX "site_destination_highlights_imageFileId_key" ON "site_destination_highlights"("imageFileId");

-- CreateIndex
CREATE INDEX "site_destination_highlights_sortOrder_idx" ON "site_destination_highlights"("sortOrder");

-- CreateIndex
CREATE INDEX "site_route_highlights_sortOrder_idx" ON "site_route_highlights"("sortOrder");

-- AddForeignKey
ALTER TABLE "site_media_assets" ADD CONSTRAINT "site_media_assets_storedFileId_fkey" FOREIGN KEY ("storedFileId") REFERENCES "stored_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_media_assets" ADD CONSTRAINT "site_media_assets_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_content_blocks" ADD CONSTRAINT "site_content_blocks_imageFileId_fkey" FOREIGN KEY ("imageFileId") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_content_blocks" ADD CONSTRAINT "site_content_blocks_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_destination_highlights" ADD CONSTRAINT "site_destination_highlights_imageFileId_fkey" FOREIGN KEY ("imageFileId") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
