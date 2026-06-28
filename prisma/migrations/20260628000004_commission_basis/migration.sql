-- Migration: 20260628000004_commission_basis
-- Adds CommissionBasis enum and commissionBasis to Merchant,
-- adds originalPurchaseAmount to Cashback

CREATE TYPE "CommissionBasis" AS ENUM ('RETURN_TRANSACTION', 'INITIAL_TRANSACTION');

ALTER TABLE "Merchant"
  ADD COLUMN "commissionBasis" "CommissionBasis" NOT NULL DEFAULT 'RETURN_TRANSACTION';

ALTER TABLE "Cashback"
  ADD COLUMN "originalPurchaseAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
