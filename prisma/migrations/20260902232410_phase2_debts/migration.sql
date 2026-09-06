-- CreateTable
CREATE TABLE "Debt" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(32) NOT NULL,
    "description" VARCHAR(256),
    "balance" DECIMAL(12,2) NOT NULL,
    "interestRate" DECIMAL(6,4) NOT NULL,
    "minimumPayment" DECIMAL(12,2) NOT NULL,
    "paymentAmount" DECIMAL(12,2) NOT NULL,
    "anchorDate" DATE NOT NULL,
    "endDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastMaterializedThrough" DATE,
    "bucketId" TEXT,
    "categoryId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtPayment" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" DATE NOT NULL,
    "scheduledDate" DATE,
    "status" "PostingStatus" NOT NULL DEFAULT 'PROJECTED',
    "confirmedAt" TIMESTAMP(3),
    "debtId" TEXT,
    "expenseId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DebtPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtPaymentException" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "scheduledDate" DATE NOT NULL,
    "action" "OccurrenceExceptionAction" NOT NULL,
    "overrideDate" DATE,
    "overrideAmount" DECIMAL(12,2),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DebtPaymentException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Debt_userId_idx" ON "Debt"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DebtPayment_expenseId_key" ON "DebtPayment"("expenseId");

-- CreateIndex
CREATE INDEX "DebtPayment_userId_date_idx" ON "DebtPayment"("userId", "date");

-- CreateIndex
CREATE INDEX "DebtPayment_userId_status_idx" ON "DebtPayment"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DebtPayment_debtId_scheduledDate_key" ON "DebtPayment"("debtId", "scheduledDate");

-- CreateIndex
CREATE INDEX "DebtPaymentException_userId_idx" ON "DebtPaymentException"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DebtPaymentException_debtId_scheduledDate_key" ON "DebtPaymentException"("debtId", "scheduledDate");

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "BudgetBucket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtPaymentException" ADD CONSTRAINT "DebtPaymentException_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtPaymentException" ADD CONSTRAINT "DebtPaymentException_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
