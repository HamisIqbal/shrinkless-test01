import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, googleEnabled } from '@/auth';
import { registerAction } from '@/app/actions/auth';
import { AuthForm } from '@/components/account/AuthForm';
import { GoogleButton } from '@/components/account/GoogleButton';
import { CatalogueHead } from '@/components/pages/CatalogueHead';
import { homeFonts } from '@/components/home/fonts';
import '@/components/shop/shop.css';

export const metadata = { title: 'Create an account' };

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) redirect('/account');

  return (
    <>
      <CatalogueHead
        centered
        eyebrow="Account"
        title="Create an account"
        lede="Keep your orders in one place, and check out without typing your details twice."
      />

      <div className={`sh-account ${homeFonts}`}>
        <div className="sh-wrap">
          <div className="sh-account__narrow">
            <AuthForm action={registerAction} submitLabel="Create account" includeName />
            {googleEnabled ? <GoogleButton label="Sign up with Google" /> : null}

            <p className="sh-swap">
              <span>
                Already have an account?
                <Link href="/login" className="sh-link">Sign in</Link>
              </span>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
