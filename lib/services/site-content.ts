import { connectToDatabase } from '@/lib/db/connection';
import { ContentSlot } from '@/lib/db/models/content-slot';
import { AdminOperationError } from '@/lib/admin/action';
import {
  MOBILE_MAX,
  WIDE_MIN,
  cleanStyleSet,
  isSafeSelector,
  styleDeclarations,
  type ContentLayer,
  type ContentLayerField,
  type ContentStyleSet,
} from '@/lib/content/style';

/* --------------------------------------------------------------------------
   The registry

   Every word on the storefront that a person is allowed to change, declared
   once, beside the page it is set on. The pages read from here rather than
   holding their own strings, so the admin panel cannot offer a field the site
   does not render and the site cannot render a string the panel cannot reach.

   The same arrangement `site-media.ts` uses for photography, for the same
   reason: the set of editable things is a property of the design, so the
   server owns it. Nothing here is media — a photograph or a film is edited on
   the Media tab, where the crop tools are.
   -------------------------------------------------------------------------- */

/**
 * What kind of writing a field holds.
 *
 * It decides two things and no more: how the preview draws it, and whether the
 * editor takes one line or several. It is not formatting; there is none.
 */
export type ContentKind =
  | 'eyebrow'
  | 'heading'
  | 'lede'
  | 'body'
  | 'button'
  | 'question'
  | 'answer'
  | 'label';

export type ContentFieldDefinition = {
  key: string;
  label: string;
  kind: ContentKind;
  default: string;
  /**
   * Which cluster on the page this field belongs to — one story tile, one of
   * the four points, one review, one question and its answer.
   *
   * The preview draws each cluster as a block, so a title and the paragraph
   * under it stay together instead of being dealt out across a grid. Fields
   * with no group are the section's own heading and sit above them all.
   */
  group?: string;
};

/** How a section is drawn in the preview, so it reads as the page rather than
 *  as a column of inputs. `ink` sections are the dark ones on the storefront. */
export type ContentSectionTone = 'paper' | 'ink';

export type ContentSectionDefinition = {
  id: string;
  label: string;
  note: string;
  tone: ContentSectionTone;
  /** Set where the storefront runs the section's parts side by side. */
  columns?: number;
  fields: ContentFieldDefinition[];
};

export type ContentPageDefinition = {
  id: string;
  label: string;
  /** Where this page is on the storefront, so the admin can go and look. */
  path: string;
  /**
   * Kept out of the editor's page list.
   *
   * The two shop landings and the line sheet are a catalogue with a word over
   * it — there is a title and nothing else to compose, and offering them as
   * pages would be offering a grid of products the tab cannot touch. The
   * fields stay in the registry because the storefront still reads them; only
   * the editor declines to list the page.
   */
  hidden?: boolean;
  sections: ContentSectionDefinition[];
};

/* The longest a field may be. A heading and a paragraph are bounded
   differently because a heading that runs to a paragraph breaks the layout it
   sits in, and saying so at the edge is kinder than letting it through. */
export const SHORT_MAX = 160;
export const LONG_MAX = 2000;

export function maxLengthFor(kind: ContentKind): number {
  return kind === 'body' || kind === 'answer' || kind === 'lede' ? LONG_MAX : SHORT_MAX;
}

/* The vocabulary of a style lives in `lib/content/style.ts`: the editor
   imports it too, and it must not drag a database connection into the
   browser. Re-exported here so content still has one door. */
export * from '@/lib/content/style';

/* --------------------------------------------------------------------------
   The policies

   Four pages of the same shape: a title and a short introduction in the head,
   then numbered clauses, each a heading and its text. Declared through one
   builder so the four cannot drift apart, and held here like every other
   word on the site, so the admin can correct a clause without a deploy.

   Anything the business has not yet confirmed — the return window, where it
   ships — is marked [TBC] exactly as the FAQ marks it. A guessed number on a
   policy page is a promise the shop then has to keep.
   -------------------------------------------------------------------------- */

type Clause = { heading: string; body: string };

/** The ids the policy pages are registered under, and their addresses. */
export const POLICY_PAGES = {
  terms: '/terms',
  refunds: '/refund-policy',
  shipping: '/shipping-returns',
  privacy: '/privacy-policy',
} as const;

export type PolicyId = keyof typeof POLICY_PAGES;

/** How many clauses each policy carries. The page renders exactly these. */
export const POLICY_CLAUSES: Record<PolicyId, number> = {
  terms: 4,
  refunds: 3,
  shipping: 4,
  privacy: 5,
};

