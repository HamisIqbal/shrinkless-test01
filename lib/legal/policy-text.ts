import { DISPATCH_BUSINESS_DAYS, RETURN_WINDOW_DAYS, type LegalPageId } from '@/lib/legal/pages';

/**
 * The shipped wording of every legal page.
 *
 * Kept apart from the rest of the site's copy so the whole of it can be handed
 * to a lawyer as one file. Each page is still editable clause by clause on the
 * admin Content tab; what is here is what a fresh database serves and what
 * "restore original" goes back to.
 *
 * Tokens in double braces are filled from admin → Settings → Business details
 * when the page renders (see lib/legal/tokens.ts):
 *
 *   {{legalName}}  the business's legal name, or "Shrinkless" until it is set
 *   {{email}}      the store email
 *   {{address}}    the mailing address
 *   {{phone}}      the phone number
 *   {{state}}      the governing-law state
 *
 * A paragraph that uses a token whose value is blank is left out entirely,
 * so an unfinished setting never prints a gap or a placeholder.
 *
 * Rules for editing, here or on the Content tab:
 * - Never write "[TBC]" or any placeholder. tests/unit/legal enforces it here;
 *   the storefront falls back to this wording if one is saved in the admin.
 * - Every number here (return window, dispatch time) is a promise the FTC can
 *   hold the business to. Change the constant in lib/legal/pages.ts, not the
 *   sentence, so every page that states it changes together.
 * - After changing the wording, move POLICIES_EFFECTIVE in lib/legal/pages.ts.
 */

export type PolicyClause = { heading: string; body: string };

export type PolicyText = {
  title: string;
  lede: string;
  clauses: PolicyClause[];
};

const P = (...paragraphs: string[]) => paragraphs.join('\n\n');

