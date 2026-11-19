ALTER TABLE "Order" ADD COLUMN "invoiceNumber" TEXT;

CREATE UNIQUE INDEX "Order_invoiceNumber_key" ON "Order"("invoiceNumber");
