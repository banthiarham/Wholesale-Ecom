CREATE TYPE "RmaTicketStatus" AS ENUM ('OPEN', 'PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED');
CREATE TYPE "RmaTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

CREATE TABLE "RmaTicket" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "priority" "RmaTicketPriority" NOT NULL DEFAULT 'NORMAL',
    "assignedToId" TEXT,
    "status" "RmaTicketStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "resolutionTimeMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RmaTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RmaTicketActivity" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "fromStatus" "RmaTicketStatus",
    "toStatus" "RmaTicketStatus" NOT NULL,
    "note" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RmaTicketActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RmaTicket_ticketNumber_key" ON "RmaTicket"("ticketNumber");
CREATE UNIQUE INDEX "RmaTicket_returnRequestId_key" ON "RmaTicket"("returnRequestId");
CREATE INDEX "RmaTicket_customerId_idx" ON "RmaTicket"("customerId");
CREATE INDEX "RmaTicket_orderId_idx" ON "RmaTicket"("orderId");
CREATE INDEX "RmaTicket_assignedToId_idx" ON "RmaTicket"("assignedToId");
CREATE INDEX "RmaTicket_status_idx" ON "RmaTicket"("status");
CREATE INDEX "RmaTicket_priority_idx" ON "RmaTicket"("priority");
CREATE INDEX "RmaTicket_openedAt_idx" ON "RmaTicket"("openedAt");
CREATE INDEX "RmaTicketActivity_ticketId_idx" ON "RmaTicketActivity"("ticketId");
CREATE INDEX "RmaTicketActivity_changedById_idx" ON "RmaTicketActivity"("changedById");
CREATE INDEX "RmaTicketActivity_createdAt_idx" ON "RmaTicketActivity"("createdAt");

ALTER TABLE "RmaTicket" ADD CONSTRAINT "RmaTicket_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RmaTicket" ADD CONSTRAINT "RmaTicket_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RmaTicket" ADD CONSTRAINT "RmaTicket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RmaTicket" ADD CONSTRAINT "RmaTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RmaTicketActivity" ADD CONSTRAINT "RmaTicketActivity_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "RmaTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RmaTicketActivity" ADD CONSTRAINT "RmaTicketActivity_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "RmaTicket" (
    "id", "ticketNumber", "returnRequestId", "customerId", "orderId", "priority",
    "status", "openedAt", "closedAt", "resolutionTimeMinutes", "createdAt", "updatedAt"
)
SELECT
    'rma-' || rr."id",
    'RMA-' || TO_CHAR(rr."createdAt", 'YYYYMMDD') || '-' || UPPER(SUBSTRING(rr."id" FROM 1 FOR 8)),
    rr."id",
    rr."userId",
    rr."orderId",
    'NORMAL'::"RmaTicketPriority",
    CASE rr."status"::text
        WHEN 'COMPLETED' THEN 'CLOSED'::"RmaTicketStatus"
        WHEN 'REJECTED' THEN 'CANCELLED'::"RmaTicketStatus"
        WHEN 'APPROVED' THEN 'IN_PROGRESS'::"RmaTicketStatus"
        WHEN 'PROCESSING' THEN 'IN_PROGRESS'::"RmaTicketStatus"
        ELSE 'OPEN'::"RmaTicketStatus"
    END,
    rr."createdAt",
    CASE WHEN rr."status"::text = 'COMPLETED' THEN rr."updatedAt" ELSE NULL END,
    CASE WHEN rr."status"::text = 'COMPLETED' THEN FLOOR(EXTRACT(EPOCH FROM (rr."updatedAt" - rr."createdAt")) / 60)::INTEGER ELSE NULL END,
    rr."createdAt",
    rr."updatedAt"
FROM "ReturnRequest" rr;

INSERT INTO "RmaTicketActivity" ("id", "ticketId", "fromStatus", "toStatus", "note", "createdAt")
SELECT
    'rma-activity-' || rr."id",
    'rma-' || rr."id",
    NULL,
    rt."status",
    'Ticket created from existing return/replacement request',
    rt."openedAt"
FROM "ReturnRequest" rr
JOIN "RmaTicket" rt ON rt."returnRequestId" = rr."id";
