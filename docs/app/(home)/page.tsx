import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col justify-center flex-1 px-6 py-16 max-w-2xl mx-auto">
      <p className="text-sm text-fd-muted-foreground mb-3">v0.2.1</p>
      <h1 className="text-3xl font-semibold tracking-tight mb-3">ScribbleSVG</h1>
      <p className="text-fd-muted-foreground text-lg mb-8 leading-relaxed">
        Lightweight SVG toolkit for hand-drawn diagrams. Serialize a document as
        JSON, edit it with React, or render it read-only anywhere.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/docs"
          className="inline-flex items-center rounded-lg bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground"
        >
          Read the docs
        </Link>
        <Link
          href="/docs/getting-started"
          className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium"
        >
          Get started
        </Link>
        <Link
          href="/docs/changelog"
          className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium"
        >
          Changelog
        </Link>
      </div>
    </div>
  );
}
