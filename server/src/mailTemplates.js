/**
 * Поля для писем: subject, text, html (SMTP).
 */

/** @param {string} link */
export function verifyEmailFields(link) {
  const scenario_ru = 'Подтверждение регистрации';
  const subject = 'Подтвердите регистрацию в Base56';
  const greeting = 'Здравствуйте!';
  const intro =
    'Вы начали регистрацию в Base56. Откройте ссылку ниже, чтобы подтвердить адрес электронной почты и завершить создание аккаунта.';
  const footer =
    'Ссылка действует около 72 часов. Если вы не регистрировались в Base56, просто проигнорируйте это письмо.';
  const signoff = 'Сервис Base56';
  const text = [
    greeting,
    '',
    intro,
    '',
    link,
    '',
    footer,
    '',
    `— ${signoff}`,
  ].join('\n');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#1a1a1a;max-width:560px;">
<p>${greeting}</p>
<p>${intro}</p>
<p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;text-decoration:none;border-radius:8px;">Подтвердить email</a></p>
<p style="font-size:13px;color:#666;word-break:break-all;">${link}</p>
<p>${footer}</p>
<p>— ${signoff}</p>
</body></html>`;

  return { subject, text, html, link, scenario_ru, greeting, intro, footer, signoff };
}

/** @param {string} link */
export function resetPasswordFields(link) {
  const scenario_ru = 'Сброс пароля';
  const subject = 'Сброс пароля в Base56';
  const greeting = 'Здравствуйте!';
  const intro = 'Вы запросили сброс пароля в Base56. Перейдите по ссылке, чтобы задать новый пароль:';
  const footer =
    'Ссылка действует около 48 часов. Если вы не запрашивали сброс, ничего не делайте — пароль останется прежним.';
  const signoff = 'Сервис Base56';
  const text = [greeting, '', intro, '', link, '', footer, '', `— ${signoff}`].join('\n');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#1a1a1a;max-width:560px;">
<p>${greeting}</p>
<p>${intro}</p>
<p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;text-decoration:none;border-radius:8px;">Задать новый пароль</a></p>
<p style="font-size:13px;color:#666;word-break:break-all;">${link}</p>
<p>${footer}</p>
<p>— ${signoff}</p>
</body></html>`;

  return { subject, text, html, link, scenario_ru, greeting, intro, footer, signoff };
}
