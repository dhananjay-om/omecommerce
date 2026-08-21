'use client'; // Error boundaries must be Client Components (this Next.js version's error.tsx contract).

/**
 * Last-resort boundary for exceptions thrown OUTSIDE the dashboard page tree
 * — e.g. inside (dashboard)/layout.tsx itself (getSession(), TopHeader,
 * DashboardNav) or the root layout — which (dashboard)/error.tsx can't catch
 * since it only wraps that layout's {children}, not the layout itself. Per
 * Next's own docs this file must define its own <html>/<body> (it replaces
 * the root layout when active), and is deliberately plain inline-styled
 * markup with zero component imports — this is the backstop of last resort,
 * so it must not itself be able to fail to render.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: '2rem',
        }}
      >
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ maxWidth: 420, color: '#666', fontSize: '0.875rem' }}>
          The admin app hit an unexpected error. Try again, or reload the page.
        </p>
        <p
          style={{
            maxWidth: 420,
            wordBreak: 'break-word',
            background: '#f4f4f5',
            border: '1px solid #e4e4e7',
            borderRadius: 6,
            padding: '0.5rem 0.75rem',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            color: '#666',
          }}
        >
          {error.message || 'Unknown error'}
          {error.digest ? ` (digest: ${error.digest})` : null}
        </p>
        <button
          onClick={() => unstable_retry()}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: 6,
            border: 'none',
            background: '#18181b',
            color: '#fff',
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