function policyPage(
  id: PolicyId,
  label: string,
  title: string,
  lede: string,
  clauses: Clause[],
): ContentPageDefinition {
  return {
    id: `policy-${id}`,
    label,
    path: POLICY_PAGES[id],
    sections: [
      {
        id: 'head',
        label: 'Page head',
        note: 'The title and the short introduction in the band at the top of the page.',
        tone: 'paper',
        fields: [
          { key: `policy.${id}.title`, label: 'Title', kind: 'heading', default: title },
          { key: `policy.${id}.lede`, label: 'Introduction', kind: 'lede', default: lede },
        ],
      },
      {
        id: 'clauses',
        label: 'The clauses',
        note: 'Numbered in the order they are listed. A blank line in the text starts a new paragraph.',
        tone: 'paper',
        fields: clauses.flatMap((clause, index) => {
          const n = index + 1;

          return [
            {
              key: `policy.${id}.${n}.heading`,
              label: `Clause ${n}, heading`,
              kind: 'heading' as const,
              default: clause.heading,
              group: String(n),
            },
            {
              key: `policy.${id}.${n}.body`,
              label: `Clause ${n}, text`,
              kind: 'body' as const,
              default: clause.body,
              group: String(n),
            },
          ];
        }),
      },
    ],
  };
}

const POLICIES: ContentPageDefinition[] = [
  policyPage(
    'terms',
    'Terms & Conditions',
    'Terms & Conditions',
    'The terms that apply to every order placed on this website. Placing an order means you agree to them, so please read them before you buy.',
    [
      {
        heading: 'Orders, payments & pricing',
        body:
          'Every order placed on this website is subject to availability and to our confirmation. Prices are shown in US dollars and may change without notice; the price you pay is the one shown at checkout when you place your order.\n\n' +
          'We may refuse or cancel an order because of a pricing error, suspected fraud or a stock problem. If we cancel an order you have already paid for, we refund the full amount to the original payment method.\n\n' +
          'Payment is taken at checkout using the payment methods shown there. Card payments are processed by our payment provider, Stripe.',
      },
      {
        heading: 'Shipping, returns & exchanges',
        body:
          'Shipping costs and delivery estimates are shown at checkout and vary with the destination. We aim to dispatch every order promptly, but delivery times are estimates rather than guarantees.\n\n' +
          'Returns and exchanges are accepted within the return period on items that are unworn, unwashed and in their original condition. Please read our Shipping & Returns page and our Refund Policy before you buy.',
      },
      {
        heading: 'Product care & use',
        body:
          'Shrinkless tees are garment dyed organic cotton, made to hold their size and shape wash after wash when they are cared for as the care label directs. Please check the size and fit notes on each product page before ordering.\n\n' +
          'Garment dyeing means every piece is slightly different in shade; that variation is part of the process and is not a fault. We are not responsible for damage caused by washing or treating a garment against its care label, or for ordinary wear.',
      },
      {
        heading: 'Wholesale orders',
        body:
          'Wholesale orders are made to order, from 150 units, on terms we agree with you in writing. Where a written wholesale agreement and these terms differ, the written agreement applies.',
      },
    ],
  ),

  policyPage(
    'refunds',
    'Refund Policy',
    'Refund Policy',
    'If something is not right, we want to put it right. This page explains how returns, exchanges and refunds work.',
    [
      {
        heading: 'Returns & exchanges',
        body:
          'Sometimes a tee is not what you expected, and we want returning or exchanging it to be simple. We accept returns on unworn, unwashed items in their original condition within [TBC] days of delivery.\n\n' +
          'Once your return reaches us and has been checked, we refund the original payment method or send the exchange. Return shipping: [TBC].',
      },
      {
        heading: 'Made-to-order & wholesale orders',
        body:
          'There are no refunds on made-to-order or wholesale orders, because they are made to your specification.\n\n' +
          'Lead times on made-to-order work can run longer when we have a lot of it in production. We confirm the timeline when your order is agreed.',
      },
      {
        heading: 'Getting help',
        body:
          'If you have a question about returns or exchanges, or you need help with one, email us and we will take you through it step by step.',
      },
    ],
  ),

  policyPage(
    'shipping',
    'Shipping & Returns',
    'Shipping & Returns',
    'How your order reaches you, and how to send something back.',
    [
      {
        heading: 'Shipping information',
        body:
          'Every Shrinkless order is packed with care and sent on its way as soon as we can. We keep our shipping options clear and our costs visible, so you know what you are paying before you pay it.',
      },
      {
        heading: 'Costs & delivery times',
        body:
          'Shipping costs and delivery estimates are shown at checkout before you pay, and depend on where the order is going. Delivery times are estimates, not guarantees.\n\n' +
          'Where we ship to: [TBC].',
      },
      {
        heading: 'Returns',
        body:
          'Returns are accepted on unworn, unwashed items in their original condition within [TBC] days of delivery. Our Refund Policy explains how refunds and exchanges are handled, and what cannot be returned.',
      },
      {
        heading: 'Questions',
        body:
          'Customer satisfaction comes first. If you have a question about shipping, or about an order on its way to you, email us and we will help.',
      },
    ],
  ),

  policyPage(
    'privacy',
    'Privacy Policy',
    'Privacy Policy',
    'What we collect when you shop with us, why we collect it, and how we keep it safe.',
    [
      {
        heading: 'Customer care',
        body:
          'This page is a plain guide to how Shrinkless looks after the information you share with us before, during and after a purchase. It does not replace the terms that apply to a particular order. For help with an order, shipping, a return, sizing or a product, email us and we will answer you directly.',
      },
      {
        heading: 'What we collect',
        body:
          'When you create an account: your name, your email address and a password, which we store only in a scrambled form that cannot be read back.\n\n' +
          'When you place an order: your name, email address, shipping address and the details of the order, so we can send it and help you with it afterwards.\n\n' +
          'When you join our list: your email address, used only to tell you about restocks and new releases.',
      },
      {
        heading: 'Payments & safety',
        body:
          'Card payments are handled by our payment provider, Stripe. Your card details go directly to them and are never stored by us.\n\n' +
          'We protect your details with encrypted connections and access controls, and only use them to run your orders, your account and the updates you asked for. We do not sell your information.',
      },
      {
        heading: 'Cookies',
        body:
          'We use a small number of cookies that the site needs to work: one keeps your cart, one keeps you signed in, and one remembers that you closed the announcement bar. We do not use advertising or tracking cookies.',
      },
      {
        heading: 'Wholesale enquiries',
        body:
          'When you send a wholesale enquiry, we collect your company name, your name, email address, phone number, country and your message, and use them only to answer you and to agree terms. Wholesale orders are made to order, from 150 units.\n\n' +
          'To ask what we hold about you, or to have it corrected or deleted, email us.',
      },
    ],
  ),
];

