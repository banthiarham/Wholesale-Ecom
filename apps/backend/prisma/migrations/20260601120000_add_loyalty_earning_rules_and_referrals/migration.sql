-- AlterEnum: Add loyalty rule types to DynamicRuleType
ALTER TYPE "DynamicRuleType" ADD VALUE IF NOT EXISTS 'LOYALTY_ORDER_EARN';
ALTER TYPE "DynamicRuleType" ADD VALUE IF NOT EXISTS 'LOYALTY_CATEGORY_BONUS';
ALTER TYPE "DynamicRuleType" ADD VALUE IF NOT EXISTS 'LOYALTY_FIRST_ORDER_BONUS';
ALTER TYPE "DynamicRuleType" ADD VALUE IF NOT EXISTS 'LOYALTY_REVIEW_BONUS';
ALTER TYPE "DynamicRuleType" ADD VALUE IF NOT EXISTS 'LOYALTY_REFERRAL_BONUS';

-- AlterTable: Add ruleId to LoyaltyTransaction
ALTER TABLE "LoyaltyTransaction" ADD COLUMN IF NOT EXISTS "ruleId" TEXT;

-- AlterTable: Add referral fields to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredBy" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode");
CREATE INDEX IF NOT EXISTS "LoyaltyTransaction_ruleId_idx" ON "LoyaltyTransaction"("ruleId");

-- AddForeignKey
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "DynamicRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;