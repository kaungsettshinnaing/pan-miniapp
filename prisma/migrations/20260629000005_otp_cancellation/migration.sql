-- Add cancellation tracking and result storage to OtpSession
ALTER TABLE "OtpSession" ADD COLUMN "cancelled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OtpSession" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "OtpSession" ADD COLUMN "resultMessage" JSONB;

-- Add REDEMPTION_CANCELLED trigger for customisable cancellation message
ALTER TYPE "MessageTrigger" ADD VALUE 'REDEMPTION_CANCELLED';
