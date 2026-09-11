'use client';

import {
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  useTransition,
} from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { updateQuantityAction } from '@/app/actions/cart';
import { imageUrl } from '@/lib/images';
import { formatCents } from '@/lib/money';
import { useToast } from '@/components/ui/Toast';
import type { CartLineDTO, CartViewDTO } from '@/types/dto';

/**
 * "Are we on the client yet?", without an effect.
 *
 * The store never changes, so the subscription is a no-op; the value is simply
 * different on the server than in the browser, and `useSyncExternalStore` is
 * the hook that is allowed to say so — it hands React the server value for the
 * hydrating render and the client value immediately after, with no state
 * update and no second commit.
 */
const subscribeToNothing = () => () => {};
const onClient = () => true;
const onServer = () => false;

type Props = {
  cart: CartViewDTO | null;
  open: boolean;
  onClose: () => void;
};

/* --------------------------------------------------------------------------
   The quantity rule, in the sheet

   The sheet used to step by one in both directions, which is fine for the
   common product and wrong for every other kind: a tee sold in twelves has no
   "thirteen", so the plus button asked the server for a quantity it is built
   to refuse and the shopper got an error for pressing the only control in
   front of them. `/cart` already stepped by the rule. These two are that same
   arithmetic, so the two lists cannot drift apart again.
   -------------------------------------------------------------------------- */

/** Below the minimum there is no smaller legal quantity, so the line goes. */
function stepDown(line: CartLineDTO): number {
  const next = line.quantity - line.quantityRule.step;
  return next < line.quantityRule.min ? 0 : next;
}

/** Room on the shelf, and room under the product's own ceiling. */
function canStepUp(line: CartLineDTO): boolean {
  const next = line.quantity + line.quantityRule.step;

  return (
    next <= line.availableStock &&
    (line.quantityRule.max === null || next <= line.quantityRule.max)
  );
}

/**
 * The cart, as a sheet that rises from the foot of the window.
 *
 * Sending a shopper to /cart threw away the page they were shopping — the
 * scroll position, the filters, the colourway they had stepped a card round
 * to — in order to show them a list they mostly wanted to glance at. The sheet
 * costs them none of it: it comes up over the collection and goes away again.
 *
 * /cart still exists and still works. It is what a bookmark, a shared link and
 * a browser with JavaScript off all land on. What changed is that nothing in
 * the store navigates there by default.
 *
 * The colour scheme is deliberately not the storefront's. Everything else is
 * ink on paper; this is a warm near-black with sand-coloured type, so the
 * sheet reads as a separate surface laid over the shop rather than as another
 * panel of it — and so its one primary action cannot be mistaken for the
 * page's own buttons.
 */
