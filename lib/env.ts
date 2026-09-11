import { z } from 'zod';

const serverSchema = z.object({
  MONGODB_URI: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  /* Mail, for the admin sign-in code. Optional so local development runs
     without a provider — an admin sign-in is what actually needs it, and it
     fails loudly and specifically when the key is missing. */
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  /* Where admin sign-in codes go. Unset means the admin account's own
     address. */
  ADMIN_2FA_EMAIL: z.string().optional(),
  /* The public origin, for links that travel in email. Optional: Vercel's own
     variables cover a deployment, and local development has a sane default. */
  NEXT_PUBLIC_SITE_URL: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

export function loadServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const parsed = serverSchema.safeParse(source);

  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid or missing environment variables: ${names}`);
  }

  return parsed.data;
}
