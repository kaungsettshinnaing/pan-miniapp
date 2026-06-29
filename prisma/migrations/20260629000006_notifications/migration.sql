-- Add notification send-time configuration to Merchant
ALTER TABLE "Merchant" ADD COLUMN "reminderSendTime" TEXT NOT NULL DEFAULT '09:00';
ALTER TABLE "Merchant" ADD COLUMN "winbackSendTime" TEXT NOT NULL DEFAULT '17:00';

-- Notification deduplication log
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "customerTelegramID" TEXT NOT NULL,
    "merchantURL" TEXT NOT NULL,
    "trigger" "MessageTrigger" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NotificationLog_customerTelegramID_merchantURL_trigger_sentAt_idx"
ON "NotificationLog" ("customerTelegramID", "merchantURL", "trigger", "sentAt");

ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_merchantURL_fkey"
FOREIGN KEY ("merchantURL") REFERENCES "Merchant"("merchantURL") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_customerTelegramID_fkey"
FOREIGN KEY ("customerTelegramID") REFERENCES "Customer"("customerTelegramID") ON DELETE RESTRICT ON UPDATE CASCADE;
