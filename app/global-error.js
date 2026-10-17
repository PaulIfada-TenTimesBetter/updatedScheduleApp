'use client';

// Route-level error boundary: shows a friendly retry screen instead of the
// generic "client-side exception" dead end.
export default function Error({ error, reset }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#f1f5f9', margin: 0 }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            style={{
              maxWidth: 460,
              background: '#fff',
              borderRadius: 16,
              padding: 28,
              boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 40 }}>⚠️</div>
            <h1 style={{ fontSize: 20, margin: '12px 0 6px', color: '#0f172a' }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.5 }}>
              The page hit an unexpected error. This usually happens right after an update —
              an old page was saved in your browser. A refresh almost always fixes it.
            </p>
            <button
              onClick={() => window.location.reload(true)}
              style={{
                marginTop: 16,
                background: '#4f46e5',
                color: '#fff',
                border: 0,
                borderRadius: 10,
                padding: '10px 22px',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              ↻ Reload the app
            </button>
            <button
              onClick={() => (window.location.href = '/dashboard')}
              style={{
                marginTop: 16,
                marginLeft: 8,
                background: '#e2e8f0',
                color: '#0f172a',
                border: 0,
                borderRadius: 10,
                padding: '10px 22px',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Go to dashboard
            </button>
            {error?.digest && (
              <p style={{ marginTop: 14, fontSize: 11, color: '#94a3b8' }}>
                Error code: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
