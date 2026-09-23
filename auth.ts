import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { loginSchema } from '@/lib/validation/auth';
import {
  findOrCreateGoogleUser,
  getUserByEmail,
  verifyCredentials,
} from '@/lib/services/users';

/** Google is offered only once its keys are set, so the site runs without
 *  them and the button never leads to a dead end. Auth.js reads the two
 *  variables itself. */
export const googleEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  // A refused sign-in comes back to the form, which says why, rather than to
  // Auth.js's own error page.
  pages: { signIn: '/login', error: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await verifyCredentials(parsed.data.email, parsed.data.password);
        if (!user) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
    ...(googleEnabled ? [Google] : []),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== 'google') return true;

      // An unverified address proves nothing about who owns it, and matching
      // accounts by address is only safe when it does.
      if (!profile?.email || profile.email_verified !== true) return false;

      // The back office stays behind its password: a Google account is not a
      // second way into it.
      const existing = await getUserByEmail(profile.email);
      if (existing?.role === 'admin') return false;

      return true;
    },
    async jwt({ token, user, account, profile }) {
      // Google's `user` carries Google's id, so the session is minted from
      // this store's own account instead.
      if (account?.provider === 'google' && profile?.email) {
        const own = await findOrCreateGoogleUser(profile.email, profile.name ?? '');
        token.id = own.id;
        token.role = own.role;
        token.name = own.name || token.name;
        return token;
      }

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
