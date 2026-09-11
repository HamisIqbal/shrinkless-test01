import { z } from 'zod';

/* 254 is the longest address SMTP will carry, so anything past it is not an
   email address by definition. Worth stating because these forms are open to
   anyone and nothing else here bounds what they can send. */
const email = z.string().trim().toLowerCase().max(254).pipe(z.email());

/* Long enough for anything a password manager generates, short enough that
   the field is not an open pipe into the hashing function. Registration and
   reset only: putting a ceiling on the *login* field would lock out any
   account that already holds a longer one. */
const NEW_PASSWORD_MAX = 200;

export const registerSchema = z.object({
  email,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(NEW_PASSWORD_MAX, 'That password is longer than we can store'),
  name: z.string().trim().max(120, 'Keep the name under 120 characters').default(''),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

/** Asking for a link needs nothing but an address — deliberately, so the form
 *  cannot be used to probe for anything else. */
export const forgotPasswordSchema = z.object({ email });

/** The same minimum the register form enforces: a reset must not be a way to
 *  end up with a weaker password than registration would have allowed. */
export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1, 'That reset link is not valid.'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(NEW_PASSWORD_MAX, 'That password is longer than we can store'),
    confirm: z.string().min(1, 'Please type the password twice'),
  })
  .refine((value) => value.password === value.confirm, {
    message: 'Those passwords do not match',
    path: ['confirm'],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
