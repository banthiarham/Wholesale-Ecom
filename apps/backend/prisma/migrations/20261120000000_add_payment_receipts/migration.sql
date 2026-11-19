CREATE TABLE "PaymentReceipt" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "proofUrl" TEXT,
    "proofName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'VERIFIED',
    "submittedBy" TEXT,
    "submittedVia" TEXT NOT NULL DEFAULT 'ADMIN',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentReceipt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentReceipt_paymentId_idx" ON "PaymentReceipt"("paymentId");
CREATE INDEX "PaymentReceipt_status_idx" ON "PaymentReceipt"("status");

ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
