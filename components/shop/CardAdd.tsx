'use client';

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
  type RefObject,
} from 'react';
import { useRouter } from 'next/navigation';
import { addToCartAction } from '@/app/actions/cart';
import { CheckIcon, CloseIcon, PlusIcon } from '@/components/site/icons';
import { useToast } from '@/components/ui/Toast';
import type { AddOption } from '@/lib/shop/quick-add';

/** How long the button says "Added" before it offers itself again. */
const ADDED_MS = 1800;

/**
 * Putting one option in the cart, from a card.
 *
 * The same server action, the same toast and the same refresh as the product
 * page's own button, so a card cannot add something the page would refuse or
 * say anything the page would not.
 */
export function useCardAdd() {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function add(option: AddOption, then?: () => void) {
    const variantId = option.variantId;
    if (!variantId) return;

    startTransition(async () => {
      const result = await addToCartAction(variantId, option.quantity);

      if (!result.ok) {
        toast(result.error, 'error');
        return;
      }

      toast('Added to cart');
      setAdded(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setAdded(false), ADDED_MS);
      then?.();

      // The header's count and the cart sheet are drawn from the server's cart.
      router.refresh();
    });
  }

  return { add, pending, added };
}

type ButtonProps = {
  ref: RefObject<HTMLButtonElement | null>;
  /** The picker this button opens, or undefined when it adds directly. */
  controls?: string;
  open: boolean;
  pending: boolean;
  added: boolean;
  unavailable: boolean;
  onClick: () => void;
};

/** The card's own Add to cart, under its caption. */
export function CardAddButton({ ref, controls, open, pending, added, unavailable, onClick }: ButtonProps) {
  const label = pending ? 'Adding' : added ? 'Added' : unavailable ? 'Sold out' : 'Add to cart';

  return (
    <button
      ref={ref}
      type="button"
      className={`pcard__buy${added ? ' pcard__buy--done' : ''}${open ? ' pcard__buy--open' : ''}`}
      aria-expanded={controls ? open : undefined}
      aria-controls={controls}
      disabled={unavailable || pending}
      onClick={onClick}
    >
      {added ? (
        <CheckIcon className="pcard__buyicon" />
      ) : unavailable ? null : (
        <PlusIcon className="pcard__buyicon" />
      )}
      <span>{label}</span>
    </button>
  );
}

type PanelProps = {
  id: string;
  heading: string;
  options: AddOption[];
  /** Drawn above the options: the trade card's colour choice. */
  lead?: ReactNode;
  /** Runs are listed a row each, with their price; sizes sit in a grid. */
  layout: 'grid' | 'rows';
  pending: boolean;
  toggle: RefObject<HTMLButtonElement | null>;
  onPick: (option: AddOption) => void;
  onClose: () => void;
};

/**
 * The choice an Add to cart needs before it can add — a size, or a run —
 * raised over the foot of the photograph so the grid does not move.
 *
 * It takes the focus when it opens and gives it back to the button when it
 * closes. Escape, the cross and a press anywhere outside the card all close it.
 */
export function CardAddPanel({
  id,
  heading,
  options,
  lead,
  layout,
  pending,
  toggle,
  onPick,
  onClose,
}: PanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    const button = toggle.current;

    panel?.querySelector<HTMLElement>('button:not([disabled])')?.focus({ preventScroll: true });

    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
      button?.focus({ preventScroll: true });
    }

    function onPress(event: PointerEvent) {
      const target = event.target as Node;
      if (panel?.contains(target) || button?.contains(target)) return;
      onClose();
    }

    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPress);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPress);
    };
  }, [onClose, toggle]);

  return (
    <div
      ref={panelRef}
      id={id}
      className="pcard__add"
      role="group"
      aria-label={heading}
      aria-busy={pending}
    >
      <div className="pcard__addhead">
        <p className="pcard__addtitle">{heading}</p>
        <button
          type="button"
          className="pcard__addclose"
          onClick={() => {
            onClose();
            toggle.current?.focus({ preventScroll: true });
          }}
        >
          <CloseIcon />
          <span className="visually-hidden">Close</span>
        </button>
      </div>

      {lead}

      <ul className={`pcard__addopts pcard__addopts--${layout}`}>
        {options.map((option) => (
          <li key={option.key}>
            <button
              type="button"
              className="pcard__addopt"
              disabled={pending || !option.variantId}
              onClick={() => onPick(option)}
            >
              <span>{option.label}</span>
              {option.detail ? <span className="pcard__adddetail tnum">{option.detail}</span> : null}
              {!option.variantId ? <span className="visually-hidden">, sold out</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