/**
 * The pages, in the order the panel lists them.
 *
 * Only pages that actually carry hand-written copy are here. The cart,
 * checkout, account and product pages are built from the catalogue and from
 * system messages rather than from set wording, so there is nothing on them
 * for this tab to hold.
 */
const PAGES: ContentPageDefinition[] = [
  {
    id: 'home',
    label: 'Home',
    path: '/',
    sections: [
      {
        id: 'hero',
        label: 'Campaign hero',
        note: 'The type set over the carousel. The photography behind it is edited on Media.',
        tone: 'ink',
        fields: [
          { key: 'home.hero.eyebrow', label: 'Eyebrow', kind: 'eyebrow', default: 'Made in USA' },
          {
            key: 'home.hero.headline1',
            label: 'Headline, first line',
            kind: 'heading',
            default: 'Organic tees',
          },
          {
            key: 'home.hero.headline2',
            label: 'Headline, second line',
            kind: 'heading',
            default: "that don't shrink.",
          },
          {
            key: 'home.hero.lede',
            label: 'Lede',
            kind: 'lede',
            default: 'Garment dyed organic cotton, cut and sewn in the United States.',
          },
          {
            key: 'home.hero.primary',
            label: 'Primary button',
            kind: 'button',
            default: 'Shop tees',
          },
          {
            key: 'home.hero.secondary',
            label: 'Secondary button',
            kind: 'button',
            default: 'Why Shrinkless',
          },
        ],
      },
      {
        id: 'new',
        label: 'New arrivals',
        note: 'The heading over the first product grid.',
        tone: 'paper',
        fields: [
          { key: 'home.new.eyebrow', label: 'Eyebrow', kind: 'eyebrow', default: 'Just landed' },
          { key: 'home.new.heading', label: 'Heading', kind: 'heading', default: 'New Arrivals' },
          { key: 'home.new.link', label: 'Link', kind: 'button', default: 'Shop all' },
        ],
      },
      {
        id: 'story',
        label: 'Story tiles',
        note: 'The pair of overlay tiles under the lookbook rail.',
        tone: 'ink',
        columns: 2,
        fields: [
          {
            key: 'home.story.1.title',
            label: 'First tile — title',
            kind: 'heading',
            default: 'The tee that stays the same.',
            group: 'one',
          },
          {
            key: 'home.story.1.body',
            label: 'First tile — body',
            kind: 'body',
            default:
              'Pre-shrunk, then garment dyed at temperature — so the change happens in our facility, not in your machine.',
            group: 'one',
          },
          {
            key: 'home.story.2.title',
            label: 'Second tile — title',
            kind: 'heading',
            default: 'Worn in, not worn out.',
            group: 'two',
          },
          {
            key: 'home.story.2.body',
            label: 'Second tile — body',
            kind: 'body',
            default:
              'Garment dyeing settles the colour into the cotton rather than sitting on top of it.',
            group: 'two',
          },
        ],
      },
      {
        id: 'promise',
        label: 'Promise band',
        note: 'The type on the full-bleed photograph.',
        tone: 'ink',
        fields: [
          {
            key: 'home.promise.eyebrow',
            label: 'Eyebrow',
            kind: 'eyebrow',
            default: 'The promise',
          },
          {
            key: 'home.promise.headline',
            label: 'Headline',
            kind: 'heading',
            default: 'Wash it. Dry it. Wear it.',
          },
          {
            key: 'home.promise.body',
            label: 'Body',
            kind: 'body',
            default: 'The shrinking happens in our facility, not in your machine.',
          },
        ],
      },
      {
        id: 'featured',
        label: 'Featured',
        note: 'The heading over the second product grid. Hidden when nothing is featured.',
        tone: 'paper',
        fields: [
          {
            key: 'home.featured.eyebrow',
            label: 'Eyebrow',
            kind: 'eyebrow',
            default: 'Chosen by us',
          },
          { key: 'home.featured.heading', label: 'Heading', kind: 'heading', default: 'Featured' },
          { key: 'home.featured.link', label: 'Link', kind: 'button', default: 'Shop all' },
        ],
      },
      {
        id: 'reviews',
        label: 'Reviews',
        note: 'Three quotes and the names under them.',
        tone: 'paper',
        columns: 3,
        fields: [
          { key: 'home.reviews.eyebrow', label: 'Eyebrow', kind: 'eyebrow', default: 'Reviews' },
          {
            key: 'home.reviews.heading',
            label: 'Heading',
            kind: 'heading',
            default: 'What people say.',
          },
          {
            key: 'home.reviews.1.text',
            label: 'First quote',
            kind: 'body',
            default: 'Finally found a tee that still fits the way I want it to after washing.',
            group: 'one',
          },
          {
            key: 'home.reviews.1.name',
            label: 'First name',
            kind: 'label',
            default: 'Placeholder review',
            group: 'one',
          },
          {
            key: 'home.reviews.2.text',
            label: 'Second quote',
            kind: 'body',
            default:
              'The colour has settled into something better than it started. It looks worn in, not worn out.',
            group: 'two',
          },
          {
            key: 'home.reviews.2.name',
            label: 'Second name',
            kind: 'label',
            default: 'Placeholder review',
            group: 'two',
          },
          {
            key: 'home.reviews.3.text',
            label: 'Third quote',
            kind: 'body',
            default: 'I bought one to try it. I now own four.',
            group: 'three',
          },
          {
            key: 'home.reviews.3.name',
            label: 'Third name',
            kind: 'label',
            default: 'Placeholder review',
            group: 'three',
          },
        ],
      },
    ],
  },

  {
    id: 'shop',
    label: 'All Products',
    path: '/shop',
    hidden: true,
    sections: [
      {
        id: 'head',
        label: 'Page head',
        note: 'The type over the unfiltered grid. Men and Women have heads of their own.',
        tone: 'paper',
        fields: [
          { key: 'shop.all.eyebrow', label: 'Eyebrow', kind: 'eyebrow', default: 'Collection' },
          { key: 'shop.all.title', label: 'Title', kind: 'heading', default: 'All Products' },
          {
            key: 'shop.all.lede',
            label: 'Lede',
            kind: 'lede',
            default: 'Every Shrinkless style, in every colour we currently make it.',
          },
        ],
      },
    ],
  },

  {
    id: 'men',
    label: 'Men',
    path: '/shop/men',
    hidden: true,
    sections: [
      {
        id: 'head',
        label: 'Page head',
        note: 'The title over the grid. Everything below it is the catalogue.',
        tone: 'paper',
        fields: [{ key: 'shop.men.title', label: 'Title', kind: 'heading', default: 'Men' }],
      },
    ],
  },

  {
    id: 'women',
    label: 'Women',
    path: '/shop/women',
    hidden: true,
    sections: [
      {
        id: 'head',
        label: 'Page head',
        note: 'The title over the grid. Everything below it is the catalogue.',
        tone: 'paper',
        fields: [{ key: 'shop.women.title', label: 'Title', kind: 'heading', default: 'Women' }],
      },
    ],
  },

  {
    id: 'our-story',
    label: 'Our Story',
    path: '/our-story',
    sections: [
      {
        id: 'film',
        label: 'The film',
        note: 'The title and the story set on the film. The film itself is not edited here.',
        tone: 'ink',
        fields: [
          { key: 'story.title', label: 'Title', kind: 'heading', default: 'Our Story' },
          {
            key: 'story.body',
            label: 'Story',
            kind: 'body',
            default:
              'Founded in 2015 by Nicholas Bowles, Shrinkless was created from a simple belief: your favorite T-shirt shouldn’t change after you wash it. Frustrated by shirts that lost their fit, shape, and feel after just a few washes, Nicholas set out to create something better. Today, Shrinkless makes garment-dyed organic cotton tees that are made in the USA and designed to keep their fit, feel, and character wash after wash. We believe a great T-shirt should be simple, comfortable, and built to last, which is why we focus on quality materials, thoughtful craftsmanship, and timeless design rather than chasing trends. From the way our tees feel when you first put them on to the way they become part of your everyday wardrobe, everything we do comes back to one idea: make a T-shirt you can count on. No unnecessary fuss, no disposable fashion, just exceptionally comfortable tees made to be worn, washed, and worn again. That’s Shrinkless.',
          },
        ],
      },
      {
        id: 'chapters',
        label: 'The three chapters',
        note: 'A title and a paragraph each, beside their photographs. The photographs are edited on Media.',
        tone: 'paper',
        columns: 2,
        fields: [
          {
            key: 'story.ch1.title',
            label: 'First — title',
            kind: 'heading',
            default: 'The shirt that stopped fitting',
            group: 'one',
          },
          {
            key: 'story.ch1.body',
            label: 'First — paragraph',
            kind: 'body',
            default:
              'Every wardrobe has one. It fitted the day it was bought, and three washes later the hem sat high and the shoulders had moved. Cotton shrinks because it was stretched to be knitted, and heat lets it go back. Most tees are sold before that happens.',
            group: 'one',
          },
          {
            key: 'story.ch2.title',
            label: 'Second — title',
            kind: 'heading',
            default: 'A cloth that has already moved',
            group: 'two',
          },
          {
            key: 'story.ch2.body',
            label: 'Second — paragraph',
            kind: 'body',
            default:
              'Ours is washed and dyed as a finished garment, at temperatures past anything a home machine reaches. The shrinking happens here, before it is yours. What arrives has already been through what it is about to go through.',
            group: 'two',
          },
          {
            key: 'story.ch3.title',
            label: 'Third — title',
            kind: 'heading',
            default: 'Made where we can stand in the room',
            group: 'three',
          },
          {
            key: 'story.ch3.body',
            label: 'Third — paragraph',
            kind: 'body',
            default:
              'Cut, sewn, dyed and washed in the United States, in workshops we visit. It costs more than the alternative and it is the reason the tee behaves the way it does.',
            group: 'three',
          },
        ],
      },
      {
        id: 'spec',
        label: 'The care-label strip',
        note: 'Four short facts, set like a care label. Keep them to a few words each.',
        tone: 'paper',
        columns: 2,
        fields: [
          { key: 'story.spec.1', label: 'First', kind: 'label', default: 'Made in USA' },
          { key: 'story.spec.2', label: 'Second', kind: 'label', default: 'Organic cotton' },
          { key: 'story.spec.3', label: 'Third', kind: 'label', default: 'Garment dyed' },
          { key: 'story.spec.4', label: 'Fourth', kind: 'label', default: 'Holds its fit' },
        ],
      },
      {
        id: 'close',
        label: 'The closing band',
        note: 'One line over the full-bleed photograph, and the button under it.',
        tone: 'ink',
        fields: [
          {
            key: 'story.statement',
            label: 'Statement',
            kind: 'heading',
            default: 'Buy it once. Wash it forever.',
          },
          { key: 'story.cta', label: 'Button', kind: 'button', default: 'Shop the tees' },
        ],
      },
    ],
  },

  {
    id: 'why-shrinkless',
    label: 'Why Shrinkless',
    path: '/why-shrinkless',
    sections: [
      {
        id: 'head',
        label: 'Page head',
        note: 'The title and the line under it.',
        tone: 'paper',
        fields: [
          { key: 'why.title', label: 'Title', kind: 'heading', default: 'Why Shrinkless' },
          {
            key: 'why.lede',
            label: 'Lede',
            kind: 'lede',
            default: 'Four things separate this tee from the one that stopped fitting.',
          },
        ],
      },
      {
        id: 'points',
        label: 'The four points',
        note: 'A number, a title and a line on each photograph. The photographs are edited on Media.',
        tone: 'ink',
        columns: 2,
        fields: [
          { key: 'why.1.index', label: 'First — number', kind: 'label', default: '01', group: 'one' },
          {
            key: 'why.1.title',
            label: 'First — title',
            kind: 'heading',
            default: 'Organic Cotton',
            group: 'one',
          },
          {
            key: 'why.1.body',
            label: 'First — body',
            kind: 'body',
            default: 'Premium organic cotton, selected for everyday wear. Certification: [TBC].',
            group: 'one',
          },
          { key: 'why.2.index', label: 'Second — number', kind: 'label', default: '02', group: 'two' },
          {
            key: 'why.2.title',
            label: 'Second — title',
            kind: 'heading',
            default: 'Garment Dyed',
            group: 'two',
          },
          {
            key: 'why.2.body',
            label: 'Second — body',
            kind: 'body',
            default: 'The finished garment is dyed for its distinctive character and feel.',
            group: 'two',
          },
          { key: 'why.3.index', label: 'Third — number', kind: 'label', default: '03', group: 'three' },
          {
            key: 'why.3.title',
            label: 'Third — title',
            kind: 'heading',
            default: "Doesn't Shrink",
            group: 'three',
          },
          {
            key: 'why.3.body',
            label: 'Third — body',
            kind: 'body',
            default:
              'Built to maintain its fit and proportions wash after wash. Expected residual shrinkage: [TBC]%.',
            group: 'three',
          },
          { key: 'why.4.index', label: 'Fourth — number', kind: 'label', default: '04', group: 'four' },
          {
            key: 'why.4.title',
            label: 'Fourth — title',
            kind: 'heading',
            default: 'Made in USA',
            group: 'four',
          },
          {
            key: 'why.4.body',
            label: 'Fourth — body',
            kind: 'body',
            default: 'Proudly made in the USA.',
            group: 'four',
          },
        ],
      },
      {
        id: 'proof',
        label: 'The proof',
        note: 'One figure, set large, and the line that explains it.',
        tone: 'ink',
        fields: [
          { key: 'why.proof.figure', label: 'Figure', kind: 'heading', default: '[TBC]%' },
          {
            key: 'why.proof.caption',
            label: 'Caption',
            kind: 'label',
            default: 'Shrinkage after repeated home washing — figure to be confirmed.',
          },
        ],
      },
      {
        id: 'cta',
        label: 'Call to action',
        note: 'The line over the closing photograph, and the button under it. It goes to the shop.',
        tone: 'ink',
        fields: [
          {
            key: 'why.statement',
            label: 'Closing line',
            kind: 'heading',
            default: 'The one that still fits.',
          },
          { key: 'why.cta', label: 'Button', kind: 'button', default: 'Shop Now' },
        ],
      },
    ],
  },

  {
    id: 'faq',
    label: 'FAQ',
    path: '/faq',
    sections: [
      {
        id: 'head',
        label: 'Page head',
        note: 'The title over the accordion.',
        tone: 'paper',
        fields: [
          {
            key: 'faq.title',
            label: 'Title',
            kind: 'heading',
            default: 'Frequently asked questions',
          },
        ],
      },
      {
        id: 'items',
        label: 'The questions',
        note: 'Eight questions and their answers, in the order they are listed.',
        tone: 'paper',
        fields: [
          {
            key: 'faq.1.q',
            label: 'Question 1',
            kind: 'question',
            default: 'Does it really not shrink?',
            group: '1',
          },
          {
            key: 'faq.1.a',
            label: 'Answer 1',
            kind: 'answer',
            default:
              'The fabric is pre-shrunk and the finished garment is dyed at temperature, so the shrinkage happens before the tee reaches you. Expected residual shrinkage after washing: [TBC]%.',
            group: '1',
          },
          {
            key: 'faq.2.q',
            label: 'Question 2',
            kind: 'question',
            default: 'What is garment dyeing?',
            group: '2',
          },
          {
            key: 'faq.2.a',
            label: 'Answer 2',
            kind: 'answer',
            default:
              'The tee is sewn first and dyed afterwards, as a finished garment. The colour settles into the cotton rather than sitting on the surface, which is why it has depth when new and wears in rather than out.',
            group: '2',
          },
          { key: 'faq.3.q', label: 'Question 3', kind: 'question', default: 'What is the fabric?', group: '3' },
          {
            key: 'faq.3.a',
            label: 'Answer 3',
            kind: 'answer',
            default: '[TBC]oz organic cotton, [TBC] knit. Certification body: [TBC].',
            group: '3',
          },
          { key: 'faq.4.q', label: 'Question 4', kind: 'question', default: 'How does it fit?', group: '4' },
          {
            key: 'faq.4.a',
            label: 'Answer 4',
            kind: 'answer',
            default:
              'A regular fit through the body and shoulder, not boxy and not slim. Full measurements by size: [TBC].',
            group: '4',
          },
          { key: 'faq.5.q', label: 'Question 5', kind: 'question', default: 'Should I size up?', group: '5' },
          {
            key: 'faq.5.a',
            label: 'Answer 5',
            kind: 'answer',
            default:
              'No. The tee is finished before it ships, so it will not shrink into a smaller size — buy the size you want to wear.',
            group: '5',
          },
          {
            key: 'faq.6.q',
            label: 'Question 6',
            kind: 'question',
            default: 'How should I wash it?',
            group: '6',
          },
          {
            key: 'faq.6.a',
            label: 'Answer 6',
            kind: 'answer',
            default:
              'Machine wash cold with like colours and tumble dry low. Garment dyed cotton keeps its character best out of high heat. Full care instructions: [TBC].',
            group: '6',
          },
          { key: 'faq.7.q', label: 'Question 7', kind: 'question', default: 'Where do you ship?', group: '7' },
          {
            key: 'faq.7.a',
            label: 'Answer 7',
            kind: 'answer',
            default: 'Shipping destinations, options and delivery estimates: [TBC].',
            group: '7',
          },
          { key: 'faq.8.q', label: 'Question 8', kind: 'question', default: 'Can I return it?', group: '8' },
          {
            key: 'faq.8.a',
            label: 'Answer 8',
            kind: 'answer',
            default:
              'Returns are accepted on unworn items within [TBC] days. Return shipping policy: [TBC].',
            group: '8',
          },
        ],
      },
    ],
  },

  {
    id: 'wholesale',
    label: 'Wholesale',
    path: '/wholesale',
    hidden: true,
    sections: [
      {
        id: 'head',
        label: 'Page head',
        note: 'The title over the line sheet. The styles below it come from the catalogue.',
        tone: 'ink',
        fields: [
          { key: 'wholesale.title', label: 'Title', kind: 'heading', default: 'Wholesale' },
          {
            key: 'wholesale.lede',
            label: 'Lede',
            kind: 'lede',
            default: 'Ten styles, made to order, on terms we agree with you directly.',
          },
        ],
      },
      {
        id: 'terms',
        label: 'The terms strip',
        note: 'The four facts a buyer looks for first. Keep them to a few words each.',
        tone: 'ink',
        columns: 2,
        fields: [
          { key: 'wholesale.terms.1', label: 'First', kind: 'label', default: 'MOQ 150 units' },
          { key: 'wholesale.terms.2', label: 'Second', kind: 'label', default: 'Ten styles' },
          { key: 'wholesale.terms.3', label: 'Third', kind: 'label', default: 'Made to order' },
          { key: 'wholesale.terms.4', label: 'Fourth', kind: 'label', default: 'Four to six weeks' },
        ],
      },
      {
        id: 'close',
        label: 'The closing band',
        note: 'One line over the full-bleed photograph, and the button under it.',
        tone: 'ink',
        fields: [
          {
            key: 'wholesale.statement',
            label: 'Statement',
            kind: 'heading',
            default: 'Tell us what you need.',
          },
          { key: 'wholesale.cta', label: 'Button', kind: 'button', default: 'Request a quote' },
        ],
      },
    ],
  },

  // Last in the panel: they are read far less often than they are edited.
  ...POLICIES,
];

