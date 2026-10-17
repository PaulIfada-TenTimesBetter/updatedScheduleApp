'use client';

// Route-level error boundary: keeps the app chrome and offers a retry.
export default function Error({ error, reset }) {
  return (
    <main
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 460 }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <h1 style={{ fontSize: 20, margin: '12px 0 6px' }}>This section hit an error</h1>
        <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.5 }}>
          Try again — if it keeps happening, refresh the page once (Ctrl+Shift+R) to load the
          latest version of the app.
        </p>
        <button
          onClick={() => reset()}
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
          ↻ Try again
        </button>
        {error?.digest && (
          <p style={{ marginTop: 14, fontSize: 11, color: '#94a3b8' }}>
            Error code: {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
