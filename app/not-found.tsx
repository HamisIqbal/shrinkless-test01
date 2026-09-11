import Link from 'next/link';

export const metadata = { title: 'Not found' };

export default function NotFound() {
  return (
    <div className="wrap narrow errorpage">
      <p className="eyebrow">404</p>
      <h1 className="display">Not in the catalogue</h1>
      <p className="lede">
        That page is not here. It may have sold through, or the link may be wrong.
      </p>
      <Link href="/shop" className="btn">Shop all</Link>
    </div>
  );
}
