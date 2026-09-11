import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { registerAction } from '@/app/actions/auth';
import { AuthForm } from '@/components/account/AuthForm';

export const metadata = { title: 'Create an account' };

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) redirect('/account');

  return (
    <div className="pagehead">
      <p className="eyebrow">Account</p>
      <h1 className="head">Create an account</h1>

      <AuthForm action={registerAction} submitLabel="Create account" includeName />

      <p className="authswap">
        Already have an account? <Link href="/login" className="ulink">Sign in</Link>
      </p>
    </div>
  );
}
