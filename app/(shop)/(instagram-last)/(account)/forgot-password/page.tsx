import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { ForgotPasswordForm } from '@/components/account/ForgotPasswordForm';
import { CatalogueHead } from '@/components/pages/CatalogueHead';
import { homeFonts } from '@/components/home/fonts';
import '@/components/shop/shop.css';

export const metadata = { title: 'Reset your password' };

export default async function ForgotPasswordPage() {
  const session = await auth();
  if (session?.user) redirect('/account');

  return (
    <>
      <CatalogueHead
        centered
        eyebrow="Account"
        title="Forgot your password"
        lede="Give us the email on your account and we will send a link that lets you set a new password."
      />

      <div className={`sh-account ${homeFonts}`}>
        <div className="sh-wrap">
          <div className="sh-account__narrow">
            <ForgotPasswordForm />

            <p className="sh-swap">
              <span>
                Remembered it?
                <Link href="/login" className="sh-link">Sign in</Link>
              </span>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