export const POLICY_TEXT: Record<LegalPageId, PolicyText> = {
  terms: {
    title: 'Terms & Conditions',
    lede:
      'These terms apply to your use of this website and to every order placed on it. By using the site or placing an order you agree to them, so please read them before you buy.',
    clauses: [
      {
        heading: 'Who we are',
        body: P(
          'This website is run by {{legalName}} ("Shrinkless", "we", "us" or "our"). You can reach us at {{email}}.',
          'Our mailing address is {{address}}.',
          'We may update these terms from time to time. The version on this page when you place an order is the one that applies to that order.',
        ),
      },
      {
        heading: 'Using the site & your account',
        body: P(
          'You must be at least 18, or have the permission of a parent or guardian, to place an order. You agree to give us accurate information and to keep it up to date.',
          'If you create an account, keep your password private: you are responsible for what happens under your account. Tell us straight away if you think someone else has used it. We may suspend or close an account that is used for fraud or in breach of these terms.',
          'You may not use the site for anything unlawful, try to gain access to parts of it you are not meant to reach, interfere with how it works, or copy it with automated tools.',
        ),
      },
      {
        heading: 'Orders, payments & pricing',
        body: P(
          'Every order is an offer to buy, and is subject to availability and to our acceptance. We accept your order when we take payment for it. Prices are in US dollars. Any sales tax that applies is shown at checkout before you pay.',
          'We try hard to describe and price every product accurately, but mistakes happen. If a product is listed at the wrong price or is no longer available, we may cancel the order and refund you in full, even after you have paid. We may also cancel an order we reasonably suspect is fraudulent, and may limit the quantity you can buy.',
          'Payment is taken at checkout by our payment processor, Stripe. We never see or store your full card number.',
        ),
      },
      {
        heading: 'Shipping, returns & refunds',
        body: P(
          `We ship to addresses in the United States. Orders leave us within ${DISPATCH_BUSINESS_DAYS} business days; delivery estimates are the carrier's, and are shown at checkout.`,
          `Unworn, unwashed items in their original condition can be returned within ${RETURN_WINDOW_DAYS} days of delivery. Our Shipping & Returns page and our Refund Policy form part of these terms and explain how both work.`,
        ),
      },
      {
        heading: 'Products & care',
        body: P(
          'Our tees are pre-shrunk and garment dyed, and are made to keep their fit when they are washed and dried as the care label directs. Garment dyeing means every piece varies slightly in shade, and colours on screen can differ from the real thing; that variation is not a fault.',
          'We are not responsible for damage caused by washing or treating a garment against its care label, or for ordinary wear and tear.',
        ),
      },
      {
        heading: 'Wholesale orders',
        body:
          'Wholesale orders are made to order, from 150 units, on terms we agree with you in writing. Where a written wholesale agreement and these terms differ, the written agreement applies.',
      },
      {
        heading: 'Our content',
        body:
          'The words, photographs, films, logos and design of this site belong to us or to the people who licensed them to us, and are protected by copyright and trademark law. You may view and share pages for your own personal, non-commercial use, but you may not copy, sell or reuse them without our written permission.',
      },
      {
        heading: 'Warranties & liability',
        body: P(
          'We sell our products with the rights the law of your state gives you, and nothing in these terms takes those rights away. Apart from them, the website is provided "as is", and to the fullest extent the law allows we make no other promises about it — including that it will always be available or free of errors.',
          'To the fullest extent the law allows, we are not liable for any indirect, incidental, special or consequential loss, or for lost profits, arising from your use of the site or your purchase. Our total liability for any claim about an order is limited to the amount you paid for that order. Some states do not allow these limits, so they may not all apply to you.',
          'You agree to cover any loss we suffer because you used the site in breach of these terms or the law.',
        ),
      },
      {
        heading: 'Disagreements & the law that applies',
        body: P(
          'If something goes wrong, please email us first — most problems are solved quickly that way. If we cannot resolve a dispute within 30 days, either of us may take it further, and either of us may bring a claim in small claims court where it qualifies.',
          'These terms are governed by the laws of the State of {{state}} and the United States, without regard to conflict-of-law rules. Nothing in them removes a protection that the consumer law of the state you live in gives you.',
          'If any part of these terms is found to be unenforceable, the rest still applies. If we do not enforce a term straight away, we have not given up the right to enforce it later.',
        ),
      },
      {
        heading: 'Contact & California notice',
        body: P(
          'Questions about these terms: email {{email}}.',
          'Or call {{phone}}.',
          'California residents: under California Civil Code §1789.3 you may contact the Complaint Assistance Unit of the Division of Consumer Services of the California Department of Consumer Affairs in writing at 1625 North Market Blvd., Suite N 112, Sacramento, CA 95834, or by telephone at (916) 445-1254 or (800) 952-5210.',
        ),
      },
    ],
  },

  refunds: {
    title: 'Refund Policy',
    lede:
      'If something is not right, we want to put it right. This page explains how returns, exchanges and refunds work.',
    clauses: [
      {
        heading: `${RETURN_WINDOW_DAYS}-day returns`,
        body: P(
          `You can return any retail item within ${RETURN_WINDOW_DAYS} days of the day it was delivered, as long as it is unworn, unwashed and in its original condition with its tags attached.`,
          'To start a return, email us with your order number and the items you want to send back. We will reply with the return address and anything else you need. Please do not send anything back before you hear from us, so we can match your parcel to your order.',
        ),
      },
      {
        heading: 'Return shipping',
        body: P(
          'Return shipping is paid by you, and we recommend a tracked service: we cannot refund a return that does not reach us. Your original shipping charge is not refunded.',
          'If an item arrived damaged, faulty or different from what you ordered, the return is on us — we cover return shipping and refund your original shipping charge too.',
        ),
      },
      {
        heading: 'Refunds',
        body:
          'Once your return reaches us and has been checked, we refund the item price to your original payment method within 5 business days and email you to say so. Your bank or card issuer may take a further 5–10 business days to show it.',
      },
      {
        heading: 'Exchanges',
        body:
          'Need a different size or colour? Email us and, while stock lasts, we will hold the replacement and send it once your return arrives. If what you want is sold out, we refund you instead.',
      },
      {
        heading: 'Damaged, faulty or wrong items',
        body:
          `If an order arrives damaged, faulty or not what you ordered, email us within ${RETURN_WINDOW_DAYS} days of delivery with your order number and a photo. We will send a replacement or a full refund, whichever you prefer.`,
      },
      {
        heading: 'What cannot be returned',
        body: P(
          'Items that have been worn, washed, altered or damaged after delivery cannot be returned. Made-to-order and wholesale orders are made to your specification and are not returnable, unless they arrive faulty or not as agreed.',
          'None of this limits any right to a refund or repair that the law of your state gives you.',
        ),
      },
      {
        heading: 'Getting help',
        body:
          'If you have a question about a return, a refund or an exchange, email us at {{email}} and we will take you through it.',
      },
    ],
  },

  shipping: {
    title: 'Shipping & Returns',
    lede: 'How your order reaches you, and how to send something back.',
    clauses: [
      {
        heading: 'Where we ship',
        body:
          'We currently ship to addresses in the United States only. The checkout will not accept an address outside the US.',
      },
      {
        heading: 'When your order leaves us',
        body:
          `Orders leave us within ${DISPATCH_BUSINESS_DAYS} business days of payment. Business days are Monday to Friday, excluding US federal holidays. We email you a confirmation when you order and again when your order ships, with tracking where the carrier provides it.`,
      },
      {
        heading: 'Costs & delivery times',
        body:
          'The shipping cost and the carrier\'s delivery estimate are shown at checkout before you pay. Delivery estimates are the carrier\'s, and begin once your order has left us.',
      },
      {
        heading: 'If there is a delay',
        body:
          'If we cannot ship your order within the time stated above, we will email you before that time passes with a new date and the choice to cancel the order for a full refund. If you choose to cancel, we refund you within 7 business days.',
      },
      {
        heading: 'Lost or late parcels',
        body:
          'If your tracking has not moved for several days, or a parcel shows as delivered but has not reached you, email us with your order number and we will take it up with the carrier.',
      },
      {
        heading: 'Returns',
        body:
          `Unworn, unwashed items in their original condition can be returned within ${RETURN_WINDOW_DAYS} days of delivery. Our Refund Policy explains how to start a return, who pays for return shipping and when your refund arrives.`,
      },
    ],
  },

  privacy: {
    title: 'Privacy Policy',
    lede:
      'What we collect when you visit or shop with us, why we collect it, who we share it with, and the choices you have.',
    clauses: [
      {
        heading: 'Who we are',
        body: P(
          '{{legalName}} ("Shrinkless", "we", "us") runs this website and is responsible for the personal information it collects. You can reach us about anything on this page at {{email}}.',
          'Our mailing address is {{address}}.',
        ),
      },
      {
        heading: 'What we collect',
        body: P(
          'Information you give us: your name, email address and password when you create an account (the password is stored only in a scrambled form that cannot be read back); your name, email, phone number and shipping address when you order; your email address when you join our list or ask to hear about a restock; and your company, name, email, phone, country and message when you send a wholesale enquiry.',
          'If you sign in with Google, we receive your name and email address from Google. We do not receive your Google password.',
          'Information collected automatically: like every website, our servers and hosting provider record technical details such as your IP address, browser type and the pages you request, to keep the site running and secure.',
          'We never receive or store your full card number. Card payments go directly to our payment processor, Stripe.',
        ),
      },
      {
        heading: 'How we use it',
        body:
          'To take and deliver your orders and handle returns; to run your account; to answer your messages and wholesale enquiries; to send you the emails you asked for, such as restock alerts and news; to keep the site secure and prevent fraud; and to meet our legal, tax and accounting obligations.',
      },
      {
        heading: 'Who we share it with',
        body: P(
          'We do not sell your personal information, and we do not share it for targeted advertising.',
          'We share it only with the service providers who help us run the shop, and only as much as they need: Stripe (payments), Vercel (website hosting), MongoDB Atlas (our database), Cloudinary (images), Resend (email delivery), Google (only if you choose to sign in with Google), and the carriers who deliver your parcels. Each is bound to use it only to provide their service to us.',
          'Some photographs on our pages are loaded directly from Instagram and Unsplash, whose servers receive your IP address and browser details when they send the image, as any website does.',
          'We may also disclose information when the law requires it, to protect our rights or the safety of others, or as part of a sale or merger of our business.',
        ),
      },
      {
        heading: 'Cookies',
        body: P(
          'We use only the cookies the site needs to work: one keeps your cart, others keep you signed in and protect sign-in against forgery, and one remembers that you closed the announcement bar. We do not use advertising or cross-site tracking cookies, and we do not use third-party analytics.',
          'Because we do not track you across other sites, we treat "Do Not Track" and Global Privacy Control signals as already honored. You can block or delete cookies in your browser settings, but the cart and sign-in will not work without them.',
        ),
      },
      {
        heading: 'How long we keep it',
        body:
          'We keep order records for as long as tax and accounting law requires, usually seven years. We keep your account until you ask us to delete it, and your email on our list until you unsubscribe. Wholesale enquiries are kept for up to three years.',
      },
      {
        heading: 'Emails & unsubscribing',
        body:
          'Order confirmations and shipping updates are sent because you ordered. Marketing emails — news and restocks — are sent only if you signed up, and every one includes a link to unsubscribe. You can also unsubscribe at any time by emailing us.',
      },
      {
        heading: 'Your privacy rights',
        body: P(
          'Wherever you live in the US, you can ask us to tell you what personal information we hold about you, to give you a copy, to correct it, or to delete it. Email {{email}} with your request; we may need to confirm your identity before acting on it, and we will reply within 45 days. We will not treat you differently for making a request.',
          'Residents of California, Colorado, Connecticut, Virginia, Utah, Texas, Oregon and other states with privacy laws have these rights by law, and may use an authorized agent to make a request. If we decline a request, you may appeal by replying to our decision. California residents may also ask what information we have shared for direct marketing — we do not share it for that purpose.',
        ),
      },
      {
        heading: 'Security & children',
        body: P(
          'We protect your information with encrypted connections, hashed passwords and access controls. No system is perfectly secure, and we will tell you as the law requires if a breach ever affects your information.',
          'This site is not directed at children under 13, and we do not knowingly collect personal information from them. If you believe a child has given us information, email us and we will delete it.',
        ),
      },
      {
        heading: 'Changes & contact',
        body: P(
          'If we change this policy, we will update the date at the top of this page, and for significant changes we will tell you by email or with a notice on the site.',
          'Questions or requests: {{email}}.',
          'Or call {{phone}}.',
        ),
      },
    ],
  },

  accessibility: {
    title: 'Accessibility',
    lede:
      'We want everyone to be able to browse and buy from Shrinkless, including people who use assistive technology.',
    clauses: [
      {
        heading: 'Our commitment',
        body:
          'We aim for this website to meet the Web Content Accessibility Guidelines (WCAG) 2.1 at level AA. We design with keyboard navigation, screen readers, text alternatives for images, sufficient colour contrast and reduced-motion preferences in mind, and we review the site as it changes.',
      },
      {
        heading: 'Known limitations',
        body:
          'Some content — such as embedded posts from Instagram and the payment form provided by Stripe — comes from other companies, and we cannot fully control how accessible it is. If anything on the site gets in your way, we want to know.',
      },
      {
        heading: 'Tell us, and we will help',
        body: P(
          'If you have difficulty using any part of this site, email {{email}} and tell us the page and the problem. We will reply within two business days and, while we fix it, help you find information or place your order another way.',
          'Or call {{phone}}.',
        ),
      },
    ],
  },
};
