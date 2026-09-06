-- AlterTable
ALTER TABLE "InvestmentContribution" ADD COLUMN     "sourceContributionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentContribution_sourceContributionId_key" ON "InvestmentContribution"("sourceContributionId");

-- AddForeignKey
ALTER TABLE "InvestmentContribution" ADD CONSTRAINT "InvestmentContribution_sourceContributionId_fkey" FOREIGN KEY ("sourceContributionId") REFERENCES "InvestmentContribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

