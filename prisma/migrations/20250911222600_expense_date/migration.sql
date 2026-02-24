-- AlterTable
ALTER TABLE "public"."Expense" ADD COLUMN     "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."ExpenseCategory" ALTER COLUMN "description" DROP NOT NULL;
