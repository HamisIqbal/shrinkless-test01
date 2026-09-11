import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { loginSchema } from '@/lib/validation/auth';
import { verifyCredentials } from '@/lib/services/users';
import {
  adminLockState,
  clearAdminCodeFailures,
  consumeAdminChallenge,
  recordAdminCodeFailure,
} from '@/lib/services/two-factor';

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        /* Second factor. Only an admin is ever asked for one, and only the
           sign-in's second pass carries it. */
        code: { label: 'Code', type: 'text' },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await verifyCredentials(parsed.data.email, parsed.data.password);
        if (!user) return null;

        // The password alone is never enough for an admin. This is the check
        // that enforces it: a Server Action calling signIn() directly, a
        // replayed POST, or any other path all land here.
        if (user.role === 'admin') {
          // A closed lock is checked before the code is even looked at, so a
          // locked-out attacker cannot keep guessing and cannot learn from the
          // timing whether a guess was close.
          const lock = await adminLockState(user.id);
          if (lock.locked) return null;

          const supplied = (raw as { code?: unknown }).code;
          const code = typeof supplied === 'string' ? supplied : '';

          const passed = await consumeAdminChallenge(user.id, code);

          if (!passed) {
            await recordAdminCodeFailure(user.id);
            return null;
          }

          await clearAdminCodeFailures(user.id);
        }

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      // `user` is only present on the sign-in pass.
      if (user) {
        token.id = user.id;
        token.role = user.role ?? 'customer';
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? '';
        session.user.role = token.role ?? 'customer';
      }
      return session;
    },
  },
});
