'use client';

import { usePathname } from 'next/navigation';
import { chromeFor } from '@/lib/shop/chrome';
import { HomeHeader } from '@/components/home/HomeHeader';
// hm-core.css first: /cart, /faq, /checkout, /product carry no HomeScene, so
// without it the `--hm-head-h`/`--hm-announce` tokens and the
// `.shell:has(.announce)` rule this masthead depends on don't exist there.
import '@/components/home/hm-core.css';
import '@/components/home/home.css';

type Props = React.ComponentProps<typeof HomeHeader>;

/**
 * The storefront's masthead.
 *
 * The whole store shares one header now, so the only thing left for a route to
 * decide is whether the bar may start transparent over the top of the page.
 * That is a lookup in `lib/shop/chrome.ts` rather than anything this component
 * knows — which is the difference between this and the `HomeSwitch` it
 * replaced, whose whole job was asking whether the path was `/`.
 */
export function Chrome(props: Props) {
  return <HomeHeader {...props} over={chromeFor(usePathname()).over} />;
}
