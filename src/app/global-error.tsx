"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Log the error to Sentry with critical context
    Sentry.captureException(error, {
      level: "fatal",
      tags: {
        isGlobalError: true,
        critical: true,
      },
    });
  }, [error]);

  // Basic inline styles since we can't rely on Tailwind in global-error.
  // Kleuren zijn de hexwaarden van de huisstijltokens (globals.css), want
  // CSS-variabelen zijn hier niet geladen: background, foreground,
  // muted(-foreground), border, destructive en primary (mosgroen).
  // Dark mode is handled via CSS media query in the <style> tag below
  const styles = {
    container: {
      display: "flex",
      minHeight: "100vh",
      flexDirection: "column" as const,
      alignItems: "center",
      justifyContent: "center",
      gap: "1.5rem",
      padding: "2rem",
      textAlign: "center" as const,
      backgroundColor: "#f5f3f0",
      fontFamily: "system-ui, -apple-system, sans-serif",
    },
    iconContainer: {
      borderRadius: "50%",
      backgroundColor: "rgba(164, 65, 48, 0.1)",
      padding: "1.25rem",
    },
    icon: {
      width: "3.5rem",
      height: "3.5rem",
      color: "#a44130",
    },
    title: {
      fontSize: "1.75rem",
      fontWeight: "bold" as const,
      color: "#0f0f0d",
      margin: 0,
    },
    description: {
      color: "#5f5d56",
      maxWidth: "28rem",
      margin: "0.5rem 0 0 0",
      lineHeight: 1.6,
    },
    errorId: {
      fontSize: "0.75rem",
      color: "#5f5d56",
      marginTop: "0.5rem",
    },
    buttonGroup: {
      display: "flex",
      gap: "0.75rem",
      flexWrap: "wrap" as const,
      justifyContent: "center",
    },
    button: {
      display: "inline-flex",
      alignItems: "center",
      gap: "0.5rem",
      padding: "0.75rem 1.5rem",
      borderRadius: "0.5rem",
      fontSize: "0.875rem",
      fontWeight: 500,
      cursor: "pointer",
      textDecoration: "none",
      transition: "all 0.15s ease",
    },
    primaryButton: {
      backgroundColor: "#3a4a36",
      color: "#f5f3f0",
      border: "none",
    },
    secondaryButton: {
      backgroundColor: "#fbfaf7",
      color: "#0f0f0d",
      border: "1px solid #d7d2c8",
    },
    detailsContainer: {
      backgroundColor: "#ece8e1",
      borderRadius: "0.5rem",
      padding: "1rem",
      maxWidth: "32rem",
      width: "100%",
      textAlign: "left" as const,
    },
    detailsTitle: {
      fontSize: "0.75rem",
      fontWeight: 600,
      color: "#a44130",
      marginBottom: "0.5rem",
    },
    detailsText: {
      fontSize: "0.75rem",
      color: "#5f5d56",
      whiteSpace: "pre-wrap" as const,
      overflowX: "auto" as const,
      maxHeight: "10rem",
      margin: 0,
    },
    helpSection: {
      borderTop: "1px solid #e3ded4",
      paddingTop: "1.5rem",
      marginTop: "0.5rem",
      fontSize: "0.875rem",
      color: "#5f5d56",
    },
    link: {
      color: "#3a4a36",
      textDecoration: "underline",
    },
  };

  const darkModeCSS = `
    @media (prefers-color-scheme: dark) {
      body { background-color: #0f0f0d !important; }
      .ge-container { background-color: #0f0f0d !important; }
      .ge-title { color: #e9e6e0 !important; }
      .ge-description { color: #a9a398 !important; }
      .ge-error-id { color: #a9a398 !important; }
      .ge-icon-container { background-color: rgba(224, 138, 115, 0.15) !important; }
      .ge-icon { color: #e08a73 !important; }
      .ge-btn-primary { background-color: #a3b595 !important; color: #0f0f0d !important; }
      .ge-btn-secondary { background-color: #22211d !important; color: #e9e6e0 !important; border-color: #2c2b26 !important; }
      .ge-details { background-color: #191915 !important; }
      .ge-details-title { color: #e08a73 !important; }
      .ge-details-text { color: #a9a398 !important; }
      .ge-help { border-color: #2c2b26 !important; color: #a9a398 !important; }
      .ge-link { color: #a3b595 !important; }
    }
  `;

  return (
    <html lang="nl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Kritieke fout | Top Tuinen</title>
        <style dangerouslySetInnerHTML={{ __html: darkModeCSS }} />
      </head>
      <body style={{ margin: 0 }}>
        <div className="ge-container" style={styles.container}>
          <div className="ge-icon-container" style={styles.iconContainer}>
            {/* Inline SVG for AlertTriangle icon */}
            <svg
              className="ge-icon"
              style={styles.icon}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <div>
            <h1 className="ge-title" style={styles.title}>Kritieke fout</h1>
            <p className="ge-description" style={styles.description}>
              Er is een ernstige fout opgetreden in de applicatie.
              Onze excuses voor het ongemak. Probeer de pagina te vernieuwen
              of ga terug naar het dashboard.
            </p>
            {error.digest && (
              <p className="ge-error-id" style={styles.errorId}>Fout referentie: {error.digest}</p>
            )}
          </div>

          <div style={styles.buttonGroup}>
            <button
              onClick={reset}
              className="ge-btn-secondary"
              style={{ ...styles.button, ...styles.secondaryButton }}
            >
              {/* RefreshCw icon */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M3 22v-6h6" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
              Probeer opnieuw
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Full reload needed in global error boundary */}
            <a href="/" className="ge-btn-primary" style={{ ...styles.button, ...styles.primaryButton }}>
              {/* Home icon */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9,22 9,12 15,12 15,22" />
              </svg>
              Dashboard
            </a>
          </div>

          {/* Debug info for development */}
          {process.env.NODE_ENV === "development" && (
            <div className="ge-details" style={styles.detailsContainer}>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="ge-btn-secondary"
                style={{
                  ...styles.button,
                  ...styles.secondaryButton,
                  padding: "0.5rem 1rem",
                  fontSize: "0.75rem",
                  marginBottom: showDetails ? "0.75rem" : 0,
                }}
              >
                {showDetails ? "Verberg details" : "Toon foutdetails"}
              </button>
              {showDetails && (
                <>
                  <div className="ge-details-title" style={styles.detailsTitle}>
                    {error.name}: {error.message}
                  </div>
                  {error.stack && (
                    <pre className="ge-details-text" style={styles.detailsText}>{error.stack}</pre>
                  )}
                </>
              )}
            </div>
          )}

          <div className="ge-help" style={styles.helpSection}>
            <p style={{ margin: "0 0 0.5rem 0" }}>
              Blijft dit probleem zich voordoen?
            </p>
            <a href="mailto:support@toptuinen.nl" className="ge-link" style={styles.link}>
              Neem contact op met support
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
