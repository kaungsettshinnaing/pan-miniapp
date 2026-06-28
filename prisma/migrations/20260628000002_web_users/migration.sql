-- CreateEnum
CREATE TYPE "WebUserRole" AS ENUM ('ADMIN', 'MERCHANT');

-- CreateTable
CREATE TABLE "WebUser" (
  "id"           TEXT NOT NULL,
  "username"     TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role"         "WebUserRole" NOT NULL,
  "merchantURL"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebUser_username_key" ON "WebUser"("username");

-- AddForeignKey
ALTER TABLE "WebUser"
  ADD CONSTRAINT "WebUser_merchantURL_fkey"
  FOREIGN KEY ("merchantURL") REFERENCES "Merchant"("merchantURL")
  ON DELETE SET NULL ON UPDATE CASCADE;
