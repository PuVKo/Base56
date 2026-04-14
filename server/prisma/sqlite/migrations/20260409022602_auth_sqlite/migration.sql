-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AuthToken_userId_type_idx" ON "AuthToken"("userId", "type");

-- Bootstrap user for existing data (password: ChangeMeNow123!)
INSERT INTO "User" ("id", "email", "passwordHash", "emailVerifiedAt", "createdAt", "updatedAt")
SELECT 'legacy_migrated_user', 'migrated-owner@base56.local', '$2b$10$mr6J9DnHuDWna2VP78Z64OTzx6iLsHtpLhc4su/ngH3yr74G7H0zG', datetime('now'), datetime('now'), datetime('now')
WHERE EXISTS (SELECT 1 FROM "Booking" LIMIT 1) OR EXISTS (SELECT 1 FROM "FieldDefinition" LIMIT 1);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Booking" ("id", "userId", "data", "createdAt", "updatedAt")
SELECT
    "id",
    (SELECT "id" FROM "User" WHERE "id" = 'legacy_migrated_user' LIMIT 1),
    "data",
    "createdAt",
    "updatedAt"
FROM "Booking";
DROP TABLE "Booking";
ALTER TABLE "new_Booking" RENAME TO "Booking";
CREATE INDEX "Booking_userId_idx" ON "Booking"("userId");
CREATE TABLE "new_FieldDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "iconKey" TEXT,
    "options" JSONB,
    CONSTRAINT "FieldDefinition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FieldDefinition" ("id", "userId", "key", "label", "type", "sortOrder", "system", "visible", "iconKey", "options")
SELECT
    "id",
    (SELECT "id" FROM "User" WHERE "id" = 'legacy_migrated_user' LIMIT 1),
    "key",
    "label",
    "type",
    "sortOrder",
    "system",
    "visible",
    "iconKey",
    "options"
FROM "FieldDefinition";
DROP TABLE "FieldDefinition";
ALTER TABLE "new_FieldDefinition" RENAME TO "FieldDefinition";
CREATE INDEX "FieldDefinition_userId_idx" ON "FieldDefinition"("userId");
CREATE UNIQUE INDEX "FieldDefinition_userId_key_key" ON "FieldDefinition"("userId", "key");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