/* Flattened once, at module load, so every lookup below is a map hit rather
   than a walk of the tree. */
const FIELDS = new Map<string, ContentFieldDefinition>(
  PAGES.flatMap((page) =>
    page.sections.flatMap((section) => section.fields.map((field) => [field.key, field] as const)),
  ),
);

export const CONTENT_KEYS: string[] = [...FIELDS.keys()];

/** Whether a key names something the storefront actually renders. */
export function isKnownContentKey(key: string): boolean {
  return FIELDS.has(key);
}

function assertKnown(key: string): ContentFieldDefinition {
  const field = FIELDS.get(key);
  if (!field) throw new AdminOperationError('That is not a field this site has.');

  return field;
}

/** The wording the site shipped with, for one field. */
export function defaultContent(key: string): string {
  return FIELDS.get(key)?.default ?? '';
}

/* --------------------------------------------------------------------------
   Reading
   -------------------------------------------------------------------------- */

/** Every editable string on the storefront, overrides merged over the shipped
 *  wording, indexed by key. */
export type SiteContent = Record<string, string>;

/** One stored row, as the panel and the storefront both need it. */
type ContentOverride = {
  value?: string;
  style?: ContentStyleSet;
  selector?: string;
};

async function loadOverrides(): Promise<Map<string, ContentOverride>> {
  await connectToDatabase();

  const rows = await ContentSlot.find({}).select('key value style selector').lean();

  return new Map(
    rows.map((row) => [
      row.key,
      {
        value: row.value ?? undefined,
        style: (row.style as ContentStyleSet | undefined) ?? undefined,
        selector: row.selector ?? undefined,
      },
    ]),
  );
}

