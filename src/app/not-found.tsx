import "./globals.css";

/** Fallback for paths outside any locale (rare — the proxy adds a locale prefix). */
export default function RootNotFound() {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0 }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>404 — Page not found</h1>
          <p>
            <a href="/">Go to the store</a>
          </p>
        </div>
      </body>
    </html>
  );
}
