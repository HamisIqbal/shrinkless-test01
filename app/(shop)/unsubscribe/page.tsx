import { CatalogueHead } from '@/components/pages/CatalogueHead';
import { UnsubscribeForm } from '@/components/account/UnsubscribeForm';
import { homeFonts } from '@/components/home/fonts';
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe';
import { getStoreSettings } from '@/lib/services/settings';
import '@/components/shop/shop.css';

export const metadata = { title: 'Unsubscribe', robots: { index: false } };

/**
 * Where the link at the foot of every marketing email lands.
 *
 * Asks before acting: link scanners in mail clients open every URL in a
 * message, and a page that unsubscribed on GET would unsubscribe people who
 * never clicked.
 */
export default async function UnsubscribePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await props.searchParams;
  const email = typeof search?.e === 'string' ? search.e : '';
  const token = typeof search?.t === 'string' ? search.t : '';
  const valid = verifyUnsubscribeToken(email, token);
  const settings = valid ? null : await getStoreSettings();

  return (
    <>
      <CatalogueHead centered eyebrow="Email" title="Unsubscribe" />

      <div className={`sh-account ${homeFonts}`}>
        <div className="sh-wrap">
          <div className="sh-account__narrow">
            {valid ? (
              <UnsubscribeForm email={email} token={token} />
            ) : (
              <p className="sh-notice">
                This unsubscribe link is incomplete. Email{' '}
                <a href={`mailto:${settings?.storeEmail}`} className="sh-link">
                  {settings?.storeEmail}
                </a>{' '}
                and we will take you off the list.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
