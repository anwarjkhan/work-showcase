import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="di-card mx-auto mt-10 max-w-xl p-8 text-center">
      <h2 className="font-display text-xl font-semibold text-heading">Page not found</h2>
      <p className="mt-2 text-fg-muted">This screen does not exist in the prototype.</p>
      <Link href="/" className="mt-5 inline-flex rounded-pill bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-strong">
        Back to the portfolio
      </Link>
    </div>
  );
}
