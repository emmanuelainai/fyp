-- Remove the abandoned sign-in verification-code schema. Email codes now apply only to
-- account creation and password reset through AuthCode.
DROP TABLE IF EXISTS "TwoFactorCode";
DROP TYPE IF EXISTS "TwoFactorPurpose";
ALTER TABLE "User" DROP COLUMN IF EXISTS "twoFactorEnabled";
