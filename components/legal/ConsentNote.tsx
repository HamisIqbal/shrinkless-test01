import Link from 'next/link';

/**
 * The line under every form that takes personal information.
 *
 * One component, so the wording is decided once and every form says the same
 * thing about the same policies. The notice has to sit next to the button
 * that commits — a link in the footer does not make terms part of a sale, and
 * a sign-up that never mentions marketing is not consent to it (CAN-SPAM and
 * most state privacy laws read it that way).
 *
 * Any new form that collects an email, an address or a payment gets one.
 */
export type ConsentKind = 'account' | 'order' | 'marketing' | 'restock' | 'enquiry';

const terms = <Link href="/terms">Terms &amp; Conditions</Link>;
const privacy = <Link href="/privacy-policy">Privacy Policy</Link>;
const refunds = <Link href="/refund-policy">Refund Policy</Link>;

export function ConsentNote({ kind, className = '' }: { kind: ConsentKind; className?: string }) {
  return (
    <p className={`consent-note ${className}`.trim()}>
      {kind === 'account' ? (
        <>By creating an account or continuing with Google, you agree to our {terms} and confirm you have read our {privacy}.</>
      ) : kind === 'order' ? (
        <>By placing your order, you agree to our {terms} and {refunds}, and confirm you have read our {privacy}.</>
      ) : kind === 'marketing' ? (
        <>By joining, you agree to receive marketing emails from Shrinkless. Unsubscribe at any time from any email. See our {privacy}.</>
      ) : kind === 'restock' ? (
        <>We will use your email to tell you when this is back, and for nothing else. See our {privacy}.</>
      ) : (
        <>We use these details only to answer your enquiry and agree terms. See our {privacy}.</>
      )}
    </p>
  );
}
