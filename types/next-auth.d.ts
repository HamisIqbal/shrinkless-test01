import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'customer' | 'admin';
    } & DefaultSession['user'];
  }

  interface User {
    role?: 'customer' | 'admin';
  }
}

// `next-auth/jwt` is only `export * from "@auth/core/jwt"`, so augmenting it
// declares a new module instead of extending the real JWT interface.
declare module '@auth/core/jwt' {
  interface JWT {
    id?: string;
    role?: 'customer' | 'admin';
  }
}
