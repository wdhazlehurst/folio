-- CreateEnum
CREATE TYPE "PostingStatus" AS ENUM ('PROJECTED', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EarningFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'SEMI_MONTHLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "OccurrenceExceptionAction" AS ENUM ('SKIP', 'OVERRIDE');

-- CreateEnum
CREATE TYPE "BucketAllocationType" AS ENUM ('PERCENT', 'FIXED');

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "bucketId" TEXT;

-- CreateTable
CREATE TABLE "EarningRule" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(32) NOT NULL,
    "description" VARCHAR(256),
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "frequency" "EarningFrequency" NOT NULL,
    "anchorDate" DATE NOT NULL,
    "secondDayOfMonth" INTEGER,
    "endDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastMaterializedThrough" DATE,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EarningRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Earning" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(32) NOT NULL,
    "description" VARCHAR(256),
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "date" DATE NOT NULL,
    "scheduledDate" DATE,
    "status" "PostingStatus" NOT NULL DEFAULT 'PROJECTED',
    "confirmedAt" TIMESTAMP(3),
    "ruleId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Earning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EarningException" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "scheduledDate" DATE NOT NULL,
    "action" "OccurrenceExceptionAction" NOT NULL,
    "overrideDate" DATE,
    "overrideGross" DECIMAL(12,2),
    "overrideNet" DECIMAL(12,2),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EarningException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetBucket" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(32) NOT NULL,
    "description" VARCHAR(128),
    "allocationType" "BucketAllocationType" NOT NULL DEFAULT 'PERCENT',
    "allocationValue" DECIMAL(12,2) NOT NULL,
    "rollover" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BucketPeriod" (
    "id" TEXT NOT NULL,
    "bucketId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "openingBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BucketPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BucketAllocation" (
    "id" TEXT NOT NULL,
    "bucketId" TEXT NOT NULL,
    "earningId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "periodStart" DATE NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BucketAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EarningRule_userId_idx" ON "EarningRule"("userId");

-- CreateIndex
CREATE INDEX "Earning_userId_date_idx" ON "Earning"("userId", "date");

-- CreateIndex
CREATE INDEX "Earning_userId_status_idx" ON "Earning"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Earning_ruleId_scheduledDate_key" ON "Earning"("ruleId", "scheduledDate");

-- CreateIndex
CREATE INDEX "EarningException_userId_idx" ON "EarningException"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EarningException_ruleId_scheduledDate_key" ON "EarningException"("ruleId", "scheduledDate");

-- CreateIndex
CREATE INDEX "BudgetBucket_userId_idx" ON "BudgetBucket"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetBucket_title_userId_key" ON "BudgetBucket"("title", "userId");

-- CreateIndex
CREATE INDEX "BucketPeriod_userId_periodStart_idx" ON "BucketPeriod"("userId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "BucketPeriod_bucketId_periodStart_key" ON "BucketPeriod"("bucketId", "periodStart");

-- CreateIndex
CREATE INDEX "BucketAllocation_userId_periodStart_idx" ON "BucketAllocation"("userId", "periodStart");

-- CreateIndex
CREATE INDEX "BucketAllocation_bucketId_periodStart_idx" ON "BucketAllocation"("bucketId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "BucketAllocation_earningId_bucketId_key" ON "BucketAllocation"("earningId", "bucketId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "BudgetBucket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarningRule" ADD CONSTRAINT "EarningRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Earning" ADD CONSTRAINT "Earning_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "EarningRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Earning" ADD CONSTRAINT "Earning_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarningException" ADD CONSTRAINT "EarningException_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "EarningRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarningException" ADD CONSTRAINT "EarningException_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetBucket" ADD CONSTRAINT "BudgetBucket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BucketPeriod" ADD CONSTRAINT "BucketPeriod_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "BudgetBucket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BucketPeriod" ADD CONSTRAINT "BucketPeriod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BucketAllocation" ADD CONSTRAINT "BucketAllocation_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "BudgetBucket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BucketAllocation" ADD CONSTRAINT "BucketAllocation_earningId_fkey" FOREIGN KEY ("earningId") REFERENCES "Earning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BucketAllocation" ADD CONSTRAINT "BucketAllocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
