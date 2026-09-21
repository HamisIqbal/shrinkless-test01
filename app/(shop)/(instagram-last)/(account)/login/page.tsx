import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loginAction } from '@/app/actions/auth';
import { AuthForm } from '@/components/account/AuthForm';
import { CatalogueHead } from '@/components/pages/CatalogueHead';
import { homeFonts } from '@/components/home/fonts';
import '@/components/shop/shop.css';

export const metadata = { title: 'Sign in' };

export default async function LoginPage() {
  const session = await auth();
  // An admin signs in to work, so the panel is where they belong — including
  // when they land on this page with a session already in hand.
  if (session?.user) redirect(session.user.role === 'admin' ? '/admin' : '/account');

  return (
    <>
      <CatalogueHead
        eyebrow="Account"
        title="Sign in"
        lede="Your orders, and a quicker way through checkout."
      />

      <div className={`sh-account ${homeFonts}`}>
        <div className="sh-wrap">
          <div className="sh-account__narrow">
            <AuthForm action={loginAction} submitLabel="Sign in" />

            {/* One block, two offers. Two rules would read as two unrelated
                afterthoughts. */}
            <div className="sh-swap">
              <p>
                Forgot your password?
                <Link href="/forgot-password" className="sh-link">Reset it</Link>
              </p>
              <p>
                No account?
                <Link href="/register" className="sh-link">Create one</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