export function CartSheet({ cart, open, onClose }: Props) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const toast = useToast();

  const [pending, startTransition] = useTransition();

  // The sheet is rendered into `document.body` rather than where it sits in
  // the tree. Its natural home is inside the header, which lives inside
  // `.shell__stack` — and that has `overflow: clip` on desktop to cut the
  // slab's rounded corners. Whether a clipped ancestor also clips a
  // fixed-position descendant is exactly the kind of thing that differs
  // between engines, and a cart that is invisible at the foot of a long page
  // in one browser is not a bug worth discovering in production.
  const mounted = useSyncExternalStore(subscribeToNothing, onClient, onServer);

  const lines = cart?.lines ?? [];
  const count = cart?.itemCount ?? 0;

  function change(variantId: string, quantity: number) {
    startTransition(async () => {
      const result = await updateQuantityAction(variantId, quantity);

      if (!result.ok) {
        toast(result.error, 'error');
        return;
      }

      if (quantity === 0) toast('Removed from cart');

      // The action revalidates the layout, but this component is holding the
      // cart it was handed at render. Refresh so the sheet redraws from the
      // cart that now exists rather than the one that did.
      router.refresh();
    });
  }

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    const previous = document.activeElement as HTMLElement | null;

    function focusable(): HTMLElement[] {
      if (!panel) return [];
      return [
        ...panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((node) => node.offsetParent !== null);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const nodes = focusable();
      if (!nodes.length) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // A frame's grace: the panel is still translated off the bottom on the
    // tick the class lands, and focusing a node with no layout box does
    // nothing at all.
    const raf = requestAnimationFrame(() => focusable()[0]?.focus());

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      cancelAnimationFrame(raf);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className={`cartsheet${open ? ' cartsheet--open' : ''}`}>
      <button
        type="button"
        className="cartsheet__scrim"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
      />

      <div
        className="cartsheet__panel"
        // Lenis owns the wheel globally; without this the list inside a
        // half-height sheet cannot be scrolled with a trackpad.
        data-lenis-prevent
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
        inert={!open}
      >
        <span className="cartsheet__grip" aria-hidden="true" />

        <div className="cartsheet__bar">
          <h2 id={titleId} className="cartsheet__title">
            Your cart
            {count > 0 ? <span className="cartsheet__count tnum">{count}</span> : null}
          </h2>

          <button type="button" className="cartsheet__close" onClick={onClose}>
            Close
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="cartsheet__empty">
            <p className="cartsheet__emptyhead">Nothing in it yet.</p>
            <p className="cartsheet__emptylede">
              Six styles, two fits, and a tee that comes out of the wash the
              size it went in.
            </p>
            <Link href="/shop" className="cartsheet__cta" onClick={onClose}>
              Shop tees
            </Link>
          </div>
        ) : (
          <>
            <ul className="cartsheet__lines">
              {lines.map((line) => (
                <li key={line.variantId} className="cartsheet__line">
                  <Link
                    href={`/product/${line.productSlug}`}
                    className="cartsheet__plate"
                    onClick={onClose}
                  >
                    {line.imagePublicId ? (
                      <Image
                        src={imageUrl(line.imagePublicId, 'c_fill,w_400,h_600,q_auto,f_auto')}
                        alt=""
                        width={160}
                        height={240}
                        className="cartsheet__thumb"
                      />
                    ) : null}
                  </Link>

                  <div className="cartsheet__body">
                    <p className="cartsheet__name">
                      <Link href={`/product/${line.productSlug}`} onClick={onClose}>
                        {line.productTitle}
                      </Link>
                    </p>

                    <p className="cartsheet__spec">
                      {line.color} / {line.size.toUpperCase()}
                    </p>

                    <div
                      className="cartsheet__stepper"
                      role="group"
                      aria-label={`Quantity for ${line.productTitle}`}
                    >
                      <button
                        type="button"
                        disabled={pending}
                        aria-label="Decrease quantity"
                        onClick={() => change(line.variantId, stepDown(line))}
                      >
                        &minus;
                      </button>

                      <span className="tnum" aria-live="polite">{line.quantity}</span>

                      <button
                        type="button"
                        disabled={pending || !canStepUp(line)}
                        aria-label="Increase quantity"
                        onClick={() =>
                          change(line.variantId, line.quantity + line.quantityRule.step)
                        }
                      >
                        +
                      </button>

                      <button
                        type="button"
                        className="cartsheet__remove"
                        disabled={pending}
                        onClick={() => change(line.variantId, 0)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <p className="cartsheet__linetotal tnum">
                    {formatCents(line.lineTotalCents)}
                  </p>
                </li>
              ))}
            </ul>

            <div className="cartsheet__foot">
              <div className="cartsheet__total">
                <span>Subtotal</span>
                <span className="tnum">{formatCents(cart?.subtotalCents ?? 0)}</span>
              </div>

              <p className="cartsheet__note">Shipping and tax at checkout.</p>

              <Link href="/checkout" className="cartsheet__cta" onClick={onClose}>
                Checkout
              </Link>

              <button type="button" className="cartsheet__keep" onClick={onClose}>
                Keep shopping
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
