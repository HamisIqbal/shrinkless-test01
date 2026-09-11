import { sendMail, mailFrom } from '@/lib/email/send';
import { adminCodeMail, adminCodeRecipient } from '@/lib/email/admin-code';
import { generateCode, CODE_TTL_MS } from '@/lib/services/two-factor';

/**
 * Proves the mail pipe without going near the database or a real sign-in.
 *
 * Sends the exact mail an admin sign-in sends — same sender, same template —
 * so a success here means the only untested thing left is the login form.
 * The code it carries is decorative: nothing is stored, so nothing will let
 * anyone in.
 *
 *   npm run email:test -- someone@example.com
 *
 * With no argument it goes wherever ADMIN_2FA_EMAIL points.
 */
async function main() {
  const [to] = process.argv.slice(2);
  const recipient = to || adminCodeRecipient('');

  if (!recipient) {
    console.error('No recipient. Pass one, or set ADMIN_2FA_EMAIL.');
    process.exit(1);
  }

  console.log(`from: ${mailFrom()}`);
  console.log(`to:   ${recipient}`);

  await sendMail(adminCodeMail(recipient, generateCode(), CODE_TTL_MS / 60_000));

  console.log('sent — check the inbox, and the spam folder.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