/**
 * The storefront's copy.
 *
 * One query for the whole site, the same bargain `getSiteMedia` strikes: the
 * callers are server components already talking to the database, so this costs
 * a round trip that was happening anyway rather than one per string.
 *
 * A row for a key the registry no longer has is ignored rather than returned —
 * a field removed from a page must not resurrect through the database.
 */
export async function getSiteContent(): Promise<SiteContent> {
  const overrides = await loadOverrides();

  const content: SiteContent = {};

  for (const [key, field] of FIELDS) {
    const stored = overrides.get(key)?.value;
    content[key] = stored ? stored : field.default;
  }

  return content;
}

/* --------------------------------------------------------------------------
   The admin's view
   -------------------------------------------------------------------------- */

export type ContentFieldView = ContentFieldDefinition & {
  /** What the storefront is serving right now. */
  value: string;
  /** False when the field is still showing what the site shipped with. */
  overridden: boolean;
  maxLength: number;
  /** How the field is currently set, per width. Empty when it is still drawn
   *  the way the page draws it. */
  style: ContentStyleSet;
  /** Where the last save found this field in the page's markup. */
  selector?: string;
};

export type ContentSectionView = Omit<ContentSectionDefinition, 'fields'> & {
  fields: ContentFieldView[];
};

export type ContentPageView = Omit<ContentPageDefinition, 'sections'> & {
  sections: ContentSectionView[];
};

