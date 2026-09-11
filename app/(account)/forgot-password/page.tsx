import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { ForgotPasswordForm } from '@/components/account/ForgotPasswordForm';

export const metadata = { title: 'Reset your password' };

export default async function ForgotPasswordPage() {
  const session = await auth();
  if (session?.user) redirect('/account');

  return (
    <div className="pagehead">
      <p className="eyebrow">Account</p>
      <h1 className="head">Forgot your password</h1>

      <p className="lede authform__step">
        Give us the email on your account and we will send a link that lets you
        set a new password.
      </p>

      <ForgotPasswordForm />

      <p className="authswap">
        Remembered it? <Link href="/login" className="ulink">Sign in</Link>
      </p>
    </div>
  );
}
