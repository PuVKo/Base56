export const isProduction = process.env.NODE_ENV === 'production';

const INTERNAL = 'Внутренняя ошибка сервера';

/**
 * Текст 5xx для клиента: в production без деталей, в dev — сообщение исключения.
 * @param {unknown} err
 */
export function clientMessageForServerError(err) {
  if (!isProduction) {
    if (err instanceof Error) return err.message || INTERNAL;
    return String(err ?? INTERNAL);
  }
  return INTERNAL;
}

/**
 * @param {import('express').Response} res
 * @param {unknown} err
 * @param {number} [status]
 */
export function sendServerError(res, err, status = 500) {
  console.error(err);
  if (!res.headersSent) {
    res.status(status).json({ error: clientMessageForServerError(err) });
  }
}