/**
 * Every page, section and field, with enough context for a person to know what
 * they are editing and whether it has been touched.
 */
export async function listContentPages(): Promise<ContentPageView[]> {
  const overrides = await loadOverrides();

  return PAGES.filter((page) => !page.hidden).map((page) => ({
    ...page,
    sections: page.sections.map((section) => ({
      ...section,
      fields: section.fields.map((field) => {
        const stored = overrides.get(field.key);
        const overridden = Boolean(stored?.value);

        return {
          ...field,
          value: overridden ? (stored?.value as string) : field.default,
          overridden,
          maxLength: maxLengthFor(field.kind),
          style: stored?.style ?? {},
          selector: stored?.selector,
        };
      }),
    })),
  }));
}

/* --------------------------------------------------------------------------
   Writing
   -------------------------------------------------------------------------- */

/** Replaces the wording of one field. */
export async function saveContentField(key: string, value: string): Promise<void> {
  await saveContentFields([{ key, value }]);
}

/** One field as the editor hands it back: its wording, how it is set, and
 *  where the editor found it standing on the page. */
export type ContentFieldEdit = {
  key: string;
  value: string;
  style?: ContentStyleSet;
  selector?: string;
};

/**
 * Writes a page's worth of edits.
 *
 * The whole page goes at once because that is how the editor works — an admin
 * moves between several lines before deciding, and a save that only carried
 * the last one would quietly drop the rest. Each row is still keyed by field,
 * so two pages sharing a field cannot fork it.
 */
