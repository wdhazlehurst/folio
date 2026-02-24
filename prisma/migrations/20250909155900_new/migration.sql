/*
  Warnings:

  - A unique constraint covering the columns `[title,userId]` on the table `ExpenseCategory` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `ExpenseCategory` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."ExpenseCategory" ADD COLUMN     "userId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_title_userId_key" ON "public"."ExpenseCategory"("title", "userId");

-- AddForeignKey
ALTER TABLE "public"."ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
