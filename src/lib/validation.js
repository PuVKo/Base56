import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email('Некорректный email').max(200);

export const loginSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{2,32}$/, 'Логин: 2–32 символа (латиница, цифры, _)');

export const passwordSchema = z.string().min(8, 'Пароль не короче 8 символов').max(200);

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    login: loginSchema.optional().or(z.literal('')),
  })
  .strict();

export const loginFormSchema = z
  .object({
    identifier: z.string().trim().min(1, 'Введите почту или логин').max(200),
    password: passwordSchema,
  })
  .strict();

export const forgotPasswordSchema = z.object({ email: emailSchema }).strict();

export const resetPasswordSchema = z.object({ token: z.string().trim().min(1), password: passwordSchema }).strict();

