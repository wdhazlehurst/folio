-- CreateEnum
CREATE TYPE "public"."Recurrence" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- AlterTable
ALTER TABLE "public"."Expense" ADD COLUMN     "endsOn" DATE,
ADD COLUMN     "interval" INTEGER,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastAppliedOn" DATE,
ADD COLUMN     "recurrence" "public"."Recurrence" NOT NULL DEFAULT 'NONE';
