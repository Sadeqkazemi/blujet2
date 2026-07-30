-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('FULL_TIME', 'REMOTE', 'PART_TIME');

-- CreateEnum
CREATE TYPE "JobApplicantGender" AS ENUM ('FEMALE', 'MALE');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED');

-- CreateEnum
CREATE TYPE "MilitaryStatus" AS ENUM ('CONSCRIPT', 'EXEMPT', 'WAIVED');

-- CreateEnum
CREATE TYPE "JobApplicationStatus" AS ENUM ('SUBMITTED', 'REFERRED', 'HIRED', 'REJECTED');

-- AlterEnum
ALTER TYPE "AuditCategory" ADD VALUE 'CONTENT';

-- CreateTable
CREATE TABLE "careers_settings" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "careers_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_postings" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dept" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "type" "JobType" NOT NULL DEFAULT 'FULL_TIME',
    "generalReqs" TEXT[],
    "specialReqs" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_postings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_applications" (
    "id" TEXT NOT NULL,
    "jobPostingId" TEXT,
    "jobTitleSnapshot" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "nationalIdEnc" TEXT NOT NULL,
    "nationalIdHash" TEXT NOT NULL,
    "fatherName" TEXT,
    "birthDate" TIMESTAMP(3),
    "birthProvince" TEXT,
    "birthCity" TEXT,
    "gender" "JobApplicantGender",
    "marital" "MaritalStatus",
    "military" "MilitaryStatus",
    "exemptionType" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "residenceProvince" TEXT,
    "residenceAddress" TEXT,
    "eduEntries" JSONB NOT NULL DEFAULT '[]',
    "workEntries" JSONB NOT NULL DEFAULT '[]',
    "langEntries" JSONB NOT NULL DEFAULT '[]',
    "skills" TEXT,
    "otherLangs" TEXT,
    "resumeFileName" TEXT,
    "resumeMimeType" TEXT,
    "resumeSizeBytes" INTEGER,
    "resumePath" TEXT,
    "status" "JobApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "assigneeId" TEXT,
    "history" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_applications_nationalIdHash_idx" ON "job_applications"("nationalIdHash");

-- CreateIndex
CREATE INDEX "job_applications_status_idx" ON "job_applications"("status");

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "job_postings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
