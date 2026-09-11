import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { ResetPasswordForm } from '@/components/account/ResetPasswordForm';
import { checkResetToken } from '@/lib/services/password-reset';

export const metadata = { title: 'Set a new password' };

/** What each way of failing should say. A dead link deserves a reason, not a
 *  blank form that rejects everything typed into it. */
const REASONS: Record<string, string> = {
  used: 'That link has already been used. Passwords can only be set once per link.',
  expired: 'That link has expired. They last an hour, which is short on purpose.',
  unknown: 'That link is not valid. It may have been replaced by a newer one.',
};

export default async function ResetPasswordPage(props: PageProps<'/reset-password'>) {
  const session = await auth();
  if (session?.user) redirect('/account');

  const { token } = await props.searchParams;
  const supplied = typeof token === 'string' ? token : '';

  // Checked here rather than on submit so a dead link says so immediately,
  // instead of after someone has chosen and typed a password twice.
  const check = supplied
    ? await checkResetToken(supplied)
    : ({ valid: false, reason: 'unknown' } as const);

  if (!check.valid) {
    return (
      <div className="pagehead">
        <p className="eyebrow">Account</p>
        <h1 className="head">That link is no longer good</h1>

        <p className="lede authform__step">{REASONS[check.reason]}</p>

        <p className="authswap">
          <Link href="/forgot-password" className="ulink">Ask for a new link</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="pagehead">
      <p className="eyebrow">Account</p>
      <h1 className="head">Set a new password</h1>

      <p className="lede authform__step">
        For <strong>{check.email}</strong>. Choosing one signs you straight in.
      </p>

      <ResetPasswordForm token={supplied} />
    </div>
  );
}
