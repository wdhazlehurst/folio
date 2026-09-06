-- CreateEnum
CREATE TYPE "ContributionKind" AS ENUM ('EMPLOYEE', 'EMPLOYER_MATCH', 'ROLLOVER', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "ContributionLimitGroup" AS ENUM ('IRA', 'EMPLOYER_PLAN', 'HSA', 'NONE');

-- CreateEnum
CREATE TYPE "HsaCoverage" AS ENUM ('SELF_ONLY', 'FAMILY');

-- CreateEnum
CREATE TYPE "ContributionLimitVariant" AS ENUM ('STANDARD', 'HSA_SELF_ONLY', 'HSA_FAMILY');

-- AlterTable
ALTER TABLE "Investment" ADD COLUMN     "annualSalary" DECIMAL(12,2),
ADD COLUMN     "assumedReturnRate" DECIMAL(6,4),
ADD COLUMN     "employerMatchLimitPercent" DECIMAL(6,4),
ADD COLUMN     "employerMatchPercent" DECIMAL(6,4),
ADD COLUMN     "hsaCoverage" "HsaCoverage";

-- AlterTable
ALTER TABLE "InvestmentContribution" ADD COLUMN     "kind" "ContributionKind" NOT NULL DEFAULT 'EMPLOYEE';

-- CreateTable
CREATE TABLE "ContributionLimit" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "group" "ContributionLimitGroup" NOT NULL,
    "variant" "ContributionLimitVariant" NOT NULL DEFAULT 'STANDARD',
    "limit" DECIMAL(12,2) NOT NULL,
    "totalAdditionsLimit" DECIMAL(12,2),
    "contributedAdjustment" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContributionLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContributionLimit_userId_year_idx" ON "ContributionLimit"("userId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "ContributionLimit_userId_year_group_variant_key" ON "ContributionLimit"("userId", "year", "group", "variant");

-- AddForeignKey
ALTER TABLE "ContributionLimit" ADD CONSTRAINT "ContributionLimit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
