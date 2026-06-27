-- CreateEnum
CREATE TYPE "EarnType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('PERCENTAGE', 'FLAT');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('TELEGRAM');

-- CreateEnum
CREATE TYPE "MessageTrigger" AS ENUM (
  'CASHBACK_ISSUED',
  'CASHBACK_ISSUED_WITH_REDEMPTION',
  'REDEMPTION_FAILURE',
  'EXPIRY_FIRST_REMINDER',
  'EXPIRY_SECOND_REMINDER',
  'FIRST_RECALL_CAMPAIGN',
  'SECOND_RECALL_CAMPAIGN'
);

-- CreateTable
CREATE TABLE "RedemptionGroup" (
  "id"          TEXT NOT NULL,
  "groupName"   TEXT NOT NULL,
  "description" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RedemptionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Merchant" (
  "merchantURL"              TEXT NOT NULL,
  "merchantName"             TEXT NOT NULL,
  "outletName"               TEXT,
  "merchantTelegramID"       TEXT NOT NULL,
  "active"                   BOOLEAN NOT NULL DEFAULT true,
  "botToken"                 TEXT,
  "earnType"                 "EarnType" NOT NULL DEFAULT 'PERCENTAGE',
  "earnValue"                DOUBLE PRECISION NOT NULL DEFAULT 10,
  "commissionType"           "CommissionType" NOT NULL DEFAULT 'PERCENTAGE',
  "commissionValue"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "subscriptionFee"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "rebateValidityDays"       INTEGER NOT NULL DEFAULT 14,
  "firstReminderDays"        INTEGER NOT NULL DEFAULT 7,
  "secondReminderDays"       INTEGER NOT NULL DEFAULT 3,
  "firstRecallCampaignDays"  INTEGER NOT NULL DEFAULT 21,
  "secondRecallCampaignDays" INTEGER NOT NULL DEFAULT 30,
  "redemptionGroupID"        TEXT,
  "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Merchant_pkey" PRIMARY KEY ("merchantURL")
);

-- CreateTable
CREATE TABLE "Customer" (
  "customerTelegramID" TEXT NOT NULL,
  "username"           TEXT,
  "firstName"          TEXT,
  "lastName"           TEXT,
  "phoneNumber"        TEXT,
  "birthday"           TIMESTAMP(3),
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("customerTelegramID")
);

-- CreateTable
CREATE TABLE "Cashback" (
  "id"                 TEXT NOT NULL,
  "merchantURL"        TEXT NOT NULL,
  "customerTelegramID" TEXT NOT NULL,
  "cashbackAmt"        DOUBLE PRECISION NOT NULL,
  "expiryDate"         TIMESTAMP(3) NOT NULL,
  "redeemed"           BOOLEAN NOT NULL DEFAULT false,
  "redemptionDate"     TIMESTAMP(3),
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Cashback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
  "id"                 TEXT NOT NULL,
  "merchantURL"        TEXT NOT NULL,
  "customerTelegramID" TEXT NOT NULL,
  "amount"             DOUBLE PRECISION NOT NULL,
  "rebateDeducted"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "commissionEarned"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "note"               TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpSession" (
  "id"                 TEXT NOT NULL,
  "customerTelegramID" TEXT NOT NULL,
  "merchantURL"        TEXT NOT NULL,
  "otpCode"            TEXT NOT NULL,
  "totalCashback"      DOUBLE PRECISION NOT NULL,
  "expiresAt"          TIMESTAMP(3) NOT NULL,
  "used"               BOOLEAN NOT NULL DEFAULT false,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OtpSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
  "id"          TEXT NOT NULL,
  "merchantURL" TEXT NOT NULL,
  "platform"    "Platform" NOT NULL DEFAULT 'TELEGRAM',
  "trigger"     "MessageTrigger" NOT NULL,
  "messageText" TEXT,
  "imageURL"    TEXT,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyBilling" (
  "id"              TEXT NOT NULL,
  "merchantURL"     TEXT NOT NULL,
  "billingMonth"    TEXT NOT NULL,
  "totalCommission" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "subscriptionFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalDue"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paid"            BOOLEAN NOT NULL DEFAULT false,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MonthlyBilling_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cashback_merchantURL_customerTelegramID_redeemed_expiryDate_idx"
  ON "Cashback"("merchantURL", "customerTelegramID", "redeemed", "expiryDate");

-- CreateIndex
CREATE INDEX "Purchase_merchantURL_customerTelegramID_createdAt_idx"
  ON "Purchase"("merchantURL", "customerTelegramID", "createdAt");

-- CreateIndex
CREATE INDEX "OtpSession_otpCode_merchantURL_used_expiresAt_idx"
  ON "OtpSession"("otpCode", "merchantURL", "used", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_merchantURL_platform_trigger_key"
  ON "MessageTemplate"("merchantURL", "platform", "trigger");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyBilling_merchantURL_billingMonth_key"
  ON "MonthlyBilling"("merchantURL", "billingMonth");

-- AddForeignKey
ALTER TABLE "Merchant"
  ADD CONSTRAINT "Merchant_redemptionGroupID_fkey"
  FOREIGN KEY ("redemptionGroupID") REFERENCES "RedemptionGroup"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cashback"
  ADD CONSTRAINT "Cashback_merchantURL_fkey"
  FOREIGN KEY ("merchantURL") REFERENCES "Merchant"("merchantURL")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cashback"
  ADD CONSTRAINT "Cashback_customerTelegramID_fkey"
  FOREIGN KEY ("customerTelegramID") REFERENCES "Customer"("customerTelegramID")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase"
  ADD CONSTRAINT "Purchase_merchantURL_fkey"
  FOREIGN KEY ("merchantURL") REFERENCES "Merchant"("merchantURL")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase"
  ADD CONSTRAINT "Purchase_customerTelegramID_fkey"
  FOREIGN KEY ("customerTelegramID") REFERENCES "Customer"("customerTelegramID")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtpSession"
  ADD CONSTRAINT "OtpSession_merchantURL_fkey"
  FOREIGN KEY ("merchantURL") REFERENCES "Merchant"("merchantURL")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtpSession"
  ADD CONSTRAINT "OtpSession_customerTelegramID_fkey"
  FOREIGN KEY ("customerTelegramID") REFERENCES "Customer"("customerTelegramID")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageTemplate"
  ADD CONSTRAINT "MessageTemplate_merchantURL_fkey"
  FOREIGN KEY ("merchantURL") REFERENCES "Merchant"("merchantURL")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyBilling"
  ADD CONSTRAINT "MonthlyBilling_merchantURL_fkey"
  FOREIGN KEY ("merchantURL") REFERENCES "Merchant"("merchantURL")
  ON DELETE RESTRICT ON UPDATE CASCADE;
