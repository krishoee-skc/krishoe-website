"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#F5F7F4",
          color: "#10231D",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: 24,
          }}
        >
          <section
            style={{
              maxWidth: 640,
              border: "1px solid rgba(0,0,0,0.10)",
              borderRadius: 8,
              background: "#fff",
              padding: 32,
              textAlign: "center",
              boxShadow: "0 24px 70px rgba(16,35,29,0.08)",
            }}
          >
            <p
              style={{
                margin: 0,
                color: "#B98A2E",
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              KRISHOE
            </p>
            <h1 style={{ margin: "16px 0 0", fontSize: 36, lineHeight: 1.1 }}>
              We need a quick retry.
            </h1>
            <p style={{ margin: "16px 0 0", color: "#5F6B66", lineHeight: 1.7 }}>
              The page hit a temporary issue. Your session stays safe while you retry.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                marginTop: 28,
                height: 48,
                border: 0,
                borderRadius: 999,
                background: "#0B4D3B",
                color: "#fff",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 800,
                padding: "0 24px",
              }}
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
