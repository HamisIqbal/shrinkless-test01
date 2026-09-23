import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, googleEnabled } from '@/auth';
import { loginAction } from '@/app/actions/auth';
import { AuthForm } from '@/components/account/AuthForm';
import { GoogleButton } from '@/components/account/GoogleButton';
import { CatalogueHead } from '@/components/pages/CatalogueHead';
import { homeFonts } from '@/components/home/fonts';
import '@/components/shop/shop.css';

export const metadata = { title: 'Sign in' };

/** Auth.js sends a refused sign-in back here with `?error=`. The only one a
 *  person can cause and fix is a Google sign-in being turned down. */
function errorMessage(code: string | undefined): string | null {
  if (!code) return null;
  if (code === 'AccessDenied') {
    return 'That Google account could not be used here. Use one with a verified email, or sign in with your password.';
  }
  return 'Signing in did not work that time. Try again.';
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const session = await auth();
  // An admin signs in to work, so the panel is where they belong — including
  // when they land on this page with a session already in hand.
  if (session?.user) redirect(session.user.role === 'admin' ? '/admin' : '/account');

  const { error } = await searchParams;
  const message = errorMessage(Array.isArray(error) ? error[0] : error);

  return (
    <>
      <CatalogueHead
        centered
        eyebrow="Account"
        title="Sign in"
        lede="Your orders, and a quicker way through checkout."
      />

      <div className={`sh-account ${homeFonts}`}>
        <div className="sh-wrap">
          <div className="sh-account__narrow">
            {message ? <p role="alert" className="sh-notice sh-notice--error">{message}</p> : null}
            {googleEnabled ? <GoogleButton label="Sign in with Google" /> : null}
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