export async function saveContentFields(edits: ContentFieldEdit[]): Promise<void> {
  if (!edits.length) return;

  const writes = edits.map((edit) => {
    const field = assertKnown(edit.key);

    const text = edit.value.trim();
    if (!text) throw new AdminOperationError('That field cannot be empty.');

    const limit = maxLengthFor(field.kind);
    if (text.length > limit) {
      throw new AdminOperationError(`That is longer than this field takes — ${limit} characters.`);
    }

    /* How a field is set travels separately from what it says, and only a
       caller that actually has settings sends them. The Content tab does not:
       it writes the sentence and leaves whatever the field is already drawn
       with alone, rather than clearing a size somebody chose because they
       fixed a typo underneath it. */
    const update: Record<string, unknown> = { value: text };

    if (edit.style) update.style = cleanStyleSet(edit.style);

    if (edit.selector !== undefined) {
      update.selector = isSafeSelector(edit.selector) ? edit.selector : null;
    }

    return {
      updateOne: {
        filter: { key: edit.key },
        update: { $set: update },
        upsert: true,
      },
    };
  });

  await connectToDatabase();
  await ContentSlot.bulkWrite(writes);
}

/** Puts a field back to the wording the site shipped with, by forgetting the
 *  override rather than by writing a second copy of the original that could
 *  drift. */
