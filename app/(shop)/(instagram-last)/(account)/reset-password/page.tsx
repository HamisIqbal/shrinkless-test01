import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { ResetPasswordForm } from '@/components/account/ResetPasswordForm';
import { checkResetToken } from '@/lib/services/password-reset';
import { CatalogueHead } from '@/components/pages/CatalogueHead';
import { homeFonts } from '@/components/home/fonts';
import '@/components/shop/shop.css';

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
      <>
        <CatalogueHead
          eyebrow="Account"
          title="That link is no longer good"
          lede={REASONS[check.reason]}
        />

        <div className={`sh-account ${homeFonts}`}>
          <div className="sh-wrap">
            <div className="sh-account__narrow">
              <Link href="/forgot-password" className="sh-btn">Ask for a new link</Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <CatalogueHead
        eyebrow="Account"
        title="Set a new password"
        lede={`For ${check.email}. Choosing one signs you straight in.`}
      />

      <div className={`sh-account ${homeFonts}`}>
        <div className="sh-wrap">
          <div className="sh-account__narrow">
            <ResetPasswordForm token={supplied} />
          </div>
        </div>
      </div>
    </>
  );
}
