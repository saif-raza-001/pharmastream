/*
  Warnings:

  - You are about to drop the column `paymentId` on the `LedgerEntry` table. All the data in the column will be lost.
  - You are about to drop the `Payment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "LedgerEntry" DROP CONSTRAINT "LedgerEntry_paymentId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_accountId_fkey";

-- DropIndex
DROP INDEX "LedgerEntry_paymentId_key";

-- AlterTable
ALTER TABLE "LedgerEntry" DROP COLUMN "paymentId";

-- AlterTable
ALTER TABLE "SalesInvoice" ADD COLUMN     "dueAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paymentMode" TEXT,
ADD COLUMN     "paymentRef" TEXT;

-- DropTable
DROP TABLE "Payment";

-- DropEnum
DROP TYPE "PaymentMode";

-- DropEnum
DROP TYPE "PaymentType";