/**
 * Everything one page needs to serve its own overrides: the stylesheet built
 * from what has been saved for its fields, and the fields themselves so the
 * editor running inside an iframe knows what it may select.
 *
 * Scoped to a page rather than to the site because two pages can set the same
 * kind of element differently, and a sheet carrying both would have them
 * fighting over one selector.
 */
export async function getContentLayer(pageId: string): Promise<ContentLayer> {
  const page = PAGES.find((candidate) => candidate.id === pageId);
  if (!page) return { page: pageId, css: '', fields: [] };

  const overrides = await loadOverrides();
  const fields: ContentLayerField[] = [];
  const blocks: string[] = [];

  for (const section of page.sections) {
    for (const field of section.fields) {
      const stored = overrides.get(field.key);

      fields.push({
        key: field.key,
        label: field.label,
        value: stored?.value ?? field.default,
      });

      const selector = stored?.selector;
      if (!selector || !isSafeSelector(selector) || !stored?.style) continue;

      const desktop = styleDeclarations(stored.style.desktop);
      const mobile = styleDeclarations(stored.style.mobile);

      if (desktop) blocks.push(`@media (min-width: ${WIDE_MIN}) { ${selector} { ${desktop} } }`);
      if (mobile) blocks.push(`@media (max-width: ${MOBILE_MAX}) { ${selector} { ${mobile} } }`);
    }
  }

  return { page: page.id, css: blocks.join('\n'), fields };
}

export async function resetContentField(key: string): Promise<void> {
  assertKnown(key);

  await connectToDatabase();
  await ContentSlot.deleteOne({ key });
}
