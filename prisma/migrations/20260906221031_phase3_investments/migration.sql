-- CreateEnum
CREATE TYPE "InvestmentAccountType" AS ENUM ('HSA', 'ROTH_IRA', 'TRADITIONAL_IRA', 'FOUR_ZERO_ONE_K', 'SAVINGS', 'OTHER');

-- CreateTable
CREATE TABLE "Investment" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(32) NOT NULL,
    "description" VARCHAR(256),
    "accountType" "InvestmentAccountType" NOT NULL,
    "institution" VARCHAR(64),
    "balance" DECIMAL(12,2) NOT NULL,
    "contributionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "frequency" "EarningFrequency" NOT NULL DEFAULT 'MONTHLY',
    "anchorDate" DATE NOT NULL,
    "secondDayOfMonth" INTEGER,
    "endDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastMaterializedThrough" DATE,
    "bucketId" TEXT,
    "categoryId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentContribution" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" DATE NOT NULL,
    "scheduledDate" DATE,
    "status" "PostingStatus" NOT NULL DEFAULT 'PROJECTED',
    "confirmedAt" TIMESTAMP(3),
    "investmentId" TEXT,
    "expenseId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentContributionException" (
    "id" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "scheduledDate" DATE NOT NULL,
    "action" "OccurrenceExceptionAction" NOT NULL,
    "overrideDate" DATE,
    "overrideAmount" DECIMAL(12,2),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentContributionException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentSnapshot" (
    "id" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Investment_userId_idx" ON "Investment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentContribution_expenseId_key" ON "InvestmentContribution"("expenseId");

-- CreateIndex
CREATE INDEX "InvestmentContribution_userId_date_idx" ON "InvestmentContribution"("userId", "date");

-- CreateIndex
CREATE INDEX "InvestmentContribution_userId_status_idx" ON "InvestmentContribution"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentContribution_investmentId_scheduledDate_key" ON "InvestmentContribution"("investmentId", "scheduledDate");

-- CreateIndex
CREATE INDEX "InvestmentContributionException_userId_idx" ON "InvestmentContributionException"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentContributionException_investmentId_scheduledDate_key" ON "InvestmentContributionException"("investmentId", "scheduledDate");

-- CreateIndex
CREATE INDEX "InvestmentSnapshot_userId_date_idx" ON "InvestmentSnapshot"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentSnapshot_investmentId_date_key" ON "InvestmentSnapshot"("investmentId", "date");

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "BudgetBucket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentContribution" ADD CONSTRAINT "InvestmentContribution_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentContribution" ADD CONSTRAINT "InvestmentContribution_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentContribution" ADD CONSTRAINT "InvestmentContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentContributionException" ADD CONSTRAINT "InvestmentContributionException_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentContributionException" ADD CONSTRAINT "InvestmentContributionException_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentSnapshot" ADD CONSTRAINT "InvestmentSnapshot_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentSnapshot" ADD CONSTRAINT "InvestmentSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
