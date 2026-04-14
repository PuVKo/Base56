-- AlterTable
ALTER TABLE "User" ADD COLUMN "login" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_login_key" ON "User"("login");

UPDATE "User" SET "login" = 'admin' WHERE LOWER("email") = 'puvko5937@yandex.ru';
