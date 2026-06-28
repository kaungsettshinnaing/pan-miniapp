-- Add CHANNEL_PARTNER to WebUserRole enum
ALTER TYPE "WebUserRole" ADD VALUE 'CHANNEL_PARTNER';

-- Add new columns to WebUser
ALTER TABLE "WebUser"
  ADD COLUMN "redemptionGroupID" TEXT,
  ADD COLUMN "profitSharePct"    DOUBLE PRECISION;

-- Add channelPartnerID to Merchant
ALTER TABLE "Merchant"
  ADD COLUMN "channelPartnerID" TEXT;

-- Foreign keys
ALTER TABLE "WebUser"
  ADD CONSTRAINT "WebUser_redemptionGroupID_fkey"
  FOREIGN KEY ("redemptionGroupID") REFERENCES "RedemptionGroup"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Merchant"
  ADD CONSTRAINT "Merchant_channelPartnerID_fkey"
  FOREIGN KEY ("channelPartnerID") REFERENCES "WebUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Rename existing WebUser→Merchant FK so Prisma sees two distinct relations
-- (The existing constraint was created as WebUser_merchantURL_fkey; no rename needed —
--  Prisma uses @relation names at the ORM level only, not constraint names.)
