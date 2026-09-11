import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loginAction } from '@/app/actions/auth';
import { AuthForm } from '@/components/account/AuthForm';

export const metadata = { title: 'Sign in' };

export default async function LoginPage() {
  const session = await auth();
  // An admin signs in to work, so the panel is where they belong — including
  // when they land on this page with a session already in hand.
  if (session?.user) redirect(session.user.role === 'admin' ? '/admin' : '/account');

  return (
    <div className="pagehead">
      <p className="eyebrow">Account</p>
      <h1 className="head">Sign in</h1>

      <AuthForm action={loginAction} submitLabel="Sign in" />

      {/* One block, two offers. Two `.authswap` paragraphs would draw the
          rule twice and read as two unrelated afterthoughts. */}
      <div className="authswap">
        <p>Forgot your password? <Link href="/forgot-password" className="ulink">Reset it</Link></p>
        <p>No account? <Link href="/register" className="ulink">Create one</Link></p>
      </div>
    </div>
  );
}
