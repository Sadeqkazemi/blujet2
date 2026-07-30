-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('FA', 'EN', 'AR');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "preferredLocale" "Locale" NOT NULL DEFAULT 'FA';
