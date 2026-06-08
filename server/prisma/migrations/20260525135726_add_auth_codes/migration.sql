-- CreateEnum
CREATE TYPE "AuthCodePurpose" AS ENUM ('ACCOUNT_CREATION', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "AuthCode" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" "AuthCodePurpose" NOT NULL,
    "payload" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthCode_email_idx" ON "AuthCode"("email");

-- CreateIndex
CREATE INDEX "AuthCode_purpose_idx" ON "AuthCode"("purpose");

-- CreateIndex
CREATE INDEX "AuthCode_expiresAt_idx" ON "AuthCode"("expiresAt");
