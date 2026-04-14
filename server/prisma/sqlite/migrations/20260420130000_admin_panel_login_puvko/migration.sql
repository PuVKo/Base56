-- После clear_preset_login: логин для доступа к админ-панели (совпадает с ADMIN_PANEL_LOGIN по умолчанию)
UPDATE "User" SET "login" = 'puvko' WHERE LOWER("email") = 'puvko5937@yandex.ru';
