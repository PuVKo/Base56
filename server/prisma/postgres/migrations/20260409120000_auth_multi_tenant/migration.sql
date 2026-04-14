-- CreateEnum
CREATE TYPE "AuthTokenType" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AuthTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuthToken_userId_type_idx" ON "AuthToken"("userId", "type");

-- express-session (connect-pg-simple)
CREATE TABLE "session" (
    "sid" varchar NOT NULL COLLATE "default",
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL
);

ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX "IDX_session_expire" ON "session" ("expire");

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "userId" TEXT;
ALTER TABLE "FieldDefinition" ADD COLUMN "userId" TEXT;

-- Bootstrap user for existing single-tenant data (password: ChangeMeNow123!)
INSERT INTO "User" ("id", "email", "passwordHash", "emailVerifiedAt", "createdAt", "updatedAt")
SELECT 'legacy_migrated_user', 'migrated-owner@base56.local', '$2b$10$mr6J9DnHuDWna2VP78Z64OTzx6iLsHtpLhc4su/ngH3yr74G7H0zG', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "Booking" LIMIT 1)
   OR EXISTS (SELECT 1 FROM "FieldDefinition" LIMIT 1);

UPDATE "Booking" SET "userId" = 'legacy_migrated_user' WHERE "userId" IS NULL AND EXISTS (SELECT 1 FROM "User" WHERE "id" = 'legacy_migrated_user');

UPDATE "FieldDefinition" SET "userId" = 'legacy_migrated_user' WHERE "userId" IS NULL AND EXISTS (SELECT 1 FROM "User" WHERE "id" = 'legacy_migrated_user');

DROP INDEX IF EXISTS "FieldDefinition_key_key";

ALTER TABLE "Booking" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "FieldDefinition" ALTER COLUMN "userId" SET NOT NULL;

CREATE UNIQUE INDEX "FieldDefinition_userId_key_key" ON "FieldDefinition"("userId", "key");

ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FieldDefinition" ADD CONSTRAINT "FieldDefinition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
