-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "gstRate" DECIMAL(5,2) DEFAULT 12;

-- CreateIndex
CREATE INDEX "Product_rackLocation_idx" ON "Product"("rackLocation");
