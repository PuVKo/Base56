-- Снять ранее заданный логин с аккаунта (если был выставлен в старых миграциях)
UPDATE "User" SET "login" = NULL WHERE LOWER("email") = 'puvko5937@yandex.ru';
